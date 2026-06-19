/**
 * Supabase REST API Client
 * Uses fetch instead of @supabase/supabase-js to avoid native dependencies
 */

import type {
  AppSetting,
  GeofenceSettings,
  GeofenceZone,
  GMAnnouncement,
  TurnMessagingSettings,
  TournamentFormatsSettings,
  AdRotationSettings,
  LoyaltyConfig,
  LoyaltyTransaction,
  LoyaltyTransactionInsert,
  Round,
  RoundInsert,
  TeeTime,
  UserProfile,
} from '@/types';
import {
  getDefaultTournamentFormatsSettings,
  mergeTournamentFormatsSettings,
} from './tournament-format-settings';

// Add your credentials in the ENV tab of the Vibecode app
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

const isConfigured = () => Boolean(supabaseUrl && supabaseAnonKey);

/**
 * Make a request to Supabase REST API
 */
async function supabaseRequest<T>(
  table: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    query?: Record<string, string>;
    body?: Record<string, unknown>;
    single?: boolean;
  } = {}
): Promise<T | null> {
  if (!isConfigured()) {
    console.log('[Supabase] Not configured');
    return null;
  }

  const { method = 'GET', query = {}, body, single = false } = options;

  // Build URL with query params
  const url = new URL(`${supabaseUrl}/rest/v1/${table}`);
  Object.entries(query).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  const headers: Record<string, string> = {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${supabaseAnonKey}`,
    'Content-Type': 'application/json',
    Prefer: single ? 'return=representation' : 'return=representation',
  };

  if (single) {
    headers['Accept'] = 'application/vnd.pgrst.object+json';
  }

  try {
    const response = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`[Supabase] Error ${response.status}:`, errorText);
      return null;
    }

    const data = await response.json();
    return data as T;
  } catch (err) {
    console.log('[Supabase] Request failed:', err);
    return null;
  }
}

// ============================================
// APP SETTINGS QUERIES
// ============================================

/**
 * Fetch geofence settings from Supabase
 * Returns default settings if not found or Supabase not configured
 */
export async function getGeofenceSettings(): Promise<GeofenceSettings> {
  if (!isConfigured()) {
    console.log('[Supabase] Not configured, using default settings');
    return getDefaultGeofenceSettings();
  }

  const data = await supabaseRequest<AppSetting>('app_settings', {
    query: { setting_key: 'eq.geofence_tracking' },
    single: true,
  });

  if (!data) {
    return getDefaultGeofenceSettings();
  }

  return data.setting_value as GeofenceSettings;
}

/**
 * Update geofence settings (requires manager/admin role)
 */
export async function updateGeofenceSettings(
  settings: Partial<GeofenceSettings>
): Promise<boolean> {
  if (!isConfigured()) return false;

  // First get current settings
  const current = await getGeofenceSettings();
  const updated = { ...current, ...settings };

  const result = await supabaseRequest('app_settings', {
    method: 'PATCH',
    query: { setting_key: 'eq.geofence_tracking' },
    body: {
      setting_value: updated,
      updated_at: new Date().toISOString(),
    },
  });

  return result !== null;
}

// ============================================
// GEOFENCE ZONES QUERIES
// ============================================

/**
 * Fetch all active geofence zones
 */
export async function getGeofenceZones(): Promise<GeofenceZone[]> {
  if (!isConfigured()) {
    console.log('[Supabase] Not configured, using local course data');
    return [];
  }

  const data = await supabaseRequest<GeofenceZone[]>('geofence_zones', {
    query: {
      is_active: 'eq.true',
      order: 'zone_name',
    },
  });

  return data ?? [];
}

/**
 * Fetch a specific zone by type
 */
export async function getGeofenceZoneByType(
  zoneType: GeofenceZone['zone_type']
): Promise<GeofenceZone | null> {
  if (!isConfigured()) return null;

  return supabaseRequest<GeofenceZone>('geofence_zones', {
    query: {
      zone_type: `eq.${zoneType}`,
      is_active: 'eq.true',
    },
    single: true,
  });
}

/**
 * Fetch hole green zone by hole number
 */
export async function getHoleGreenZone(holeNumber: number): Promise<GeofenceZone | null> {
  if (!isConfigured()) return null;

  return supabaseRequest<GeofenceZone>('geofence_zones', {
    query: {
      zone_type: 'eq.hole_green',
      hole_number: `eq.${holeNumber}`,
      is_active: 'eq.true',
    },
    single: true,
  });
}

/**
 * Update a geofence zone's coordinates (admin only)
 */
export async function updateGeofenceZone(
  zoneId: string,
  updates: Partial<Pick<GeofenceZone, 'latitude' | 'longitude' | 'radius_meters' | 'is_active'>>
): Promise<boolean> {
  if (!isConfigured()) return false;

  const result = await supabaseRequest('geofence_zones', {
    method: 'PATCH',
    query: { id: `eq.${zoneId}` },
    body: {
      ...updates,
      updated_at: new Date().toISOString(),
    },
  });

  return result !== null;
}

// ============================================
// USER PROFILE QUERIES
// ============================================

/**
 * Get user profile by ID
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  if (!isConfigured()) return null;

  return supabaseRequest<UserProfile>('user_profiles', {
    query: { id: `eq.${userId}` },
    single: true,
  });
}

/**
 * Update user's personal location tracking preference
 */
export async function updateUserLocationTracking(
  userId: string,
  enabled: boolean
): Promise<boolean> {
  if (!isConfigured()) return false;

  const result = await supabaseRequest('user_profiles', {
    method: 'PATCH',
    query: { id: `eq.${userId}` },
    body: {
      location_tracking_enabled: enabled,
      updated_at: new Date().toISOString(),
    },
  });

  return result !== null;
}

/**
 * Check if user is a manager or admin
 */
export async function isManagerOrAdmin(userId: string): Promise<boolean> {
  const profile = await getUserProfile(userId);
  return profile?.role === 'manager' || profile?.role === 'super_admin';
}

// ============================================
// TEE TIME QUERIES
// ============================================

/**
 * Get user's upcoming tee times
 */
export async function getUpcomingTeeTimes(userId: string): Promise<TeeTime[]> {
  if (!isConfigured()) return [];

  const data = await supabaseRequest<TeeTime[]>('tee_times', {
    query: {
      user_id: `eq.${userId}`,
      status: 'eq.confirmed',
      tee_time: `gte.${new Date().toISOString()}`,
      order: 'tee_time.asc',
      limit: '5',
    },
  });

  return data ?? [];
}

/**
 * Get the user's next tee time
 */
export async function getNextTeeTime(userId: string): Promise<TeeTime | null> {
  const teeTimes = await getUpcomingTeeTimes(userId);
  return teeTimes[0] ?? null;
}

// ============================================
// DEFAULT VALUES (used when Supabase not configured)
// ============================================

export function getDefaultGeofenceSettings(): GeofenceSettings {
  return {
    enabled: true,
    check_in_enabled: true,
    tee_time_alerts: true,
    turn_prompt_enabled: true,
  };
}

export function getDefaultTurnMessagingSettings(): TurnMessagingSettings {
  return {
    scorecard_title: 'Enjoy the Turn',
    scorecard_countdown_label: 'Back 9 starts in...',
    scorecard_body: 'Grab a snack, refresh your drink, and get ready for the back nine',
    scorecard_skip_label: 'Skip & Start Hole 10',
    hub_title: 'The Turn',
    hub_prompt: 'Stop by the canteen for refreshments?',
  };
}

export function getDefaultGMAnnouncementSettings(): GMAnnouncement {
  return {
    enabled: false,
    title: '',
    message: '',
    type: 'info',
    expires_at: null,
    placeholder_enabled: false,
    placeholder_title: 'More Information Coming Soon',
    placeholder_message: "We're preparing club updates. More information to follow.",
  };
}

// ============================================
// HELPER TO CHECK IF SUPABASE IS CONFIGURED
// ============================================

export function isSupabaseConfigured(): boolean {
  return isConfigured();
}

// ============================================
// ROUNDS QUERIES (Handicap & History)
// ============================================

/**
 * Save a completed round to the database
 */
export async function saveRound(round: RoundInsert): Promise<Round | null> {
  if (!isConfigured()) {
    console.log('[Supabase] Not configured, cannot save round');
    return null;
  }

  const result = await supabaseRequest<Round[]>('rounds', {
    method: 'POST',
    body: round as unknown as Record<string, unknown>,
  });

  return result?.[0] ?? null;
}

/**
 * Get user's round history (most recent first)
 */
export async function getUserRounds(userId: string, limit = 20): Promise<Round[]> {
  if (!isConfigured()) return [];

  const data = await supabaseRequest<Round[]>('rounds', {
    query: {
      user_id: `eq.${userId}`,
      order: 'played_at.desc',
      limit: String(limit),
    },
  });

  return data ?? [];
}

/**
 * Get user's handicap index from their profile
 */
export async function getUserHandicap(userId: string): Promise<number | null> {
  const profile = await getUserProfile(userId);
  return profile?.handicap_index ?? null;
}

/**
 * Update user's handicap index (called automatically by DB trigger)
 */
export async function updateUserHandicap(
  userId: string,
  handicapIndex: number
): Promise<boolean> {
  if (!isConfigured()) return false;

  const result = await supabaseRequest('user_profiles', {
    method: 'PATCH',
    query: { id: `eq.${userId}` },
    body: {
      handicap_index: handicapIndex,
      handicap_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  });

  return result !== null;
}

// ============================================
// LOYALTY POINTS QUERIES
// ============================================

/**
 * Get loyalty point configuration
 */
export async function getLoyaltyConfig(): Promise<LoyaltyConfig | null> {
  if (!isConfigured()) return null;

  const data = await supabaseRequest<{ config_value: LoyaltyConfig }[]>('loyalty_config', {
    query: { config_key: 'eq.point_rules' },
  });

  return data?.[0]?.config_value ?? null;
}

/**
 * Get user's current loyalty points
 */
export async function getUserLoyaltyPoints(userId: string): Promise<number> {
  const profile = await getUserProfile(userId);
  return profile?.loyalty_points ?? 0;
}

/**
 * Add loyalty points transaction
 */
export async function addLoyaltyTransaction(
  transaction: LoyaltyTransactionInsert
): Promise<LoyaltyTransaction | null> {
  if (!isConfigured()) {
    console.log('[Supabase] Not configured, cannot add loyalty transaction');
    return null;
  }

  const result = await supabaseRequest<LoyaltyTransaction[]>('loyalty_transactions', {
    method: 'POST',
    body: transaction as unknown as Record<string, unknown>,
  });

  // Also update user's total points
  if (result?.[0]) {
    const currentPoints = await getUserLoyaltyPoints(transaction.user_id);
    await supabaseRequest('user_profiles', {
      method: 'PATCH',
      query: { id: `eq.${transaction.user_id}` },
      body: {
        loyalty_points: currentPoints + transaction.points,
        updated_at: new Date().toISOString(),
      },
    });
  }

  return result?.[0] ?? null;
}

/**
 * Get user's loyalty transaction history
 */
export async function getUserLoyaltyHistory(
  userId: string,
  limit = 50
): Promise<LoyaltyTransaction[]> {
  if (!isConfigured()) return [];

  const data = await supabaseRequest<LoyaltyTransaction[]>('loyalty_transactions', {
    query: {
      user_id: `eq.${userId}`,
      order: 'created_at.desc',
      limit: String(limit),
    },
  });

  return data ?? [];
}

/**
 * Award points for completing a round
 * Checks loyalty config and awards appropriate points
 */
export async function awardRoundCompletionPoints(
  userId: string,
  roundId: string,
  grossScore: number,
  coursePar: number
): Promise<number> {
  const config = await getLoyaltyConfig();
  if (!config) return 0;

  let totalPoints = 0;
  const transactions: LoyaltyTransactionInsert[] = [];

  // Round completed points
  if (config.round_completed.enabled && config.round_completed.points > 0) {
    transactions.push({
      user_id: userId,
      points: config.round_completed.points,
      transaction_type: 'round_completed',
      description: 'Points for completing 18 holes',
      reference_id: roundId,
    });
    totalPoints += config.round_completed.points;
  }

  // Under par bonus
  if (config.round_under_par.enabled && grossScore < coursePar && config.round_under_par.points > 0) {
    transactions.push({
      user_id: userId,
      points: config.round_under_par.points,
      transaction_type: 'round_under_par',
      description: `Bonus for scoring ${coursePar - grossScore} under par`,
      reference_id: roundId,
    });
    totalPoints += config.round_under_par.points;
  }

  // Process all transactions
  for (const transaction of transactions) {
    await addLoyaltyTransaction(transaction);
  }

  return totalPoints;
}

// ============================================
// GEOFENCE ZONE HELPERS
// ============================================

/**
 * Get Hole 1 Tee zone for auto-start
 */
export async function getHole1TeeZone(): Promise<GeofenceZone | null> {
  if (!isConfigured()) return null;

  return supabaseRequest<GeofenceZone>('geofence_zones', {
    query: {
      zone_type: 'eq.hole_tee',
      hole_number: 'eq.1',
      is_active: 'eq.true',
    },
    single: true,
  });
}

// ============================================
// GM ANNOUNCEMENTS
// ============================================

/**
 * Raw GM announcement settings (for admin — includes disabled drafts and placeholder config)
 */
export async function getGMAnnouncementSettings(): Promise<GMAnnouncement> {
  const defaults = getDefaultGMAnnouncementSettings();
  if (!isConfigured()) return defaults;

  const data = await supabaseRequest<AppSetting>('app_settings', {
    query: { setting_key: 'eq.gm_announcements' },
    single: true,
  });

  if (!data) return defaults;

  return {
    ...defaults,
    ...(data.setting_value as unknown as GMAnnouncement),
  };
}

/**
 * Get the announcement banner to show members (custom or placeholder)
 */
export async function getGMAnnouncement(): Promise<GMAnnouncement | null> {
  const settings = await getGMAnnouncementSettings();

  if (settings.enabled && settings.message?.trim()) {
    if (settings.expires_at) {
      const expiresAt = new Date(settings.expires_at);
      if (expiresAt < new Date()) {
        // Fall through to placeholder if custom announcement expired
      } else {
        return settings;
      }
    } else {
      return settings;
    }
  }

  return null;
}

/**
 * Update GM announcement (manager/admin only)
 */
export async function updateGMAnnouncement(
  announcement: Partial<GMAnnouncement>
): Promise<boolean> {
  if (!isConfigured()) return false;

  const current = await getGMAnnouncementSettings();
  const updated = { ...current, ...announcement };

  const result = await supabaseRequest('app_settings', {
    method: 'PATCH',
    query: { setting_key: 'eq.gm_announcements' },
    body: {
      setting_value: updated,
      updated_at: new Date().toISOString(),
    },
  });

  return result !== null;
}

/**
 * Fetch turn break messaging shown on scorecard and home hub
 */
export async function getTurnMessaging(): Promise<TurnMessagingSettings> {
  if (!isConfigured()) return getDefaultTurnMessagingSettings();

  const data = await supabaseRequest<AppSetting>('app_settings', {
    query: { setting_key: 'eq.turn_messaging' },
    single: true,
  });

  if (!data) return getDefaultTurnMessagingSettings();

  return {
    ...getDefaultTurnMessagingSettings(),
    ...(data.setting_value as unknown as TurnMessagingSettings),
  };
}

/**
 * Update turn messaging with auth
 */
export async function updateTurnMessagingAuth(
  messaging: Partial<TurnMessagingSettings>,
  accessToken: string
): Promise<boolean> {
  const current = await getTurnMessaging();
  const updated = { ...current, ...messaging };

  const existing = await supabaseRequest<AppSetting>('app_settings', {
    query: { setting_key: 'eq.turn_messaging' },
    single: true,
  });

  if (existing) {
    const result = await authenticatedRequest('app_settings', accessToken, {
      method: 'PATCH',
      query: { setting_key: 'eq.turn_messaging' },
      body: {
        setting_value: updated,
        updated_at: new Date().toISOString(),
      },
    });
    return result !== null;
  }

  const result = await authenticatedRequest('app_settings', accessToken, {
    method: 'POST',
    body: {
      setting_key: 'turn_messaging',
      setting_value: updated,
      description: 'Built-in turn break copy shown on scorecard and home hub',
    },
  });

  return result !== null;
}

// ============================================
// AD ROTATION SETTINGS
// ============================================

export function getDefaultAdRotationSettings(): AdRotationSettings {
  return {
    enabled: false,
    interval_seconds: 12,
  };
}

export async function getAdRotationSettings(): Promise<AdRotationSettings> {
  if (!isConfigured()) return getDefaultAdRotationSettings();

  const data = await supabaseRequest<AppSetting>('app_settings', {
    query: { setting_key: 'eq.ad_rotation' },
    single: true,
  });

  if (!data) return getDefaultAdRotationSettings();

  const value = data.setting_value as unknown as AdRotationSettings;
  return {
    ...getDefaultAdRotationSettings(),
    ...value,
    interval_seconds: Math.min(60, Math.max(8, value.interval_seconds ?? 12)),
  };
}

export async function updateAdRotationSettingsAuth(
  settings: AdRotationSettings,
  accessToken: string
): Promise<boolean> {
  const body: AdRotationSettings = {
    enabled: settings.enabled,
    interval_seconds: Math.min(60, Math.max(8, settings.interval_seconds)),
  };

  const existing = await supabaseRequest<AppSetting>('app_settings', {
    query: { setting_key: 'eq.ad_rotation' },
    single: true,
  });

  if (existing) {
    const result = await authenticatedRequest('app_settings', accessToken, {
      method: 'PATCH',
      query: { setting_key: 'eq.ad_rotation' },
      body: {
        setting_value: body,
        updated_at: new Date().toISOString(),
      },
    });
    return result !== null;
  }

  const result = await authenticatedRequest('app_settings', accessToken, {
    method: 'POST',
    body: {
      setting_key: 'ad_rotation',
      setting_value: body,
      description: 'Rotate sponsor ads when multiple active ads share the same placement slot',
    },
  });

  return result !== null;
}

export const AD_ROTATION_INTERVAL_OPTIONS = [8, 12, 15, 20, 30] as const;

// ============================================
// AUTHENTICATION
// ============================================

interface AuthSession {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    email: string;
  };
}

interface AuthResponse {
  success: boolean;
  session?: AuthSession;
  user?: AuthSession['user'];
  error?: string;
}

/**
 * Sign in with email and password
 */
export async function signIn(email: string, password: string): Promise<AuthResponse> {
  if (!isConfigured()) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: supabaseAnonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error_description || data.msg || 'Login failed' };
    }

    return {
      success: true,
      session: {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        user: data.user,
      },
      user: data.user,
    };
  } catch (err) {
    console.log('[Supabase] Sign in error:', err);
    return { success: false, error: 'Network error' };
  }
}

const LOCAL_DEV_RESET_URL = 'http://localhost:8081/reset-password';
const PRODUCTION_RESET_URL = 'https://www.foxcreek.golf/reset-password';

/**
 * URL Supabase should redirect to after the user clicks the reset link in email.
 * Override with EXPO_PUBLIC_PASSWORD_RESET_REDIRECT_URL for local testing.
 */
export function getPasswordResetRedirectUrl(): string {
  const override = process.env.EXPO_PUBLIC_PASSWORD_RESET_REDIRECT_URL?.trim();
  if (override) return override;

  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/reset-password`;
  }

  if (__DEV__) {
    return LOCAL_DEV_RESET_URL;
  }

  return PRODUCTION_RESET_URL;
}

