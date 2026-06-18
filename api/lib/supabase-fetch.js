const DEFAULT_TIMEOUT_MS = 10_000;

function getConfig() {
  const supabaseUrl = process.env.SUPABASE_URL?.trim() ?? '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '';
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase admin is not configured');
  }
  return { supabaseUrl, serviceRoleKey };
}

function fetchWithTimeout(url, init = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return Promise.race([
    fetch(url, { ...init, cache: 'no-store' }),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Supabase request timed out')), timeoutMs);
    }),
  ]);
}

async function adminFetch(path, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const { supabaseUrl, serviceRoleKey } = getConfig();
  const method = options.method ?? 'GET';
  const headers = {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  };
  if (options.prefer) headers.Prefer = options.prefer;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  try {
    const response = await fetchWithTimeout(`${supabaseUrl}${path}`, {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    }, timeoutMs);
    const text = await response.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text.slice(0, 200) };
      }
    }
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Supabase request failed';
    return { ok: false, status: 504, data: { message } };
  }
}

function parseAccessToken(token) {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    );
    if (!payload.sub) return null;
    if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) return null;
    return {
      id: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : undefined,
    };
  } catch {
    return null;
  }
}

async function requireManager(token) {
  const user = parseAccessToken(token);
  if (!user) return { error: 'Invalid or expired token', status: 401 };

  const roleResult = await adminFetch(
    `/rest/v1/user_profiles?id=eq.${user.id}&select=role&limit=1`
  );
  const role = roleResult.ok && roleResult.data?.[0]?.role;
  if (!role) return { error: 'Profile not found', status: 403 };
  if (role !== 'manager' && role !== 'super_admin') {
    return { error: 'Manager access required', status: 403 };
  }
  return { user: { ...user, role } };
}

function setCors(req, res) {
  const origin = req.headers.origin;
  const allowed =
    origin === 'https://www.foxcreek.golf' ||
    origin === 'https://foxcreek.golf' ||
    (typeof origin === 'string' && origin.endsWith('.foxcreek.golf'));
  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
}

module.exports = {
  adminFetch,
  requireManager,
  setCors,
  getConfig,
  fetchWithTimeout,
};
