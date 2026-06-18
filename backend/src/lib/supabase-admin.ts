const ADMIN_FETCH_TIMEOUT_MS = 12_000;

function readSupabaseUrl(): string {
  return process.env.SUPABASE_URL?.trim() ?? '';
}

function readServiceRoleKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '';
}

export function getSupabaseAnonKey(): string {
  return (
    process.env.SUPABASE_ANON_KEY?.trim() ??
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ??
    ''
  );
}

export function isSupabaseAdminConfigured(): boolean {
  return Boolean(readSupabaseUrl() && readServiceRoleKey());
}

export function getSupabaseAdminConfig() {
  const supabaseUrl = readSupabaseUrl();
  const serviceRoleKey = readServiceRoleKey();
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase admin is not configured');
  }
  return { supabaseUrl, serviceRoleKey };
}

export function getErrorMessage(data: Record<string, unknown>): string {
  return (
    (typeof data.error_description === 'string' && data.error_description) ||
    (typeof data.msg === 'string' && data.msg) ||
    (typeof data.message === 'string' && data.message) ||
    'Request failed'
  );
}

async function supabaseFetch(
  url: string,
  init: RequestInit = {},
  timeoutMs = ADMIN_FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const fetchPromise = fetch(url, {
    ...init,
    signal: init.signal ?? controller.signal,
    cache: 'no-store',
  });

  const timeoutPromise = new Promise<Response>((_, reject) => {
    setTimeout(() => reject(new Error('Supabase request timed out')), timeoutMs);
  });

  try {
    return await Promise.race([fetchPromise, timeoutPromise]);
  } finally {
    clearTimeout(timeout);
  }
}

export async function adminFetch<T = Record<string, unknown>>(
  path: string,
  options: { method?: string; body?: unknown; prefer?: string } = {}
): Promise<{ ok: boolean; status: number; data: T }> {
  const { supabaseUrl: url, serviceRoleKey: key } = getSupabaseAdminConfig();
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = {
    apikey: key,
    Authorization: `Bearer ${key}`,
  };
  if (options.prefer) {
    headers.Prefer = options.prefer;
  }
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  let response: Response;
  try {
    response = await supabaseFetch(`${url}${path}`, {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.name === 'AbortError'
        ? 'Supabase request timed out'
        : 'Supabase request failed';
    return { ok: false, status: 504, data: { message } as T };
  }

  const text = await response.text();
  let data = null as T;
  if (text) {
    try {
      data = JSON.parse(text) as T;
    } catch {
      data = {
        message: text.slice(0, 200),
      } as T;
    }
  }
  return { ok: response.ok, status: response.status, data };
}
