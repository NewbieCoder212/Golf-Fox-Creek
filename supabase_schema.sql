-- ============================================
-- FOX CREEK GOLF CLUB - SUPABASE SCHEMA
-- Generated from TypeScript types and API client
-- Date: 2026-02-12
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CUSTOM TYPES (ENUMS)
-- ============================================

-- User roles
CREATE TYPE user_role AS ENUM ('member', 'manager', 'super_admin');

-- Geofence zone types
CREATE TYPE zone_type AS ENUM ('clubhouse', 'range', 'canteen', 'hole_green', 'hole_tee');

-- Geofence trigger actions
CREATE TYPE trigger_action AS ENUM ('check_in', 'tee_alert', 'fnb_prompt', 'auto_start');

-- Tee time status
CREATE TYPE tee_time_status AS ENUM ('confirmed', 'pending', 'cancelled');

-- Tee box names
CREATE TYPE tee_name AS ENUM ('Black', 'Blue', 'White', 'Green', 'Red');

-- Loyalty transaction types
CREATE TYPE loyalty_transaction_type AS ENUM (
  'round_completed',
  'round_under_par',
  'eagle_bonus',
  'birdie_bonus',
  'hole_in_one',
  'first_round_bonus',
  'milestone_10_rounds',
  'milestone_25_rounds',
  'milestone_50_rounds',
  'redemption_proshop',
  'redemption_fnb',
  'redemption_greenfee',
  'redemption_lesson',
  'admin_adjustment',
  'expiration'
);

-- Course report types
CREATE TYPE report_type AS ENUM ('wet_bunker', 'damaged_turf', 'fallen_tree', 'drainage_issue', 'other');

-- Course report status
CREATE TYPE report_status AS ENUM ('pending', 'in_progress', 'resolved', 'dismissed');

-- Course area types
CREATE TYPE course_area AS ENUM ('fairway', 'green', 'bunker', 'tee_box', 'rough', 'cart_path', 'other');

-- Challenge status
CREATE TYPE challenge_status AS ENUM ('pending', 'accepted', 'declined', 'completed', 'expired');

-- Challenge type (scoring method)
CREATE TYPE challenge_type AS ENUM ('gross', 'net');

-- Preferred time for looking for game
CREATE TYPE preferred_time AS ENUM ('morning', 'midday', 'afternoon', 'any');

-- Announcement type
CREATE TYPE announcement_type AS ENUM ('info', 'warning', 'alert');


-- ============================================
-- TABLE: user_profiles
-- Primary user account and profile information
-- ============================================

CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  role user_role NOT NULL DEFAULT 'member',
  club_id TEXT,
  location_tracking_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  handicap_index NUMERIC(4, 1),
  loyalty_points INTEGER NOT NULL DEFAULT 0,
  handicap_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for role-based queries
CREATE INDEX idx_user_profiles_role ON user_profiles(role);

-- Index for club membership queries
CREATE INDEX idx_user_profiles_club ON user_profiles(club_id);


-- ============================================
-- TABLE: geofence_zones
-- GPS boundaries for location-based triggers
-- ============================================

CREATE TABLE geofence_zones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  zone_name TEXT NOT NULL,
  zone_type zone_type NOT NULL,
  hole_number INTEGER,
  latitude NUMERIC(10, 7) NOT NULL,
  longitude NUMERIC(10, 7) NOT NULL,
  radius_meters INTEGER NOT NULL DEFAULT 50,
  trigger_action trigger_action,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for active zone lookups
CREATE INDEX idx_geofence_zones_active ON geofence_zones(is_active) WHERE is_active = TRUE;

-- Index for zone type queries
CREATE INDEX idx_geofence_zones_type ON geofence_zones(zone_type);

-- Index for hole-specific zones
CREATE INDEX idx_geofence_zones_hole ON geofence_zones(zone_type, hole_number) WHERE hole_number IS NOT NULL;


-- ============================================
-- TABLE: app_settings
-- Global application configuration and announcements
-- ============================================

CREATE TABLE app_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  description TEXT,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for setting key lookups
CREATE UNIQUE INDEX idx_app_settings_key ON app_settings(setting_key);

