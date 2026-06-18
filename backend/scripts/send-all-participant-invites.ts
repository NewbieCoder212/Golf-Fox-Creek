/**
 * Send login emails to all pending Generation Cup participants.
 * Run: cd backend && bun run scripts/send-all-participant-invites.ts
 * Optional: --dry-run (list only, no sends)
 */

const SUPABASE_URL = process.env.SUPABASE_URL?.trim() ?? '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '';
const TOURNAMENT_ID = '107c086c-8edd-4859-aa54-7ec6a0e9daba';
const DRY_RUN = process.argv.includes('--dry-run');

const { sendParticipantInvite, finalizeParticipantInvites } = await import(
  '../../api/lib/tournament-invite.js'
);

async function adminFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Admin fetch failed (${response.status}): ${await response.text()}`);
  }
  return response.json() as Promise<T>;
}

type Player = {
  id: string;
  display_name: string;
  email: string | null;
  invite_email_sent_at: string | null;
};

const players = await adminFetch<Player[]>(
  `/rest/v1/tournament_players?tournament_id=eq.${TOURNAMENT_ID}&select=id,display_name,email,invite_email_sent_at&order=display_name`
);

const pending = players.filter((player) => !player.invite_email_sent_at && player.email?.trim());
const noEmail = players.filter((player) => !player.email?.trim());
const already = players.filter((player) => player.invite_email_sent_at);

console.log(`\nGeneration Cup invite batch`);
console.log(`  Already invited: ${already.length}`);
console.log(`  Pending:         ${pending.length}`);
console.log(`  No email:        ${noEmail.length}${noEmail.length ? ` (${noEmail.map((p) => p.display_name).join(', ')})` : ''}`);

if (DRY_RUN) {
  console.log('\nDry run — would email:');
  for (const player of pending) {
    console.log(`  · ${player.display_name} <${player.email}>`);
  }
  process.exit(0);
}

if (pending.length === 0) {
  console.log('\nNothing to send.');
  process.exit(0);
}

let emailed = 0;
const errors: string[] = [];
const started = Date.now();

for (const [index, player] of pending.entries()) {
  const label = `[${index + 1}/${pending.length}] ${player.display_name}`;
  process.stdout.write(`${label}… `);
  const t0 = Date.now();
  try {
    const result = await sendParticipantInvite(TOURNAMENT_ID, player.id, { resend: false });
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    if (result.success) {
      emailed += 1;
      console.log(`✓ ${result.email} (${secs}s)`);
    } else {
      console.log(`✗ ${result.error ?? 'failed'} (${secs}s)`);
      errors.push(`${player.display_name}: ${result.error ?? 'failed'}`);
    }
  } catch (error) {
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    const message = error instanceof Error ? error.message : 'failed';
    console.log(`✗ ${message} (${secs}s)`);
    errors.push(`${player.display_name}: ${message}`);
  }
}

if (emailed > 0) {
  console.log('\nFinalizing…');
  await finalizeParticipantInvites(TOURNAMENT_ID);
}

const elapsed = ((Date.now() - started) / 1000 / 60).toFixed(1);
console.log(`\nDone in ${elapsed} min — emailed ${emailed}/${pending.length}.`);
if (errors.length > 0) {
  console.log('\nErrors:');
  for (const error of errors.slice(0, 10)) console.log(`  · ${error}`);
  if (errors.length > 10) console.log(`  … and ${errors.length - 10} more`);
  process.exit(1);
}
