import type { Context, Next } from 'hono';
import { getSupabaseAdminConfig } from '../lib/supabase-admin';

export type AuthUser = {
  id: string;
  email: string;
  role: 'member' | 'manager' | 'super_admin';
};

async function fetchUserRole(userId: string): Promise<AuthUser['role'] | null> {
  const { supabaseUrl, serviceRoleKey } = getSupabaseAdminConfig();
  const url = new URL(`${supabaseUrl}/rest/v1/user_profiles`);
  url.searchParams.set('id', `eq.${userId}`);
  url.searchParams.set('select', 'role');

  const response = await fetch(url.toString(), {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Accept: 'application/vnd.pgrst.object+json',
    },
  });

  if (!response.ok) return null;
  const profile = (await response.json()) as { role?: AuthUser['role'] };
  return profile.role ?? null;
}

export async function requireManagerAuth(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const { supabaseUrl, serviceRoleKey } = getSupabaseAdminConfig();
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return c.json({ error: 'Invalid or expired token' }, 401);
    }

    const user = (await response.json()) as { id: string; email?: string };
    const role = await fetchUserRole(user.id);

    if (!role || (role !== 'manager' && role !== 'super_admin')) {
      return c.json({ error: 'Manager access required' }, 403);
    }

    c.set('authUser', { id: user.id, email: user.email ?? '', role } satisfies AuthUser);
    await next();
  } catch {
    return c.json({ error: 'Auth service unavailable' }, 503);
  }
}