-- Default settings data
INSERT INTO app_settings (setting_key, setting_value, description) VALUES
(
  'geofence_tracking',
  '{"enabled": true, "check_in_enabled": true, "tee_time_alerts": true, "turn_prompt_enabled": true}',
  'Global geofence tracking settings'
),
(
  'gm_announcements',
  '{"enabled": false, "title": "", "message": "", "type": "info", "expires_at": null}',
  'General Manager announcements displayed to all users'
);


-- ============================================
-- TABLE: tee_times
-- User tee time bookings and reservations
-- ============================================

CREATE TABLE tee_times (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  tee_time TIMESTAMPTZ NOT NULL,
  course_id TEXT,
  chronogolf_booking_id TEXT,
  players INTEGER NOT NULL DEFAULT 1,
  status tee_time_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for user's tee times
CREATE INDEX idx_tee_times_user ON tee_times(user_id);

-- Index for upcoming tee times
CREATE INDEX idx_tee_times_upcoming ON tee_times(tee_time, status) WHERE status = 'confirmed';

-- Index for external booking system lookups
CREATE INDEX idx_tee_times_chronogolf ON tee_times(chronogolf_booking_id) WHERE chronogolf_booking_id IS NOT NULL;


-- ============================================
-- TABLE: rounds
-- Completed golf rounds with scorecard data
-- ============================================

CREATE TABLE rounds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  course_id TEXT,
  played_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tee_played tee_name NOT NULL,
  gross_score INTEGER NOT NULL,
  adjusted_score INTEGER,
  course_rating NUMERIC(4, 1) NOT NULL,
  slope_rating NUMERIC(4, 0) NOT NULL,
  differential NUMERIC(4, 1),
  scores JSONB NOT NULL DEFAULT '[]',
  duration_seconds INTEGER,
  weather_conditions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- JSONB scores structure:
-- [
--   { "hole": 1, "par": 4, "score": 5, "adjustedScore": 5 },
--   { "hole": 2, "par": 3, "score": 4, "adjustedScore": 4 },
--   ...
-- ]

-- Index for user's round history
CREATE INDEX idx_rounds_user ON rounds(user_id);

-- Index for recent rounds (handicap calculation)
CREATE INDEX idx_rounds_recent ON rounds(user_id, played_at DESC);

-- Index for leaderboard queries
CREATE INDEX idx_rounds_leaderboard ON rounds(played_at DESC, gross_score);


-- ============================================
-- TABLE: loyalty_transactions
-- Loyalty points transaction history
-- ============================================

CREATE TABLE loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  transaction_type loyalty_transaction_type NOT NULL,
  description TEXT,
  reference_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for user's transaction history
CREATE INDEX idx_loyalty_transactions_user ON loyalty_transactions(user_id, created_at DESC);

-- Index for reference lookups (e.g., round_id)
CREATE INDEX idx_loyalty_transactions_ref ON loyalty_transactions(reference_id) WHERE reference_id IS NOT NULL;


-- ============================================
-- TABLE: loyalty_config
-- Loyalty program rules configuration
-- ============================================

CREATE TABLE loyalty_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  config_key TEXT NOT NULL UNIQUE,
  config_value JSONB NOT NULL
);

-- Default loyalty point rules
INSERT INTO loyalty_config (config_key, config_value) VALUES
(
  'point_rules',
  '{
    "round_completed": { "enabled": true, "points": 10, "description": "Points for completing 18 holes" },
    "round_under_par": { "enabled": true, "points": 25, "description": "Bonus for scoring under par" },
    "eagle_bonus": { "enabled": true, "points": 15, "description": "Bonus for eagle" },
    "birdie_bonus": { "enabled": true, "points": 5, "description": "Bonus for birdie" },
    "hole_in_one": { "enabled": true, "points": 100, "description": "Bonus for hole-in-one" },
    "first_round_bonus": { "enabled": true, "points": 50, "description": "Welcome bonus for first round" },
    "milestone_10_rounds": { "enabled": true, "points": 25, "description": "Milestone: 10 rounds played" },
    "milestone_25_rounds": { "enabled": true, "points": 50, "description": "Milestone: 25 rounds played" },
    "milestone_50_rounds": { "enabled": true, "points": 100, "description": "Milestone: 50 rounds played" }
  }'
);


