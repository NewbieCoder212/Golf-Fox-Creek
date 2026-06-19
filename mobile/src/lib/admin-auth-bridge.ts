/**
 * Bridge member JWT into admin auth for manager/super_admin users.
 * One login covers both member app and admin dashboard.
 */

import { refreshAuthSession, getAuthenticatedUserProfile, recordMemberSignIn } from './supabase';
import { useAdminAuthStore } from './admin-auth-store';
import { useMemberAuthStore } from './member-auth-store';

export function isAuthTokenExpiredError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('jwt expired') ||
    lower.includes('invalid jwt') ||
    message.includes('PGRST301') ||
    lower.includes('session expired')
  );
}

export function isAccessTokenExpired(accessToken: string, bufferSeconds = 60): boolean {
  try {
    const payload = JSON.parse(atob(accessToken.split('.')[1])) as { exp?: number };
    if (!payload.exp) return false;
    return Date.now() >= payload.exp * 1000 - bufferSeconds * 1000;
  } catch {
    return false;
  }
}

function readRefreshContext() {
  const member = useMemberAuthStore.getState();
  const admin = useAdminAuthStore.getState();

  return {
    refreshToken: member.refreshToken || admin.refreshToken,
    user: member.user ?? admin.user,
    profile: member.profile ?? admin.profile,
    fromMember: Boolean(member.refreshToken),
    fromAdmin: Boolean(admin.refreshToken),
  };
}

async function loadPersistedAuthContext() {
  await useAdminAuthStore.getState().loadStoredAuth();
  await useMemberAuthStore.getState().loadStoredAuth();
  return readRefreshContext();
}

async function applyRefreshedAuth(authData: {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string };
  profile: NonNullable<ReturnType<typeof readRefreshContext>['profile']>;
}) {
  if (canAccessAdminRole(authData.profile.role)) {
    await useAdminAuthStore.getState().setAuth(authData);
    await useMemberAuthStore.getState().setAuth(authData);
    return;
  }

  const member = useMemberAuthStore.getState();
  if (member.refreshToken || member.isAuthenticated) {
    await useMemberAuthStore.getState().setAuth(authData);
    return;
  }

  await useAdminAuthStore.getState().setAuth(authData);
}

/** Refresh the stored session and sync member/admin auth stores. */
export async function refreshStoredAuthSession(): Promise<string | null> {
  let context = readRefreshContext();

  if (!context.refreshToken) {
    context = await loadPersistedAuthContext();
  }

  const { refreshToken, user, profile } = context;
  if (!refreshToken || !user || !profile) {
    console.log('[Auth] No refresh token available');
    return null;
  }

  const result = await refreshAuthSession(refreshToken);
  if (!result.success || !result.session) {
    console.log('[Auth] Refresh failed:', result.error);
    return null;
  }

  const refreshedUser = result.user ?? result.session.user ?? user;
  const freshProfile = await getAuthenticatedUserProfile(
    refreshedUser.id,
    result.session.access_token
  );
  const authData = {
    accessToken: result.session.access_token,
    refreshToken: result.session.refresh_token,
    user: { id: refreshedUser.id, email: refreshedUser.email },
    profile: freshProfile ?? profile,
  };

  await applyRefreshedAuth(authData);
  return result.session.access_token;
}

function getStoredAccessToken(): string | null {
  return (
    useMemberAuthStore.getState().accessToken ?? useAdminAuthStore.getState().accessToken
  );
}

function hasStoredSessionCredentials(): boolean {
  const member = useMemberAuthStore.getState();
  const admin = useAdminAuthStore.getState();
  return Boolean(
    member.accessToken ||
      member.refreshToken ||
      admin.accessToken ||
      admin.refreshToken
  );
}

/** Stamp member portal activity when a valid session is active (not email-link auth alone). */
function recordActiveMemberPortalSignIn(): void {
  const member = useMemberAuthStore.getState();
  if (!member.accessToken || !member.user?.id || isAccessTokenExpired(member.accessToken)) {
    return;
  }
  void recordMemberSignIn(member.user.id, member.accessToken);
}

