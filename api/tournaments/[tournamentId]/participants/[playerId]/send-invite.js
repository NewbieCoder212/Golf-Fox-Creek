const { requireManager, setCors } = require('../../../../lib/supabase-fetch');
const { sendParticipantInvite } = require('../../../../lib/tournament-invite');

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const auth = await requireManager(token);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const { tournamentId, playerId } = req.query;
    if (!tournamentId || !playerId) {
      return res.status(400).json({ error: 'Tournament and participant are required' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {};
    const result = await sendParticipantInvite(String(tournamentId), String(playerId), {
      resend: body.resend === true,
    });

    if (result.error) {
      return res.status(result.status ?? 500).json({
        error: result.error,
        invitesSent: result.invitesSent,
        email: result.email,
      });
    }

    return res.status(200).json({
      success: true,
      emailed: result.emailed,
      invitesSent: result.invitesSent,
      email: result.email,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not send invite';
    console.error('[send-invite]', message);
    return res.status(500).json({ error: message });
  }
};