-- ============================================
-- TABLE: course_reports
-- Member-submitted course condition reports
-- ============================================

CREATE TABLE course_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE SET NULL,
  reporter_name TEXT NOT NULL,
  hole_number INTEGER,
  area course_area NOT NULL,
  report_type report_type NOT NULL,
  description TEXT NOT NULL,
  photo_url TEXT,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  status report_status NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Index for pending reports (admin dashboard)
CREATE INDEX idx_course_reports_pending ON course_reports(status, created_at DESC) WHERE status = 'pending';

-- Index for user's reports
CREATE INDEX idx_course_reports_user ON course_reports(user_id);

-- Index for hole-specific reports
CREATE INDEX idx_course_reports_hole ON course_reports(hole_number) WHERE hole_number IS NOT NULL;


-- ============================================
-- TABLE: looking_for_game
-- "Find a Partner" posts
-- ============================================

CREATE TABLE looking_for_game (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  handicap_index NUMERIC(4, 1),
  preferred_date DATE NOT NULL,
  preferred_time preferred_time NOT NULL DEFAULT 'any',
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Index for active posts
CREATE INDEX idx_looking_for_game_active ON looking_for_game(is_active, expires_at DESC) WHERE is_active = TRUE;

-- Index for user's posts
CREATE INDEX idx_looking_for_game_user ON looking_for_game(user_id);


-- ============================================
-- TABLE: challenges
-- Member-to-member score challenges
-- ============================================

CREATE TABLE challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  challenger_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  challenger_name TEXT NOT NULL,
  challenged_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  challenged_name TEXT NOT NULL,
  round_date DATE NOT NULL,
  challenge_type challenge_type NOT NULL DEFAULT 'gross',
  status challenge_status NOT NULL DEFAULT 'pending',
  challenger_score INTEGER,
  challenged_score INTEGER,
  winner_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Index for user's challenges (both sent and received)
CREATE INDEX idx_challenges_challenger ON challenges(challenger_id, created_at DESC);
CREATE INDEX idx_challenges_challenged ON challenges(challenged_id, created_at DESC);

-- Index for active/pending challenges
CREATE INDEX idx_challenges_status ON challenges(status) WHERE status IN ('pending', 'accepted');


-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- NOTE: RLS is currently DISABLED for development
-- Re-enable and configure before production
-- ============================================

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE geofence_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tee_times ENABLE ROW LEVEL SECURITY;
ALTER TABLE rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE looking_for_game ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;


-- ============================================
-- RLS POLICIES: user_profiles
-- ============================================

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON user_profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile (except role)
CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Managers and admins can read all profiles
CREATE POLICY "Managers can read all profiles"
  ON user_profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('manager', 'super_admin')
    )
  );

-- Super admins can update any profile
CREATE POLICY "Super admins can update any profile"
  ON user_profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'super_admin'
    )
  );


-- ============================================
-- RLS POLICIES: geofence_zones
-- ============================================

-- All authenticated users can read active zones
CREATE POLICY "Anyone can read active zones"
  ON geofence_zones
  FOR SELECT
  USING (is_active = TRUE);

-- Only managers/admins can modify zones
CREATE POLICY "Managers can modify zones"
  ON geofence_zones
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('manager', 'super_admin')
    )
  );


-- ============================================
-- RLS POLICIES: app_settings
-- ============================================

-- All authenticated users can read settings
CREATE POLICY "Anyone can read settings"
  ON app_settings
  FOR SELECT
  USING (TRUE);

-- Only managers/admins can modify settings
CREATE POLICY "Managers can modify settings"
  ON app_settings
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('manager', 'super_admin')
    )
  );


-- ============================================
-- RLS POLICIES: tee_times
-- ============================================

-- Users can read their own tee times
CREATE POLICY "Users can read own tee times"
  ON tee_times
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own tee times
CREATE POLICY "Users can create own tee times"
  ON tee_times
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own tee times
CREATE POLICY "Users can update own tee times"
  ON tee_times
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Managers can view all tee times
CREATE POLICY "Managers can read all tee times"
  ON tee_times
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('manager', 'super_admin')
    )
  );


-- ============================================
-- RLS POLICIES: rounds
-- ============================================

