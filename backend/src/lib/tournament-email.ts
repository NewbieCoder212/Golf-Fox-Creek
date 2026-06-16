export interface TournamentOnboardEmailParams {
  to: string;
  recipientName: string;
  tournamentName: string;
  tournamentDates: string;
  teamName?: string | null;
  teamSideLabel?: string | null;
  rosterNames?: string[];
  tournamentUrl: string;
  isPendingMember: boolean;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildTournamentOnboardEmailHtml(params: TournamentOnboardEmailParams): string {
  const rosterList = (params.rosterNames ?? [])
    .map((name) => `<li style="margin:4px 0;">${escapeHtml(name)}</li>`)
    .join('');

  const ctaLabel = params.isPendingMember ? 'Set up your account' : 'View tournament';
  const hasTeam = Boolean(params.teamName?.trim());

  const teamBlock = hasTeam
    ? `<div style="background:#0c0c0c; border:1px solid #262626; border-radius:12px; padding:16px; margin:20px 0;">
        <p style="margin:0 0 4px; color:#a3a3a3; font-size:12px; text-transform:uppercase; letter-spacing:0.08em;">Team</p>
        <p style="margin:0 0 8px; font-size:18px; font-weight:700;">${escapeHtml(params.teamName ?? '')}</p>
        ${params.teamSideLabel ? `<p style="margin:0 0 12px; color:#a3a3a3;">${escapeHtml(params.teamSideLabel)}</p>` : ''}
        ${rosterList ? `<ul style="margin:0; padding-left:18px; color:#e5e5e5;">${rosterList}</ul>` : ''}
      </div>`
    : `<p style="color:#d4d4d4; line-height:1.5;">
        You're on the participant list. Team assignments and pairings may still be finalized — check back in the app for updates.
      </p>`;

  const introLine = hasTeam
    ? `Your team roster is set for <strong>${escapeHtml(params.tournamentName)}</strong> (${escapeHtml(params.tournamentDates)}).`
    : `You're registered for <strong>${escapeHtml(params.tournamentName)}</strong> (${escapeHtml(params.tournamentDates)}).`;

  return `<!DOCTYPE html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#0c0c0c; color:#f5f5f5; padding:24px;">
    <div style="max-width:560px; margin:0 auto; background:#141414; border:1px solid #262626; border-radius:16px; padding:24px;">
      <p style="color:#a3e635; font-size:12px; letter-spacing:0.12em; text-transform:uppercase; margin:0 0 8px;">Fox Creek Golf</p>
      <h1 style="margin:0 0 12px; font-size:24px;">You're on the roster</h1>
      <p style="color:#d4d4d4; line-height:1.5;">
        Hi ${escapeHtml(params.recipientName)},
      </p>
      <p style="color:#d4d4d4; line-height:1.5;">
        ${introLine}
      </p>
      ${teamBlock}
      <a href="${escapeHtml(params.tournamentUrl)}" style="display:inline-block; background:#65a30d; color:#ffffff; text-decoration:none; font-weight:700; padding:12px 18px; border-radius:12px;">
        ${ctaLabel}
      </a>
      <p style="color:#737373; font-size:12px; margin-top:20px; line-height:1.5;">
        ${params.isPendingMember
          ? 'Use the link above to finish setting up your Fox Creek account, then open the tournament.'
          : 'Open the app or website to review pairings, tee times, and scoring.'}
      </p>
    </div>
  </body>
</html>`;
}

export function buildTournamentOnboardEmailText(params: TournamentOnboardEmailParams): string {
  const rosterLines = (params.rosterNames ?? []).map((name) => `- ${name}`).join('\n');
  const hasTeam = Boolean(params.teamName?.trim());
  const lines = [
    `Hi ${params.recipientName},`,
    '',
    hasTeam
      ? `Your team roster is set for ${params.tournamentName} (${params.tournamentDates}).`
      : `You're registered for ${params.tournamentName} (${params.tournamentDates}).`,
  ];

  if (hasTeam) {
    lines.push('', `Team: ${params.teamName}${params.teamSideLabel ? ` (${params.teamSideLabel})` : ''}`);
    if (rosterLines) lines.push(rosterLines);
  } else {
    lines.push('', 'Team assignments and pairings may still be finalized.');
  }

  lines.push(
    '',
    params.isPendingMember
      ? 'Set up your account: ' + params.tournamentUrl
      : 'View tournament: ' + params.tournamentUrl
  );

  return lines.join('\n');
}

export async function sendTournamentOnboardEmail(
  params: TournamentOnboardEmailParams
): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.TOURNAMENT_EMAIL_FROM?.trim() ?? 'Fox Creek Golf <onboarding@foxcreek.golf>';

  if (!apiKey) {
    return { sent: false, error: 'RESEND_API_KEY is not configured' };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject: `You're on the roster — ${params.tournamentName}`,
      html: buildTournamentOnboardEmailHtml(params),
      text: buildTournamentOnboardEmailText(params),
    }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    return { sent: false, error: body.message ?? `Resend request failed (${response.status})` };
  }

  return { sent: true };
}

export function buildTournamentDeepLink(tournamentId: string): string {
  const base =
    process.env.TOURNAMENT_EMAIL_APP_URL?.trim() ??
    process.env.MEMBER_INVITE_REDIRECT_URL?.replace(/\/accept-invite$/, '') ??
    'https://www.foxcreek.golf';
  return `${base.replace(/\/$/, '')}/tournaments/${tournamentId}`;
}
