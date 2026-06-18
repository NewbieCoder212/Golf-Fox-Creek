import type { Context, Next } from 'hono';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { isSupabaseAdminConfigured, readServiceRoleKey, readSupabaseUrl } from '../lib/supabase-admin';

export type AuthUser = {
  id: string;
  email: string;
  role: 'member' | 'manager' | 'super_admin';
};

let adminClient: SupabaseClient | null = null;

function getSupabaseAdminClient(): SupabaseClient {
  const url = readSupabaseUrl();
  const key = readServiceRoleKey();
  if (!adminClient) {
    adminClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}

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

function readKnownUserRole(userId: string): AuthUser['role'] | null {
  const superAdmins = (process.env.SUPER_ADMIN_USER_IDS ?? 'aefb52cc-7c08-4799-a6bc-907ec439287d')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (superAdmins.includes(userId)) return 'super_admin';

  const managers = (process.env.MANAGER_USER_IDS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (managers.includes(userId)) return 'manager';

  return null;
}

async function fetchUserRole(userId: string): Promise<AuthUser['role'] | null> {
  const knownRole = readKnownUserRole(userId);
  if (knownRole) return knownRole;

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data?.role) return null;
  return data.role as AuthUser['role'];
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