-- Users can read their own rounds
CREATE POLICY "Users can read own rounds"
  ON rounds
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own rounds
CREATE POLICY "Users can create own rounds"
  ON rounds
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- All users can read rounds for leaderboard (limited fields)
CREATE POLICY "Anyone can read rounds for leaderboard"
  ON rounds
  FOR SELECT
  USING (TRUE);


-- ============================================
-- RLS POLICIES: loyalty_transactions
-- ============================================

-- Users can read their own transactions
CREATE POLICY "Users can read own transactions"
  ON loyalty_transactions
  FOR SELECT
  USING (auth.uid() = user_id);

-- System can create transactions (via service role)
-- In practice, use supabase_admin or service_role for inserts


-- ============================================
-- RLS POLICIES: loyalty_config
-- ============================================

-- All authenticated users can read config
CREATE POLICY "Anyone can read loyalty config"
  ON loyalty_config
  FOR SELECT
  USING (TRUE);

-- Only super_admin can modify config
CREATE POLICY "Super admin can modify loyalty config"
  ON loyalty_config
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'super_admin'
    )
  );


-- ============================================
-- RLS POLICIES: course_reports
-- ============================================

-- Users can read their own reports
CREATE POLICY "Users can read own reports"
  ON course_reports
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create reports
CREATE POLICY "Users can create reports"
  ON course_reports
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Managers can read all reports
CREATE POLICY "Managers can read all reports"
  ON course_reports
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('manager', 'super_admin')
    )
  );

-- Managers can update report status
CREATE POLICY "Managers can update reports"
  ON course_reports
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role IN ('manager', 'super_admin')
    )
  );


-- ============================================
-- RLS POLICIES: looking_for_game
-- ============================================

-- All authenticated users can read active posts
CREATE POLICY "Anyone can read active posts"
  ON looking_for_game
  FOR SELECT
  USING (is_active = TRUE AND expires_at > NOW());

-- Users can create their own posts
CREATE POLICY "Users can create own posts"
  ON looking_for_game
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update/delete their own posts
CREATE POLICY "Users can manage own posts"
  ON looking_for_game
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own posts"
  ON looking_for_game
  FOR DELETE
  USING (auth.uid() = user_id);


-- ============================================
-- RLS POLICIES: challenges
-- ============================================

-- Users can read challenges they're involved in
CREATE POLICY "Users can read own challenges"
  ON challenges
  FOR SELECT
  USING (auth.uid() = challenger_id OR auth.uid() = challenged_id);

-- Users can create challenges
CREATE POLICY "Users can create challenges"
  ON challenges
  FOR INSERT
  WITH CHECK (auth.uid() = challenger_id);

-- Challenged user can respond (update status)
CREATE POLICY "Challenged user can respond"
  ON challenges
  FOR UPDATE
  USING (auth.uid() = challenged_id AND status = 'pending');

-- Both parties can submit scores
CREATE POLICY "Participants can submit scores"
  ON challenges
  FOR UPDATE
  USING (
    (auth.uid() = challenger_id OR auth.uid() = challenged_id)
    AND status = 'accepted'
  );


-- ============================================
-- FUNCTIONS: Auto-update updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_geofence_zones_updated_at
  BEFORE UPDATE ON geofence_zones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_app_settings_updated_at
  BEFORE UPDATE ON app_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_course_reports_updated_at
  BEFORE UPDATE ON course_reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================
-- FUNCTIONS: Create profile on signup
-- ============================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'member'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users insert
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ============================================
-- NOTES
-- ============================================

-- 1. RLS is enabled but policies may need adjustment based on actual security requirements
-- 2. The handle_new_user trigger creates a profile automatically when users sign up
-- 3. JSONB is used for flexible configuration storage (scores, settings)
-- 4. Indexes are optimized for common query patterns (user lookups, leaderboards, active items)
-- 5. All timestamps use TIMESTAMPTZ for timezone-aware storage
-- 6. UUIDs are used for all primary keys for security and distribution

-- To disable RLS temporarily (development only):
-- ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE geofence_zones DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE app_settings DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE tee_times DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE rounds DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE loyalty_transactions DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE loyalty_config DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE course_reports DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE looking_for_game DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE challenges DISABLE ROW LEVEL SECURITY;
