const { adminFetch, fetchWithTimeout } = require('./supabase-fetch');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function defaultResetRedirect() {
  return (
    process.env.PASSWORD_RESET_REDIRECT_URL?.trim() ??
    process.env.MEMBER_INVITE_REDIRECT_URL?.replace(/\/accept-invite$/, '/reset-password') ??
    'https://www.foxcreek.golf/reset-password'
  );
}

function defaultInviteRedirect() {
  return (
    process.env.MEMBER_INVITE_REDIRECT_URL?.trim() ?? 'https://www.foxcreek.golf/accept-invite'
  );
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildSetupEmailHtml(params) {
  return `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;background:#0c0c0c;color:#f5f5f5;padding:24px;">
    <div style="max-width:560px;margin:0 auto;background:#141414;border:1px solid #262626;border-radius:16px;padding:24px;">
      <p style="color:#a3e635;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;margin:0 0 8px;">Fox Creek Golf</p>
      <h1 style="margin:0 0 12px;font-size:24px;">Finish setting up your account</h1>
      <p style="color:#d4d4d4;line-height:1.5;">Tap below to choose your password, then sign in at foxcreek.golf with <strong>Member Sign In</strong>.</p>
      <a href="${escapeHtml(params.actionUrl)}" style="display:inline-block;background:#65a30d;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:12px;margin:16px 0;">Set up your account</a>
    </div></body></html>`;
}

function buildResetEmailHtml(params) {
  return `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;background:#0c0c0c;color:#f5f5f5;padding:24px;">
    <div style="max-width:560px;margin:0 auto;background:#141414;border:1px solid #262626;border-radius:16px;padding:24px;">
      <p style="color:#a3e635;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;margin:0 0 8px;">Fox Creek Golf</p>
      <h1 style="margin:0 0 12px;font-size:24px;">Reset your password</h1>
      <p style="color:#d4d4d4;line-height:1.5;">Tap below to choose a new password, then sign in with <strong>Member Sign In</strong>.</p>
      <a href="${escapeHtml(params.actionUrl)}" style="display:inline-block;background:#65a30d;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:12px;margin:16px 0;">Reset password</a>
    </div></body></html>`;
}

async function sendAuthEmail(params) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.TOURNAMENT_EMAIL_FROM?.trim() ?? 'Fox Creek Golf <onboarding@foxcreek.golf>';
  if (!apiKey) return { sent: false, error: 'RESEND_API_KEY is not configured' };

  try {
    const response = await fetchWithTimeout(
      'https://api.resend.com/emails',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [params.to],
          subject: params.subject,
          html: params.html,
          text: params.text,
        }),
      },
      15_000
    );
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return { sent: false, error: body.message ?? `Resend failed (${response.status})` };
    }
    return { sent: true };
  } catch (error) {
    return {
      sent: false,
      error: error instanceof Error ? error.message : 'Email service unreachable',
    };
  }
}

async function lookupProfileByEmail(email) {
  const result = await adminFetch(
    `/rest/v1/user_profiles?email=eq.${encodeURIComponent(email)}&select=invite_status,full_name&limit=1`
  );
  return result.ok ? result.data?.[0] ?? null : null;
}

async function generateAuthLink(email, type, redirectTo) {
  const result = await adminFetch(
    '/auth/v1/admin/generate_link',
    {
      method: 'POST',
      body: {
        type,
        email,
        options: { redirect_to: redirectTo },
      },
    },
    25_000
  );

  if (!result.ok) {
    return { actionLink: null, error: result.data?.message ?? result.data?.msg ?? 'Could not generate link' };
  }

  const properties = result.data?.properties;
  const actionLink =
    result.data?.action_link ??
    properties?.action_link ??
    properties?.redirect_to ??
    null;

  return { actionLink, error: actionLink ? null : 'No link returned' };
}

async function requestPasswordResetEmail(params) {
  const email = params.email?.trim().toLowerCase() ?? '';
  const resetRedirect = params.redirectTo?.trim() || defaultResetRedirect();
  const inviteRedirect = defaultInviteRedirect();

  if (!email || !EMAIL_PATTERN.test(email)) {
    return { ok: false, status: 400, error: 'A valid email is required' };
  }

  const profile = await lookupProfileByEmail(email);
  const pendingSetup = profile?.invite_status === 'pending';

  const linkType = pendingSetup ? 'magiclink' : 'recovery';
  const redirectTo = pendingSetup ? inviteRedirect : resetRedirect;
  const { actionLink, error: linkError } = await generateAuthLink(email, linkType, redirectTo);

  if (!actionLink) {
    console.log('[password-reset] Link not generated:', linkError);
    return { ok: true, status: 200, pendingSetup };
  }

  const emailResult = pendingSetup
    ? await sendAuthEmail({
        to: email,
        subject: 'Finish setting up your Fox Creek Golf account',
        html: buildSetupEmailHtml({ actionUrl: actionLink }),
        text: `Set up your account: ${actionLink}\n\nThen sign in at foxcreek.golf with Member Sign In.`,
      })
    : await sendAuthEmail({
        to: email,
        subject: 'Reset your Fox Creek Golf password',
        html: buildResetEmailHtml({ actionUrl: actionLink }),
        text: `Reset your password: ${actionLink}\n\nThen sign in at foxcreek.golf with Member Sign In.`,
      });

  if (!emailResult.sent) {
    return { ok: false, status: 500, error: emailResult.error ?? 'Could not send email' };
  }

  return { ok: true, status: 200, pendingSetup };
}

module.exports = { requestPasswordResetEmail };