export type AuthLinkTokens = {
  accessToken: string;
  refreshToken: string | null;
};

function parseAuthLinkParams(url: string): URLSearchParams | null {
  try {
    const parsed = new URL(url);
    if (parsed.hash) {
      return new URLSearchParams(parsed.hash.substring(1));
    }
    if (parsed.search) {
      return parsed.searchParams;
    }
  } catch {
    // Invalid URL
  }
  return null;
}

function isAuthLinkType(type: string | null): boolean {
  return type === 'recovery' || type === 'invite' || type === 'signup';
}

/**
 * Parse access + refresh tokens from a Supabase recovery or invite link.
 */
export function parseAuthTokensFromUrl(url: string): AuthLinkTokens | null {
  const params = parseAuthLinkParams(url);
  if (!params) return null;

  const accessToken = params.get('access_token');
  const type = params.get('type');
  if (!accessToken || !isAuthLinkType(type)) return null;

  return {
    accessToken,
    refreshToken: params.get('refresh_token'),
  };
}

/**
 * Parse a Supabase recovery or invite link for the access token (hash or query params).
 */
export function parseRecoveryTokenFromUrl(url: string): string | null {
  return parseAuthTokensFromUrl(url)?.accessToken ?? null;
}

export function parseInviteTokenFromUrl(url: string): string | null {
  return parseRecoveryTokenFromUrl(url);
}

