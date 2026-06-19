import { Hono } from 'hono';

import { getSupabaseAdminClient, isSupabaseAdminConfigured } from '../lib/supabase-admin';
import { sendPasswordResetEmail } from '../lib/password-reset-email';

const authRouter = new Hono();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function defaultResetRedirect(): string {
  return (
    process.env.PASSWORD_RESET_REDIRECT_URL?.trim() ??
    process.env.MEMBER_INVITE_REDIRECT_URL?.replace(/\/accept-invite$/, '/reset-password') ??
    'https://www.foxcreek.golf/reset-password'
  );
}

authRouter.use('*', async (c, next) => {
  if (!isSupabaseAdminConfigured()) {
    return c.json({ error: 'Auth service is not configured' }, 503);
  }
  await next();
});

/**
 * Send password reset via Resend + admin generate_link (does not use Supabase SMTP rate limits).
 */
authRouter.post('/request-password-reset', async (c) => {
  const body = (await c.req.json()) as { email?: string; redirectTo?: string };
  const email = body.email?.trim().toLowerCase() ?? '';
  const redirectTo = body.redirectTo?.trim() || defaultResetRedirect();

  if (!email || !EMAIL_PATTERN.test(email)) {
    return c.json({ error: 'A valid email is required' }, 400);
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo },
    });

    if (error || !data.properties?.action_link) {
      // Do not reveal whether the account exists.
      console.log('[Auth] Password reset link not generated:', error?.message ?? 'no link');
      return c.json({ success: true });
    }

    const emailResult = await sendPasswordResetEmail({
      to: email,
      resetUrl: data.properties.action_link,
    });

    if (!emailResult.sent) {
      console.error('[Auth] Password reset email failed:', emailResult.error);
      return c.json({ error: emailResult.error ?? 'Could not send reset email' }, 500);
    }

    return c.json({ success: true });
  } catch (err) {
    console.error('[Auth] Password reset error:', err);
    return c.json({ error: 'Could not send reset email' }, 500);
  }
});

export { authRouter };
