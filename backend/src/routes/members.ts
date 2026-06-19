import { Hono } from 'hono';
import { adminFetch, getErrorMessage, isSupabaseAdminConfigured } from '../lib/supabase-admin';
import { requireManagerAuth } from '../middleware/auth';

const membersRouter = new Hono();

function buildFullName(firstName: string, lastName: string): string {
  return `${firstName.trim()} ${lastName.trim()}`.trim();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function updateProfileAfterInvite(params: {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  handicapIndex?: number;
}): Promise<void> {
  const body: Record<string, unknown> = {
    id: params.userId,
    first_name: params.firstName.trim(),
    last_name: params.lastName.trim(),
    full_name: buildFullName(params.firstName, params.lastName),
    email: params.email.trim().toLowerCase(),
    invite_status: 'pending',
    role: 'member',
    updated_at: new Date().toISOString(),
  };

  if (params.handicapIndex !== undefined) {
    body.handicap_index = params.handicapIndex;
  }

  const existing = await adminFetch<Array<{ id: string }>>(
    `/rest/v1/user_profiles?id=eq.${params.userId}&select=id&limit=1`
  );

  if (existing.ok && existing.data?.[0]) {
    const { ok, data } = await adminFetch(`/rest/v1/user_profiles?id=eq.${params.userId}`, {
      method: 'PATCH',
      body,
    });

    if (!ok) {
      throw new Error(getErrorMessage(data as Record<string, unknown>));
    }
    return;
  }

  const { ok, data } = await adminFetch('/rest/v1/user_profiles', {
    method: 'POST',
    body,
    prefer: 'return=minimal',
  });

  if (!ok) {
    throw new Error(getErrorMessage(data as Record<string, unknown>));
  }
}

async function inviteUserByEmail(params: {
  email: string;
  firstName: string;
  lastName: string;
  redirectTo: string;
}): Promise<{ userId: string }> {
  const fullName = buildFullName(params.firstName, params.lastName);

  const { ok, data } = await adminFetch<Record<string, unknown>>('/auth/v1/invite', {
    method: 'POST',
    body: {
      email: params.email.trim().toLowerCase(),
      data: {
        first_name: params.firstName.trim(),
        last_name: params.lastName.trim(),
        full_name: fullName,
      },
      redirect_to: params.redirectTo,
    },
  });

  if (!ok) {
    throw new Error(getErrorMessage(data));
  }

  const user = data.user as { id?: string } | undefined;
  const userId = user?.id ?? (typeof data.id === 'string' ? data.id : null);

  if (!userId) {
    throw new Error('Invite succeeded but no user id returned');
  }

  return { userId };
}

async function generateInviteLink(params: {
  email: string;
  firstName?: string;
  lastName?: string;
  redirectTo: string;
}): Promise<void> {
  const fullName =
    params.firstName && params.lastName
      ? buildFullName(params.firstName, params.lastName)
      : undefined;

  const { ok, data } = await adminFetch<Record<string, unknown>>('/auth/v1/admin/generate_link', {
    method: 'POST',
    body: {
      type: 'invite',
      email: params.email.trim().toLowerCase(),
      options: {
        redirect_to: params.redirectTo,
        data: fullName
          ? {
              first_name: params.firstName,
              last_name: params.lastName,
              full_name: fullName,
            }
          : undefined,
      },
    },
  });

  if (!ok) {
    throw new Error(getErrorMessage(data));
  }
}

membersRouter.use('*', async (c, next) => {
  if (!isSupabaseAdminConfigured()) {
    return c.json({ error: 'Member invite service is not configured' }, 503);
  }
  await next();
});

membersRouter.post('/invite', requireManagerAuth, async (c) => {
  const body = (await c.req.json()) as {
    firstName?: string;
    lastName?: string;
    email?: string;
    handicapIndex?: number;
    redirectTo?: string;
  };

  const firstName = body.firstName?.trim() ?? '';
  const lastName = body.lastName?.trim() ?? '';
  const email = body.email?.trim() ?? '';
  const inviteRedirect =
    body.redirectTo?.trim() ||
    process.env.MEMBER_INVITE_REDIRECT_URL?.trim() ||
    'http://localhost:8081/accept-invite';

  if (!firstName || !lastName) {
    return c.json({ error: 'First name and last name are required' }, 400);
  }
  if (!email || !isValidEmail(email)) {
    return c.json({ error: 'A valid email is required' }, 400);
  }

  try {
    const { userId } = await inviteUserByEmail({
      email,
      firstName,
      lastName,
      redirectTo: inviteRedirect,
    });

    await updateProfileAfterInvite({
      userId,
      firstName,
      lastName,
      email,
      handicapIndex: body.handicapIndex,
    });

    return c.json({ userId, status: 'invited' as const });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invite failed';
    return c.json({ error: message }, 400);
  }
});

membersRouter.post('/resend-invite', requireManagerAuth, async (c) => {
  const body = (await c.req.json()) as { email?: string; redirectTo?: string };
  const email = body.email?.trim() ?? '';
  const inviteRedirect =
    body.redirectTo?.trim() ||
    process.env.MEMBER_INVITE_REDIRECT_URL?.trim() ||
    'http://localhost:8081/accept-invite';

  if (!email || !isValidEmail(email)) {
    return c.json({ error: 'A valid email is required' }, 400);
  }

  try {
    const profileResult = await adminFetch<
      Array<{ id: string; first_name?: string; last_name?: string }>
    >(
      `/rest/v1/user_profiles?email=eq.${encodeURIComponent(email.toLowerCase())}&select=id,first_name,last_name`
    );

    if (!profileResult.ok || !profileResult.data?.[0]) {
      return c.json({ error: 'Member not found' }, 404);
    }

    const profile = profileResult.data[0];

    await generateInviteLink({
      email,
      firstName: profile.first_name,
      lastName: profile.last_name,
      redirectTo: inviteRedirect,
    });

    await updateProfileAfterInvite({
      userId: profile.id,
      firstName: profile.first_name ?? '',
      lastName: profile.last_name ?? '',
      email,
    });

    return c.json({ success: true, status: 'invited' as const });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Resend failed';
    return c.json({ error: message }, 400);
  }
});

export { membersRouter };
