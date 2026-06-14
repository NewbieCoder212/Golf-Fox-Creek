import { Hono } from 'hono';

const devAuthRouter = new Hono();

function isDevAuthEnabled(): boolean {
  return (
    process.env.NODE_ENV !== 'production' &&
    Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) &&
    Boolean(process.env.SUPABASE_URL?.trim())
  );
}

function assertDevSecret(provided: string | undefined): boolean {
  const expected = process.env.DEV_AUTH_SECRET?.trim() || 'foxcreek-dev-local';
  return Boolean(provided && provided === expected);
}

async function findUserIdByEmail(email: string): Promise<string | null> {
  const supabaseUrl = process.env.SUPABASE_URL!.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();

  const response = await fetch(
    `${supabaseUrl}/auth/v1/admin/users?page=1&per_page=200`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    }
  );

  if (!response.ok) return null;

  const data = (await response.json()) as { users?: Array<{ id: string; email?: string }> };
  const user = data.users?.find(
    (entry) => entry.email?.toLowerCase() === email.toLowerCase()
  );

  return user?.id ?? null;
}

function getErrorMessage(data: Record<string, unknown>): string {
  return (
    (typeof data.error_description === 'string' && data.error_description) ||
    (typeof data.msg === 'string' && data.msg) ||
    (typeof data.message === 'string' && data.message) ||
    'Request failed'
  );
}

devAuthRouter.post('/generate-reset-link', async (c) => {
  if (!isDevAuthEnabled()) {
    return c.json({ error: 'Dev auth is not configured on the backend' }, 503);
  }

  if (!assertDevSecret(c.req.header('x-dev-secret'))) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = (await c.req.json()) as { email?: string; redirectTo?: string };
  const email = body.email?.trim();
  const redirectTo = body.redirectTo?.trim() || 'http://localhost:8081/reset-password';

  if (!email) {
    return c.json({ error: 'Email is required' }, 400);
  }

  const supabaseUrl = process.env.SUPABASE_URL!.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();

  const response = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'recovery',
      email,
      options: { redirect_to: redirectTo },
    }),
  });

  const data = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    return c.json({ error: getErrorMessage(data) }, 400);
  }

  const properties = data.properties as Record<string, unknown> | undefined;
  const actionLink =
    (typeof data.action_link === 'string' && data.action_link) ||
    (typeof properties?.action_link === 'string' && properties.action_link) ||
    (typeof properties?.redirect_to === 'string' && properties.redirect_to) ||
    null;

  if (!actionLink) {
    return c.json({ error: 'No reset link returned from Supabase' }, 500);
  }

  return c.json({ actionLink, redirectTo });
});

devAuthRouter.post('/set-password', async (c) => {
  if (!isDevAuthEnabled()) {
    return c.json({ error: 'Dev auth is not configured on the backend' }, 503);
  }

  if (!assertDevSecret(c.req.header('x-dev-secret'))) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const body = (await c.req.json()) as { email?: string; password?: string };
  const email = body.email?.trim();
  const password = body.password?.trim();

  if (!email) {
    return c.json({ error: 'Email is required' }, 400);
  }
  if (!password || password.length < 6) {
    return c.json({ error: 'Password must be at least 6 characters' }, 400);
  }

  const supabaseUrl = process.env.SUPABASE_URL!.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim();

  const userId = await findUserIdByEmail(email);
  if (!userId) {
    return c.json({ error: 'User not found' }, 404);
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password }),
  });

  const data = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    return c.json({ error: getErrorMessage(data) }, 400);
  }

  return c.json({ success: true, email });
});

export { devAuthRouter };
