/**
 * Bridge member JWT into admin auth for manager/super_admin users.
 * One login covers both member app and admin dashboard.
 */

import { useAdminAuthStore } from './admin-auth-store';
import { useMemberAuthStore } from './member-auth-store';

export function canAccessAdminRole(role: string | undefined | null): boolean {
  return role === 'manager' || role === 'super_admin';
}

export async function bridgeMemberAuthToAdmin(): Promise<boolean> {
  const member = useMemberAuthStore.getState();
  if (!member.accessToken || !member.user || !member.profile) {
    return false;
  }

  if (!canAccessAdminRole(member.profile.role)) {
    const admin = useAdminAuthStore.getState();
    if (admin.isAuthenticated) {
      await useAdminAuthStore.getState().clearAuth();
    }
    return false;
  }

  const admin = useAdminAuthStore.getState();
  if (
    admin.isAuthenticated &&
    admin.accessToken === member.accessToken &&
    admin.profile?.id === member.profile.id
  ) {
    return true;
  }

  await useAdminAuthStore.getState().setAuth({
    accessToken: member.accessToken,
    refreshToken: member.refreshToken ?? '',
    user: member.user,
    profile: member.profile,
  });

  return true;
}

/** Keep member JWT aligned when signing in through the admin portal only. */
export async function bridgeAdminAuthToMember(): Promise<boolean> {
  const admin = useAdminAuthStore.getState();
  if (!admin.accessToken || !admin.user || !admin.profile) {
    return false;
  }

  if (!canAccessAdminRole(admin.profile.role)) {
    return false;
  }

  const member = useMemberAuthStore.getState();
  if (
    member.isAuthenticated &&
    member.accessToken === admin.accessToken &&
    member.profile?.id === admin.profile.id
  ) {
    return true;
  }

  await useMemberAuthStore.getState().setAuth({
    accessToken: admin.accessToken,
    refreshToken: admin.refreshToken ?? '',
    user: admin.user,
    profile: admin.profile,
  });

  return true;
}
