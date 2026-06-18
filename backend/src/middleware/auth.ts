import type { Context, Next } from 'hono';
import { adminFetch, isSupabaseAdminConfigured } from '../lib/supabase-admin';

export type AuthUser = {
  id: string;
  email: string;
  role: 'member' | 'manager' | 'super_admin';
};

function parseSupabaseAccessToken(token: string): { id: string; email?: string } | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const payloadPart = parts[1];
  if (!payloadPart) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(payloadPart.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    ) as { sub?: string; email?: string; exp?: number };

    if (!payload.sub) return null;
    if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) {
      return null;
    }

    return {
      id: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : undefined,
    };
  } catch {
    return null;
  }
}

async function fetchUserRole(userId: string): Promise<AuthUser['role'] | null> {
  const result = await adminFetch<Array<{ role?: AuthUser['role'] }>>(
    `/rest/v1/user_profiles?id=eq.${userId}&select=role&limit=1`
  );
  if (!result.ok || !result.data?.[0]) return null;
  return result.data[0].role ?? null;
}

function validateAccessToken(token: string): { id: string; email?: string } | null {
  if (!isSupabaseAdminConfigured()) return null;
  return parseSupabaseAccessToken(token);
}

export async function requireMemberAuth(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const user = validateAccessToken(token);
    if (!user) {
      return c.json({ error: 'Invalid or expired token' }, 401);
    }

    const role = await fetchUserRole(user.id);
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
    const user = validateAccessToken(token);
    if (!user) {
      return c.json({ error: 'Invalid or expired token' }, 401);
    }

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
