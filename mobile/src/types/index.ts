// Golf Course Types

export interface Coordinates {
  lat: number;
  lng: number;
}

// ============================================
// SUPABASE DATABASE TYPES
// ============================================

export type UserRole = 'member' | 'manager' | 'super_admin';

export interface UserProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: UserRole;
  club_id: string | null;
  location_tracking_enabled: boolean;
  handicap_index: number | null;
  loyalty_points: number;
  handicap_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GeofenceSettings {
  enabled: boolean;
  check_in_enabled: boolean;
  tee_time_alerts: boolean;
  turn_prompt_enabled: boolean;
}

export interface AppSetting {
  id: string;
  setting_key: string;
  setting_value: GeofenceSettings | Record<string, unknown>;
  description: string | null;
  updated_by: string | null;
  updated_at: string;
  created_at: string;
}

export interface GeofenceZone {
  id: string;
  zone_name: string;
  zone_type: 'clubhouse' | 'range' | 'canteen' | 'hole_green' | 'hole_tee';
  hole_number: number | null;
  latitude: number;
  longitude: number;
  radius_meters: number;
  trigger_action: 'check_in' | 'tee_alert' | 'fnb_prompt' | 'auto_start' | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TeeTime {
  id: string;
  user_id: string;
  tee_time: string;
  course_id: string | null;
  chronogolf_booking_id: string | null;
  players: number;
  status: 'confirmed' | 'pending' | 'cancelled';
  created_at: string;
}

// ============================================
// GEOFENCE TRIGGER TYPES
// ============================================

export type GeofenceTrigger =
  | { type: 'check_in'; zone: GeofenceZone }
  | { type: 'tee_alert'; zone: GeofenceZone; minutesUntilTeeTime: number }
  | { type: 'fnb_prompt'; zone: GeofenceZone; holeNumber: number }
  | { type: 'auto_start'; zone: GeofenceZone }
  | { type: 'none' };

export interface Geofence {
  name: string;
  coords: Coordinates;
  radiusMeters: number;
}

export interface TeeBox {
  name: 'Black' | 'Blue' | 'White' | 'Green' | 'Red';
  yards: number;
}

export interface HoleData {
  holeNumber: number;
  par: number;
  handicapIndex: number;
  teeBoxes: TeeBox[];
  teeBoxCoords: Coordinates; // Placeholder - fill in with exact GPS
  greenCoords: Coordinates; // Placeholder - fill in with exact GPS
}

export interface TeeRating {
  name: string;
  yards: number;
  mensRating: number;
  mensSlope: number;
  womensRating: number;
  womensSlope: number;
}

export interface CourseData {
  name: string;
  address: string;
  phone: string;
  par: number;
  holes: number;
  designer: string;
  yearOpened: number;
  teeRatings: TeeRating[];
  geofences: Geofence[];
  holeData: HoleData[];
}

export type MemberStatus = 'At Range' | 'On Course' | 'At Clubhouse' | 'At Canteen' | 'Away';

export interface MemberProfile {
  id: string;
  name: string;
  email: string;
  memberNumber: string;
  loyaltyPoints: number;
  handicap: number;
  currentStatus: MemberStatus;
  preferredTee?: 'Black' | 'Blue' | 'White' | 'Green' | 'Red';
  joinedDate: string;
}

// ============================================
// ROUNDS & HANDICAP TYPES
// ============================================

export type TeeName = 'Black' | 'Blue' | 'White' | 'Green' | 'Red';

export interface HoleScore {
  hole: number;
  par: number;
  score: number | null;
  adjustedScore?: number; // ESC adjusted for handicap
}

export interface Round {
  id: string;
  user_id: string;
  course_id: string;
  played_at: string;
  tee_played: TeeName;
  gross_score: number;
  adjusted_score: number | null;
  course_rating: number;
  slope_rating: number;
  differential: number | null;
  scores: HoleScore[];
  duration_seconds: number | null;
  weather_conditions: string | null;
  created_at: string;
}

export interface RoundInsert {
  user_id: string;
  course_id?: string;
  played_at?: string;
  tee_played: TeeName;
  gross_score: number;
  adjusted_score: number;
  course_rating: number;
  slope_rating: number;
  differential: number;
  scores: HoleScore[];
  duration_seconds?: number;
  weather_conditions?: string;
}

// ============================================
// LOYALTY POINTS TYPES
// ============================================

export type LoyaltyTransactionType =
  | 'round_completed'
  | 'round_under_par'
  | 'eagle_bonus'
  | 'birdie_bonus'
  | 'hole_in_one'
  | 'first_round_bonus'
  | 'milestone_10_rounds'
  | 'milestone_25_rounds'
  | 'milestone_50_rounds'
  | 'redemption_proshop'
  | 'redemption_fnb'
  | 'redemption_greenfee'
  | 'redemption_lesson'
  | 'admin_adjustment'
  | 'expiration';

export interface LoyaltyTransaction {
  id: string;
  user_id: string;
  points: number;
  transaction_type: LoyaltyTransactionType;
  description: string | null;
  reference_id: string | null;
  created_at: string;
}

export interface LoyaltyTransactionInsert {
  user_id: string;
  points: number;
  transaction_type: LoyaltyTransactionType;
  description?: string;
  reference_id?: string;
}

export interface LoyaltyPointRule {
  enabled: boolean;
  points: number;
  description: string;
}

export interface LoyaltyConfig {
  round_completed: LoyaltyPointRule;
  round_under_par: LoyaltyPointRule;
  eagle_bonus: LoyaltyPointRule;
  birdie_bonus: LoyaltyPointRule;
  hole_in_one: LoyaltyPointRule;
  first_round_bonus: LoyaltyPointRule;
  milestone_10_rounds: LoyaltyPointRule;
  milestone_25_rounds: LoyaltyPointRule;
  milestone_50_rounds: LoyaltyPointRule;
}

export interface RedemptionConfig {
  points_per_dollar: number;
  minimum_redemption: number;
  maximum_redemption_per_transaction: number;
  expiration_months: number | null;
}

// ============================================
// GM ANNOUNCEMENTS
// ============================================

export type AnnouncementType = 'info' | 'warning' | 'alert';

export interface GMAnnouncement {
  enabled: boolean;
  title: string;
  message: string;
  type: AnnouncementType;
  expires_at: string | null;
}

// ============================================
// SOCIAL FEATURES
// ============================================

export type LeaderboardPeriod = 'weekly' | 'monthly' | 'all_time';
export type LeaderboardScoreType = 'gross' | 'net';

export interface LeaderboardEntry {
  user_id: string;
  full_name: string;
  handicap_index: number | null;
  rounds_played: number;
  best_gross: number | null;
  best_net: number | null;
  average_score: number | null;
  total_differential: number | null;
}

export interface LookingForGame {
  id: string;
  user_id: string;
  full_name: string;
  handicap_index: number | null;
  preferred_date: string;
  preferred_time: 'morning' | 'midday' | 'afternoon' | 'any';
  notes: string | null;
  is_active: boolean;
  created_at: string;
  expires_at: string;
}

export interface LookingForGameInsert {
  user_id: string;
  preferred_date: string;
  preferred_time: 'morning' | 'midday' | 'afternoon' | 'any';
  notes?: string;
  expires_at?: string;
}

export type ChallengeStatus = 'pending' | 'accepted' | 'declined' | 'completed' | 'expired';

export interface Challenge {
  id: string;
  challenger_id: string;
  challenger_name: string;
  challenged_id: string;
  challenged_name: string;
  round_date: string;
  challenge_type: 'gross' | 'net';
  status: ChallengeStatus;
  challenger_score: number | null;
  challenged_score: number | null;
  winner_id: string | null;
  message: string | null;
  created_at: string;
  expires_at: string;
}

export interface ChallengeInsert {
  challenger_id: string;
  challenged_id: string;
  round_date: string;
  challenge_type: 'gross' | 'net';
  message?: string;
}

// ============================================
// COURSE CONDITION REPORTS
// ============================================

export type ReportType = 'wet_bunker' | 'damaged_turf' | 'fallen_tree' | 'drainage_issue' | 'other';
export type ReportStatus = 'pending' | 'in_progress' | 'resolved' | 'dismissed';
export type CourseArea = 'fairway' | 'green' | 'bunker' | 'tee_box' | 'rough' | 'cart_path' | 'other';

export interface CourseReport {
  id: string;
  user_id: string;
  reporter_name: string;
  hole_number: number | null;
  area: CourseArea;
  report_type: ReportType;
  description: string;
  photo_url: string | null;
  latitude: number | null;
  longitude: number | null;
  status: ReportStatus;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface CourseReportInsert {
  user_id: string;
  reporter_name: string;
  hole_number?: number;
  area: CourseArea;
  report_type: ReportType;
  description: string;
  photo_url?: string;
  latitude?: number;
  longitude?: number;
}