/** Route for a Supabase email auth link (recovery → reset, invite → accept). */
export function getAuthCallbackRouteFromUrl(url: string): '/reset-password' | '/accept-invite' | null {
  try {
    const parsed = new URL(url);
    const params = parsed.hash
      ? new URLSearchParams(parsed.hash.substring(1))
      : parsed.searchParams;
    const token = params.get('access_token');
    const type = params.get('type');
    if (!token) return null;
    if (type === 'recovery') return '/reset-password';
    if (type === 'invite' || type === 'signup') return '/accept-invite';
  } catch {
    // Invalid URL
  }
  return null;
}

/**
 * Send a password reset email via the backend (Resend), avoiding Supabase SMTP rate limits.
 */
export async function requestPasswordReset(
  email: string,
  redirectTo?: string
): Promise<{ success: boolean; error?: string; redirectTo?: string }> {
  if (!isConfigured()) {
    return { success: false, error: 'Supabase not configured' };
  }

  const resetRedirectUrl = redirectTo ?? getPasswordResetRedirectUrl();

  if (__DEV__) {
    console.log('[Supabase] Password reset redirect:', resetRedirectUrl);
  }

  const { getBackendUrl, isLocalhostBackendUrl } = await import('./backend-url');
  const backendUrl = getBackendUrl();

  try {
    const response = await fetch(`${backendUrl}/api/auth/request-password-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), redirectTo: resetRedirectUrl }),
    });

    const data = (await response.json().catch(() => ({}))) as { error?: string };

    if (response.ok) {
      return { success: true, redirectTo: resetRedirectUrl };
    }

    return {
      success: false,
      error: data.error ?? 'Failed to send reset email',
    };
  } catch (err) {
    console.log('[Supabase] Backend password reset request error:', err);

    if (__DEV__ && isLocalhostBackendUrl(backendUrl)) {
      return requestPasswordResetViaSupabase(email, resetRedirectUrl);
    }

    return { success: false, error: 'Could not reach password reset service. Try again shortly.' };
  }
}

async function requestPasswordResetViaSupabase(
  email: string,
  resetRedirectUrl: string
): Promise<{ success: boolean; error?: string; redirectTo?: string }> {
  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/recover`, {
      method: 'POST',
      headers: {
        apikey: supabaseAnonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, redirect_to: resetRedirectUrl }),
    });

    if (!response.ok) {
      const data = await response.json();
      return {
        success: false,
        error: data.error_description || data.msg || 'Failed to send reset email',
      };
    }

    return { success: true, redirectTo: resetRedirectUrl };
  } catch (err) {
    console.log('[Supabase] Password reset request error:', err);
    return { success: false, error: 'Network error' };
  }
}

