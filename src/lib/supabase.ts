/**
 * Supabase REST API Client
 * Uses fetch instead of @supabase/supabase-js to avoid native dependencies
 */

import type {
  AppSetting,
  GeofenceSettings,
  GeofenceZone,
  GMAnnouncement,
  LoyaltyConfig,
  LoyaltyTransaction,
  LoyaltyTransactionInsert,
  Round,
  RoundInsert,
  TeeTime,
  UserProfile,
} from '@/types';

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
 * Get current GM announcement
 */
export async function getGMAnnouncement(): Promise<GMAnnouncement | null> {
  if (!isConfigured()) return null;

  const data = await supabaseRequest<AppSetting>('app_settings', {
    query: { setting_key: 'eq.gm_announcements' },
    single: true,
  });

  if (!data) return null;

  const announcement = data.setting_value as unknown as GMAnnouncement;

  // Check if announcement is enabled and not expired
  if (!announcement.enabled) return null;

  if (announcement.expires_at) {
    const expiresAt = new Date(announcement.expires_at);
    if (expiresAt < new Date()) return null;
  }

  // Only return if there's a message
  if (!announcement.message || announcement.message.trim() === '') return null;

  return announcement;
}

/**
 * Update GM announcement (manager/admin only)
 */
export async function updateGMAnnouncement(
  announcement: Partial<GMAnnouncement>
): Promise<boolean> {
  if (!isConfigured()) return false;

  const current = await getGMAnnouncement();
  const updated = {
    enabled: false,
    title: '',
    message: '',
    type: 'info',
    expires_at: null,
    ...current,
    ...announcement,
  };

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
  // Get current or use defaults
  const currentData = await supabaseRequest<AppSetting>('app_settings', {
    query: { setting_key: 'eq.gm_announcements' },
    single: true,
  });

  const current = currentData?.setting_value as GMAnnouncement | undefined;

  const updated = {
    enabled: false,
    title: '',
    message: '',
    type: 'info' as const,
    expires_at: null,
    ...current,
    ...announcement,
  };

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

/**
 * Get all members (admin only)
 */
export async function getAllMembers(accessToken: string): Promise<UserProfile[]> {
  const data = await authenticatedRequest<UserProfile[]>('user_profiles', accessToken, {
    query: { order: 'full_name.asc' },
  });
  return data ?? [];
}
