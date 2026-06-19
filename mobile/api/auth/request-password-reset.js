const { setCors } = require('../lib/supabase-fetch');
const { requestPasswordResetEmail } = require('../lib/password-reset');

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body ?? {};
    const result = await requestPasswordResetEmail({
      email: body.email,
      redirectTo: body.redirectTo,
    });

    if (!result.ok) {
      return res.status(result.status ?? 500).json({ error: result.error ?? 'Could not send email' });
    }

    return res.status(200).json({ success: true, pendingSetup: result.pendingSetup === true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not send email';
    console.error('[request-password-reset]', message);
    return res.status(500).json({ error: message });
  }
};
