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

export type AdPlacementType =
  | 'scorecard_header'
  | 'hole_sponsor'
  | 'the_turn'
  | 'leaderboard';

export interface AdPlacement {
  id: string;
  sponsor_name: string;
  placement_type: AdPlacementType;
  hole_number: number | null;
  image_url: string;
  banner_text: string;
  action_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
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

// ============================================
// TOURNAMENTS
// ============================================

export type TournamentFormat = 'scramble' | 'best_ball' | 'alternate_shot' | 'singles';

/** One calendar day; may include multiple rounds (e.g. AM scramble + PM singles). */
export interface TournamentDaySchedule {
  formats: TournamentFormat[];
}

export type TournamentTeamSide = 'side_a' | 'side_b';

export type TournamentMatchHoleWinner = 'side_a' | 'side_b' | 'tie';

export interface Tournament {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  round_schedule: TournamentDaySchedule[];
  rounds_count: number;
  /** Players from each team in a foursome (default 2 = 2v2). */
  players_per_match: number;
  created_at: string;
}

export interface TournamentInsert {
  name: string;
  start_date: string;
  end_date: string;
  round_schedule: TournamentDaySchedule[];
  rounds_count: number;
  players_per_match?: number;
}

export interface TournamentTeam {
  id: string;
  tournament_id: string;
  team_name: string;
  side: TournamentTeamSide | null;
  player_ids: string[];
}

export interface TournamentTeamInsert {
  tournament_id: string;
  team_name: string;
  side: TournamentTeamSide;
  player_ids: string[];
}

export interface TournamentPlayer {
  id: string;
  tournament_id: string;
  display_name: string;
  handicap_index: number | null;
  user_id: string | null;
  created_at: string;
}

export interface TournamentPlayerInsert {
  tournament_id: string;
  display_name: string;
  handicap_index?: number | null;
  user_id?: string | null;
}

export interface TournamentHoleScore {
  hole: number;
  par: number;
  gross: number;
  net: number;
}

export interface TournamentScore {
  id: string;
  tournament_id: string;
  team_id: string | null;
  user_id: string | null;
  tournament_player_id: string | null;
  match_group_id: string | null;
  round_number: number;
  hole_scores: TournamentHoleScore[];
  total_gross: number;
  total_net: number;
  created_at: string;
}

export interface TournamentScoreInsert {
  tournament_id: string;
  team_id?: string | null;
  user_id?: string | null;
  tournament_player_id?: string | null;
  match_group_id?: string | null;
  round_number: number;
  hole_scores: TournamentHoleScore[];
  total_gross: number;
  total_net: number;
}

/** One tee-time foursome: 2 players from side A vs 2 from side B. */
export interface TournamentMatchGroup {
  id: string;
  tournament_id: string;
  round_number: number;
  format: TournamentFormat;
  side_a_team_id: string;
  side_b_team_id: string;
  side_a_player_ids: string[];
  side_b_player_ids: string[];
  tee_time: string;
  starting_hole: number;
  group_number: number;
  notes: string | null;
  created_at: string;
}

export interface TournamentMatchGroupInsert {
  tournament_id: string;
  round_number: number;
  format: TournamentFormat;
  side_a_team_id: string;
  side_b_team_id: string;
  side_a_player_ids: string[];
  side_b_player_ids: string[];
  tee_time: string;
  starting_hole?: number;
  group_number?: number;
  notes?: string | null;
}

export interface TournamentMatchHoleResult {
  id: string;
  match_group_id: string;
  round_number: number;
  hole: number;
  side_a_net: number;
  side_b_net: number;
  hole_winner: TournamentMatchHoleWinner;
}

export interface TournamentTeeAssignment {
  id: string;
  tournament_id: string;
  round_number: number;
  team_id: string | null;
  user_id: string | null;
  tee_time: string;
  starting_hole: number;
  notes: string | null;
  created_at: string;
}

export interface TournamentTeeAssignmentInsert {
  tournament_id: string;
  round_number: number;
  team_id?: string | null;
  user_id?: string | null;
  tee_time: string;
  starting_hole?: number;
  notes?: string | null;
}

// ============================================
// WAGERING / SIDE GAMES
// ============================================

export type WageringGameType = 'skins' | 'stableford_points';

export interface SkinsSettings {
  carryover: boolean;
  value_per_skin?: number;
}

export interface StablefordPointValues {
  eagle?: number;
  birdie?: number;
  par?: number;
  bogey?: number;
  double_bogey?: number;
  worse?: number;
}

export interface StablefordSettings {
  point_values: StablefordPointValues;
}

export type WageringSettings = SkinsSettings | StablefordSettings;

export interface SkinsHoleResult {
  hole: number;
  winner_ids: string[];
  skin_value: number;
  carryover: number;
  scores: Record<string, number>;
}

export interface SkinsResults {
  holes: SkinsHoleResult[];
  balances: Record<string, number>;
}

export interface StablefordHoleResult {
  hole: number;
  points: Record<string, number>;
}

export interface StablefordResults {
  holes: StablefordHoleResult[];
  totals: Record<string, number>;
}

export type WageringResults = SkinsResults | StablefordResults;

export interface WageringSession {
  id: string;
  round_id: string | null;
  tournament_id: string | null;
  game_type: WageringGameType;
  settings: WageringSettings;
  results: WageringResults;
  created_at: string;
}

export interface WageringSessionInsert {
  round_id?: string | null;
  tournament_id?: string | null;
  game_type: WageringGameType;
  settings?: WageringSettings;
  results?: WageringResults;
}
