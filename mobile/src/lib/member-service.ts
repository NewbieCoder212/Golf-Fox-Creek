const BACKEND_URL =
  process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL ?? 'http://localhost:3000';

export interface InviteMemberParams {
  firstName: string;
  lastName: string;
  email: string;
  handicapIndex?: number;
  accessToken: string;
}

export interface InviteMemberResult {
  success: boolean;
  userId?: string;
  error?: string;
}

export async function inviteMember(params: InviteMemberParams): Promise<InviteMemberResult> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/members/invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.accessToken}`,
      },
      body: JSON.stringify({
        firstName: params.firstName,
        lastName: params.lastName,
        email: params.email,
        handicapIndex: params.handicapIndex,
        redirectTo: getInviteRedirectUrl(),
      }),
    });

    const data = (await response.json()) as { userId?: string; error?: string };

    if (!response.ok) {
      return { success: false, error: data.error ?? 'Failed to send invite' };
    }

    return { success: true, userId: data.userId };
  } catch {
    return { success: false, error: 'Could not reach invite service' };
  }
}

export async function resendMemberInvite(
  email: string,
  accessToken: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/members/resend-invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        email,
        redirectTo: getInviteRedirectUrl(),
      }),
    });

    const data = (await response.json()) as { error?: string };

    if (!response.ok) {
      return { success: false, error: data.error ?? 'Failed to resend invite' };
    }

    return { success: true };
  } catch {
    return { success: false, error: 'Could not reach invite service' };
  }
}

const LOCAL_INVITE_URL = 'http://localhost:8081/accept-invite';
const PRODUCTION_INVITE_URL = 'https://www.foxcreek.golf/accept-invite';

export function getInviteRedirectUrl(): string {
  const override = process.env.EXPO_PUBLIC_INVITE_REDIRECT_URL?.trim();
  if (override) return override;

  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/accept-invite`;
  }

  if (__DEV__) {
    return LOCAL_INVITE_URL;
  }

  return PRODUCTION_INVITE_URL;
}
