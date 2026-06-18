const supabaseUrl = process.env.SUPABASE_URL?.trim() ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '';

export function isSupabaseAdminConfigured(): boolean {
  return Boolean(supabaseUrl && serviceRoleKey);
}

export function getSupabaseAdminConfig() {
  if (!isSupabaseAdminConfigured()) {
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

export async function adminFetch<T = Record<string, unknown>>(
  path: string,
  options: { method?: string; body?: unknown; prefer?: string } = {}
): Promise<{ ok: boolean; status: number; data: T }> {
  const { supabaseUrl: url, serviceRoleKey: key } = getSupabaseAdminConfig();
  const headers: Record<string, string> = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
  if (options.prefer) {
    headers.Prefer = options.prefer;
  }

  const response = await fetch(`${url}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

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
