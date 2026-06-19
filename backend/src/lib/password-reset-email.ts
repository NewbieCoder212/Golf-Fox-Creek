function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildPasswordResetEmailHtml(params: {
  resetUrl: string;
}): string {
  return `<!DOCTYPE html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#0c0c0c; color:#f5f5f5; padding:24px;">
    <div style="max-width:560px; margin:0 auto; background:#141414; border:1px solid #262626; border-radius:16px; padding:24px;">
      <p style="color:#a3e635; font-size:12px; letter-spacing:0.12em; text-transform:uppercase; margin:0 0 8px;">Fox Creek Golf</p>
      <h1 style="margin:0 0 12px; font-size:24px;">Reset your password</h1>
      <p style="color:#d4d4d4; line-height:1.5;">
        Tap the button below to choose a new password for your Generation Cup account.
      </p>
      <a href="${escapeHtml(params.resetUrl)}" style="display:inline-block; background:#65a30d; color:#ffffff; text-decoration:none; font-weight:700; padding:12px 18px; border-radius:12px; margin:16px 0;">
        Reset password
      </a>
      <p style="color:#737373; font-size:12px; margin-top:20px; line-height:1.5;">
        If you did not request this, you can ignore this email. After resetting, sign in from the Member Sign In screen.
      </p>
    </div>
  </body>
</html>`;
}

export function buildPasswordResetEmailText(params: { resetUrl: string }): string {
  return [
    'Reset your Fox Creek Golf password:',
    '',
    params.resetUrl,
    '',
    'If you did not request this, you can ignore this email.',
    'After resetting, sign in from the Member Sign In screen.',
  ].join('\n');
}

export async function sendPasswordResetEmail(params: {
  to: string;
  resetUrl: string;
}): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.TOURNAMENT_EMAIL_FROM?.trim() ?? 'Fox Creek Golf <onboarding@foxcreek.golf>';

  if (!apiKey) {
    return { sent: false, error: 'RESEND_API_KEY is not configured' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  let response: Response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject: 'Reset your Fox Creek Golf password',
        html: buildPasswordResetEmailHtml({ resetUrl: params.resetUrl }),
        text: buildPasswordResetEmailText({ resetUrl: params.resetUrl }),
      }),
      signal: controller.signal,
      cache: 'no-store',
    });
  } catch (error) {
    const message =
      error instanceof Error && error.name === 'AbortError'
        ? 'Email service timed out'
        : 'Email service unreachable';
    return { sent: false, error: message };
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    return { sent: false, error: body.message ?? `Resend request failed (${response.status})` };
  }

  return { sent: true };
}
