import type { Context, Next } from 'hono';
import {
  getSupabaseAdminConfig,
  getSupabaseAnonKey,
  isSupabaseAdminConfigured,
} from '../lib/supabase-admin';

export type AuthUser = {
  id: string;
  email: string;
  role: 'member' | 'manager' | 'super_admin';
};

const AUTH_FETCH_TIMEOUT_MS = 8_000;

async function authFetch(url: string, headers: Record<string, string>): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AUTH_FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      headers,
      signal: controller.signal,
      cache: 'no-store',
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchUserRole(
  userId: string,
  _accessToken: string
): Promise<AuthUser['role'] | null> {
  const { supabaseUrl, serviceRoleKey } = getSupabaseAdminConfig();
  const response = await authFetch(
    `${supabaseUrl}/rest/v1/user_profiles?id=eq.${userId}&select=role&limit=1`,
    {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    }
  );
  if (!response.ok) return null;
  const rows = (await response.json()) as Array<{ role?: AuthUser['role'] }>;
  return rows[0]?.role ?? null;
}

async function validateAccessToken(token: string): Promise<{ id: string; email?: string } | null> {
  if (!isSupabaseAdminConfigured()) {
    return null;
  }

  const { supabaseUrl, serviceRoleKey } = getSupabaseAdminConfig();
  const anonKey = getSupabaseAnonKey();
  const apikey = anonKey || serviceRoleKey;

  const response = await authFetch(`${supabaseUrl}/auth/v1/user`, {
    apikey,
    Authorization: `Bearer ${token}`,
  });

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as { id: string; email?: string };
}

export async function requireMemberAuth(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const user = await validateAccessToken(token);
    if (!user) {
      return c.json({ error: 'Invalid or expired token' }, 401);
    }

    const role = await fetchUserRole(user.id, token);
    if (!role) {
      return c.json({ error: 'Profile not found' }, 403);
    }

    c.set('authUser', { id: user.id, email: user.email ?? '', role } satisfies AuthUser);
    await next();
  } catch {
    return c.json({ error: 'Auth service unavailable' }, 503);
  }
}

export async function requireManagerAuth(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const user = await validateAccessToken(token);
    if (!user) {
      return c.json({ error: 'Invalid or expired token' }, 401);
    }

    const role = await fetchUserRole(user.id, token);
    if (!role || (role !== 'manager' && role !== 'super_admin')) {
      return c.json({ error: 'Manager access required' }, 403);
    }

    c.set('authUser', { id: user.id, email: user.email ?? '', role } satisfies AuthUser);
    await next();
  } catch {
    return c.json({ error: 'Auth service unavailable' }, 503);
  }
}
