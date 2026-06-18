const { requireManager, setCors } = require('../../../lib/supabase-fetch');
const { loadParticipantOnboarding } = require('../../../lib/tournament-onboarding');

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const auth = await requireManager(token);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const { tournamentId } = req.query;
    if (!tournamentId) {
      return res.status(400).json({ error: 'Tournament is required' });
    }

    const result = await loadParticipantOnboarding(String(tournamentId));
    return res.status(200).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load onboarding status';
    console.error('[participant-onboarding]', message);
    return res.status(500).json({ error: message });
  }
};