/**
 * Set a new password using a recovery or invite access token from the email link.
 */
export async function updatePasswordWithRecoveryToken(
  accessToken: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  if (!isConfigured()) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error_description || data.msg || 'Failed to reset password',
      };
    }

    return { success: true };
  } catch (err) {
    console.log('[Supabase] Password update error:', err);
    return { success: false, error: 'Network error' };
  }
}

/**
 * Refresh an expired session using a refresh token.
 */
export async function refreshAuthSession(refreshToken: string): Promise<AuthResponse> {
  if (!isConfigured()) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        apikey: supabaseAnonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error_description || data.msg || 'Session refresh failed',
      };
    }

    return {
      success: true,
      session: {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        user: data.user,
      },
      user: data.user,
    };
  } catch (err) {
    console.log('[Supabase] Refresh session error:', err);
    return { success: false, error: 'Network error' };
  }
}

/**
 * Sign out (client-side only - just clear tokens)
 */
export async function signOut(accessToken: string): Promise<boolean> {
  if (!isConfigured()) return false;

  try {
    await fetch(`${supabaseUrl}/auth/v1/logout`, {
      method: 'POST',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Record that the member opened the portal via Sign In (not reset/invite links alone).
 */
export async function recordMemberSignIn(
  userId: string,
  accessToken: string
): Promise<boolean> {
  if (!isConfigured()) return false;

  const now = new Date().toISOString();

  try {
    const url = new URL(`${supabaseUrl}/rest/v1/user_profiles`);
    url.searchParams.append('id', `eq.${userId}`);

    const response = await fetch(url.toString(), {
      method: 'PATCH',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        last_member_sign_in_at: now,
        updated_at: now,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log('[Supabase] Failed to record member sign-in:', response.status, errorText);
      return false;
    }

    return true;
  } catch (err) {
    console.log('[Supabase] Failed to record member sign-in:', err);
    return false;
  }
}

/**
 * Get user profile with auth token
 */
export async function getAuthenticatedUserProfile(
  userId: string,
  accessToken: string
): Promise<UserProfile | null> {
  if (!isConfigured()) return null;

  try {
    const url = new URL(`${supabaseUrl}/rest/v1/user_profiles`);
    url.searchParams.append('id', `eq.${userId}`);

    const response = await fetch(url.toString(), {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.pgrst.object+json',
      },
    });

    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

/**
 * Make authenticated request to Supabase
 */
async function authenticatedRequest<T>(
  table: string,
  accessToken: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    query?: Record<string, string>;
    body?: Record<string, unknown>;
    single?: boolean;
  } = {}
): Promise<T | null> {
  if (!isConfigured()) return null;

  const { method = 'GET', query = {}, body, single = false } = options;

  const url = new URL(`${supabaseUrl}/rest/v1/${table}`);
  Object.entries(query).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  const headers: Record<string, string> = {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };

  if (single) {
    headers['Accept'] = 'application/vnd.pgrst.object+json';
  }

  try {
    const response = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

/**
 * Update geofence settings with auth
 */
export async function updateGeofenceSettingsAuth(
  settings: Partial<GeofenceSettings>,
  accessToken: string
): Promise<boolean> {
  const current = await getGeofenceSettings();
  const updated = { ...current, ...settings };

  const result = await authenticatedRequest('app_settings', accessToken, {
    method: 'PATCH',
    query: { setting_key: 'eq.geofence_tracking' },
    body: {
      setting_value: updated,
      updated_at: new Date().toISOString(),
    },
  });

  return result !== null;
}

/**
 * Update GM announcement with auth
 */
export async function updateGMAnnouncementAuth(
  announcement: Partial<GMAnnouncement>,
  accessToken: string
): Promise<boolean> {
  const current = await getGMAnnouncementSettings();
  const updated = { ...current, ...announcement };

  const result = await authenticatedRequest('app_settings', accessToken, {
    method: 'PATCH',
    query: { setting_key: 'eq.gm_announcements' },
    body: {
      setting_value: updated,
      updated_at: new Date().toISOString(),
    },
  });

  return result !== null;
}

// ============================================
// TOURNAMENT FORMAT RULES
// ============================================

export async function getTournamentFormatsSettings(): Promise<TournamentFormatsSettings> {
  if (!isConfigured()) return getDefaultTournamentFormatsSettings();

  const data = await supabaseRequest<AppSetting>('app_settings', {
    query: { setting_key: 'eq.tournament_formats' },
    single: true,
  });

  if (!data) return getDefaultTournamentFormatsSettings();

  return mergeTournamentFormatsSettings(data.setting_value as Partial<TournamentFormatsSettings>);
}

export async function updateTournamentFormatsSettingsAuth(
  settings: TournamentFormatsSettings,
  accessToken: string
): Promise<boolean> {
  const existing = await supabaseRequest<AppSetting>('app_settings', {
    query: { setting_key: 'eq.tournament_formats' },
    single: true,
  });

  if (existing) {
    const result = await authenticatedRequest('app_settings', accessToken, {
      method: 'PATCH',
      query: { setting_key: 'eq.tournament_formats' },
      body: {
        setting_value: settings,
        updated_at: new Date().toISOString(),
      },
    });
    return result !== null;
  }

  const result = await authenticatedRequest('app_settings', accessToken, {
    method: 'POST',
    body: {
      setting_key: 'tournament_formats',
      setting_value: settings,
      description: 'Tournament format rules and instructions for match setup and scoring',
    },
  });

  return result !== null;
}

/**
 * Get all members (admin only)
 */
export async function getAllMembers(accessToken: string): Promise<UserProfile[]> {
  const data = await authenticatedRequest<UserProfile[]>('user_profiles', accessToken, {
    query: { order: 'full_name.asc' },
  });
  return data ?? [];
}
