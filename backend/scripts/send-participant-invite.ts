/**
 * Send a single tournament participant invite (bypasses Vercel timeout).
 * Run: cd backend && bun run scripts/send-participant-invite.ts <playerId> [--resend]
 */

import { sendParticipantInvite } from '../../api/lib/tournament-invite.js';

const tournamentId = '107c086c-8edd-4859-aa54-7ec6a0e9daba';
const playerId = process.argv[2]?.trim();
const resend = process.argv.includes('--resend');

if (!playerId) {
  console.error('Usage: bun run scripts/send-participant-invite.ts <playerId> [--resend]');
  process.exit(1);
}

const started = Date.now();
const result = await sendParticipantInvite(tournamentId, playerId, { resend });
const elapsed = ((Date.now() - started) / 1000).toFixed(1);

if (result.success) {
  console.log(`✓ Invite sent to ${result.email} in ${elapsed}s`);
  process.exit(0);
}

console.error(`✗ Failed after ${elapsed}s:`, result.error ?? 'Unknown error');
if (result.email) console.error('  email:', result.email);
process.exit(1);