/**
 * Load persisted auth, sync member/admin stores, and refresh expired access tokens.
 * Clears stale sessions when refresh fails.
 */
export async function restoreStoredAuthSession(): Promise<boolean> {
  if (!hasStoredSessionCredentials()) {
    await useMemberAuthStore.getState().loadStoredAuth();
    await useAdminAuthStore.getState().loadStoredAuth();
  }

  await syncStoredAuthStores();

  const context = readRefreshContext();
  const accessToken = getStoredAccessToken();

  if (!context.refreshToken) {
    if (accessToken && !isAccessTokenExpired(accessToken)) {
      recordActiveMemberPortalSignIn();
      return true;
    }
    if (accessToken || context.user) {
      await useMemberAuthStore.getState().clearAuth();
    }
    return false;
  }

  if (accessToken && !isAccessTokenExpired(accessToken)) {
    recordActiveMemberPortalSignIn();
    return true;
  }

  const refreshed = await refreshStoredAuthSession();
  if (refreshed) {
    recordActiveMemberPortalSignIn();
    return true;
  }

  await useMemberAuthStore.getState().clearAuth();
  return false;
}

/** Reload admin auth from storage or refresh when memory was cleared (e.g. dev hot reload). */
export async function restoreAdminSession(): Promise<boolean> {
  const admin = useAdminAuthStore.getState();
  const member = useMemberAuthStore.getState();
  const hasLiveSession = Boolean(
    (admin.accessToken && admin.profile) || (member.accessToken && member.profile)
  );
  if (!hasLiveSession) {
    await useAdminAuthStore.getState().loadStoredAuth();
    await useMemberAuthStore.getState().loadStoredAuth();
  }

  const synced = await syncAdminMemberStores();
  const memberAfterLoad = useMemberAuthStore.getState();
  if (!synced && canAccessAdminRole(memberAfterLoad.profile?.role)) {
    await bridgeMemberAuthToAdmin();
  }

  const adminAfterSync = useAdminAuthStore.getState();
  if (!adminAfterSync.canAccessAdmin()) {
    return false;
  }

  const token = adminAfterSync.accessToken;
  if (token && !isAccessTokenExpired(token)) {
    return true;
  }

  const refreshed = await refreshStoredAuthSession();
  return Boolean(refreshed && useAdminAuthStore.getState().canAccessAdmin());
}

/** Return a valid manager access token, refreshing or restoring from storage when needed. */
export async function ensureManagerAccessToken(
  preferredToken?: string | null
): Promise<string | null> {
  let token = preferredToken ?? useAdminAuthStore.getState().accessToken;

  if (!token) {
    await restoreAdminSession();
    token = useAdminAuthStore.getState().accessToken;
  }

  if (token && !isAccessTokenExpired(token)) {
    return token;
  }

  const refreshed = await refreshStoredAuthSession();
  return refreshed ?? token ?? null;
}

export function canAccessAdminRole(role: string | undefined | null): boolean {
  return role === 'manager' || role === 'super_admin';
}

async function syncAdminMemberStores(): Promise<boolean> {
  const admin = useAdminAuthStore.getState();
  const member = useMemberAuthStore.getState();

  if (admin.canAccessAdmin()) {
    return bridgeAdminAuthToMember();
  }

  if (canAccessAdminRole(member.profile?.role)) {
    return bridgeMemberAuthToAdmin();
  }

  return false;
}

export function getPostLoginRoute(
  role: string | undefined | null
): '/admin/dashboard' | '/(tabs)' {
  return canAccessAdminRole(role) ? '/admin/dashboard' : '/(tabs)';
}

/** Align member + admin stores after loading persisted auth. */
export async function syncStoredAuthStores(): Promise<boolean> {
  return syncAdminMemberStores();
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
