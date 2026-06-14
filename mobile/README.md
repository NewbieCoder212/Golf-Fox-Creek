# Fox Creek Golf Club App

A mobile app for Fox Creek Golf Club in Dieppe, New Brunswick, Canada.

## Course Info

- **Location:** 200 Golf Street, Dieppe, NB E1A 8K9
- **Designer:** Graham Cooke (2005)
- **Type:** Private Members Club
- **Par:** 72
- **Tees:** Black (6,925 yds), Blue (6,428 yds), White (6,033 yds), Green (5,589 yds), Red (4,836 yds)

## Design

**Stealth Wealth Aesthetic** - Professional dark mode with lime green accents. Understated luxury with clean typography and subtle borders.

## Features

### Member Hub (Home Screen)
- **Handicap Display:** Shows user's current WHS handicap index (from Supabase)
- **Loyalty Points:** Displays accumulated points with tap to view history
- **Member Status Badge:** Dynamic status indicator (On Course, At Clubhouse, Away)
- **GM Announcement Banner:** Displays club announcements (info, warning, alert types)
- **Contextual Cards:** Dynamic cards based on current state:
  - Round in Progress: Shows current hole with quick access to scorecard
  - F&B Prompt: Appears at The Turn (Hole 9) with menu options
  - Upcoming Tee Time: Shows countdown when within 60 minutes
  - Checked In: Prompts to start round when at clubhouse
  - Welcome Card: Default state with tee time setup prompt
- Live weather/course conditions display (OpenWeatherMap API)
- Quick access buttons for tee times, scorecard, and history
- Pro shop promotional banner

### Practice Range Alert
- Set your upcoming tee time before practicing
- Geofence detects when you're at the practice range (46.0691, -64.7319)
- Automatic alert 10 minutes before tee time
- Haptic notification reminds you to head to Hole 1
- Persists tee time across app restarts

### Tee Times
- Interactive date picker with week navigation
- Player count selector (1-4 players)
- Available tee time slots with pricing
- Real-time availability display
- Booking confirmation flow

### Scorecard
- Minimalist 4-player scoring grid
- Tap to increment/decrement scores
- Relative to par tracking per player
- Full 18-hole scorecard view (real Fox Creek data)
- Editable player names

### Tempo Tracker
- Persistent timer bar at top of scorecard
- Turns YELLOW at 12 minutes warning
- Turns RED and pulses after 15 minutes
- Haptic feedback on pace alerts
- GPS status indicator

### Pace Logic
- Uses device GPS to track location
- Auto-detects hole transitions (green to next tee)
- Automatically resets hole timer on movement
- Haversine formula for distance calculation

### Course Information
- Full 18-hole scorecard with real Fox Creek data
- 5 tee selections (Black, Blue, White, Green, Red)
- Par, yardage, and handicap for each hole
- Front/back nine and total yardages
- Practice facility information

### Contact
- Real Fox Creek contact info
- One-tap call, email, and directions
- Hours of operation
- Staff directory
- Social media links

## Tech Stack
- Expo SDK 53
- React Native 0.76.7
- NativeWind (TailwindCSS)
- React Native Reanimated
- Expo Router (file-based routing)
- Expo Location (GPS tracking)
- Zustand (state management)
- Lucide React Native icons

## Data Sources
- Course scorecard data from [Golfify](https://www.golfify.io/courses/fox-creek-golf-club)
- Course info from [Golf New Brunswick](https://www.golfnb.ca/golf-facility/fox-creek-golf-club-en/)
- Weather data from [OpenWeatherMap API](https://openweathermap.org/api)

## Environment Variables
- `EXPO_PUBLIC_OPENWEATHERMAP_API_KEY` - Required for live weather data
- `EXPO_PUBLIC_SUPABASE_URL` - Supabase project URL for backend features
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `EXPO_PUBLIC_CHRONOGOLF_API_KEY` - (Coming Soon) Chronogolf API key for member auth
- `EXPO_PUBLIC_CHRONOGOLF_CLUB_ID` - (Coming Soon) Fox Creek's Chronogolf club ID

## Authentication System

### Two-Tier Authentication

**1. Members** → Chronogolf API (Coming Soon)
- Members will log in using their existing Chronogolf credentials
- Profile, bookings, membership status pulled from Chronogolf
- No separate account management needed

**2. Staff (Admin/Manager)** → Supabase Auth
- Club staff log in via the "Staff Login" button
- Requires `manager` or `super_admin` role in Supabase
- Access to admin dashboard, announcements, settings

### Current Status
- Member login shows "Coming Soon" message while awaiting Chronogolf API keys
- Staff login is fully functional via Supabase
- Admin dashboard accessible to managers and super_admins

## Geofencing System

The app includes a comprehensive GPS geofencing system with three main triggers:

### Logic A: Auto Check-In
- Detects when user enters the Clubhouse geofence
- Automatically sets `isCheckedIn = true` in the scorecard store
- Can be toggled on/off by managers

### Logic B: Tee Time Alert
- Triggers when user is at Practice Range AND 5 minutes before tee time
- Sends local push notification reminder
- Requires tee time to be set (future: Chronogolf integration)

### Logic C: The Turn (F&B Prompt)
- Triggers when user is within 30 yards of Hole 8 green
- Shows F&B order prompt at the turn
- Only triggers once per round

### Logic D: Auto-Start Round
- Triggers when user is at Hole 1 Tee Box after checking in
- Automatically starts round tracking and scorecard
- Sets currentHole to 1 and begins pace timer

### Battery Efficiency
- Uses balanced accuracy when not on course
- Switches to high accuracy when checked in
- Distance-based updates (10m on course, 50m off course)
- Admin can disable all tracking with master toggle

### Admin Controls (Supabase)
Managers and admins can toggle these features via the dashboard:
- `enabled` - Master kill switch for all geofencing
- `check_in_enabled` - Toggle auto check-in feature
- `tee_time_alerts` - Toggle practice range alerts
- `turn_prompt_enabled` - Toggle F&B prompt at the turn

## Handicap & Rounds System

The app implements WHS (World Handicap System) official handicap calculation:

### Score Differential
- Formula: `(113 / Slope Rating) × (Adjusted Gross Score - Course Rating)`
- ESC (Equitable Stroke Control) applies net double bogey maximum per hole

### Handicap Index Calculation
- Uses best 8 of most recent 20 differentials
- Minimum 3 rounds required for initial handicap
- Adjustments applied for fewer than 20 rounds per WHS table

### Round Completion Flow
1. Round auto-starts at Hole 1 Tee (geofence trigger)
2. Scores entered per hole with ESC adjustment
3. On completion, calculates differential and saves to Supabase
4. Handicap index recalculated automatically
5. Loyalty points awarded based on configuration

### Supabase Tables for Rounds
```sql
-- Rounds table for handicap tracking
CREATE TABLE rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  course_id TEXT DEFAULT 'fox-creek',
  played_at TIMESTAMPTZ DEFAULT NOW(),
  tee_played TEXT NOT NULL,
  gross_score INTEGER NOT NULL,
  adjusted_score INTEGER,
  course_rating DECIMAL(4,1) NOT NULL,
  slope_rating INTEGER NOT NULL,
  differential DECIMAL(4,1),
  scores JSONB NOT NULL DEFAULT '[]',
  duration_seconds INTEGER,
  weather_conditions TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Loyalty Points System

Points are awarded for various achievements:

### Point Categories
- `round_completed` - Points for finishing 18 holes
- `round_under_par` - Bonus for scoring under par
- `eagle_bonus` / `birdie_bonus` / `hole_in_one` - Scoring achievements
- `milestone_10_rounds` / `milestone_25_rounds` / `milestone_50_rounds` - Round milestones

### Supabase Tables for Loyalty
```sql
-- Loyalty transactions
CREATE TABLE loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  transaction_type TEXT NOT NULL,
  description TEXT,
  reference_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Loyalty configuration
CREATE TABLE loyalty_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key TEXT UNIQUE NOT NULL,
  config_value JSONB NOT NULL DEFAULT '{}'
);

-- Add handicap and loyalty columns to user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS handicap_index DECIMAL(4,1);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS handicap_updated_at TIMESTAMPTZ;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS loyalty_points INTEGER DEFAULT 0;
```

## GM Announcements

Club managers can post announcements that appear on the home screen:

### Announcement Types
- `info` - Blue banner for general information
- `warning` - Amber banner for important notices
- `alert` - Red banner for urgent alerts

### Supabase Setup
```sql
INSERT INTO app_settings (setting_key, setting_value, description)
VALUES (
  'gm_announcements',
  '{"enabled": false, "message": "", "type": "info", "title": "", "expires_at": null}',
  'GM announcements banner on home screen - types: info, warning, alert'
);
```

## Supabase Setup

Run the following SQL in your Supabase SQL editor:

### Tables
```sql
-- App-wide feature toggles
CREATE TABLE app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default geofence setting
INSERT INTO app_settings (setting_key, setting_value, description)
VALUES (
  'geofence_tracking',
  '{"enabled": true, "check_in_enabled": true, "tee_time_alerts": true, "turn_prompt_enabled": true}',
  'Controls GPS geofencing features for the club'
);

-- User roles
CREATE TYPE user_role AS ENUM ('member', 'manager', 'super_admin');

CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  role user_role DEFAULT 'member',
  club_id UUID,
  location_tracking_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Geofence zones
CREATE TABLE geofence_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_name TEXT NOT NULL,
  zone_type TEXT NOT NULL,
  hole_number INTEGER,
  latitude DECIMAL(10, 7) NOT NULL,
  longitude DECIMAL(10, 7) NOT NULL,
  radius_meters INTEGER NOT NULL DEFAULT 50,
  trigger_action TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert Fox Creek geofences (update coordinates when available)
INSERT INTO geofence_zones (zone_name, zone_type, latitude, longitude, radius_meters, trigger_action) VALUES
('Clubhouse', 'clubhouse', 46.083, -64.683, 50, 'check_in'),
('Practice Range', 'range', 46.084, -64.682, 100, 'tee_alert'),
('Canteen', 'canteen', 46.0835, -64.684, 30, NULL),
('Hole 8 Green', 'hole_green', 0, 0, 27, 'fnb_prompt');

-- Tee times (for Chronogolf sync)
CREATE TABLE tee_times (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tee_time TIMESTAMPTZ NOT NULL,
  course_id UUID,
  chronogolf_booking_id TEXT,
  players INTEGER DEFAULT 1,
  status TEXT DEFAULT 'confirmed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Row Level Security
```sql
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE geofence_zones ENABLE ROW LEVEL SECURITY;

-- App Settings: Everyone can read, managers+ can update
CREATE POLICY "Anyone can read app settings" ON app_settings FOR SELECT USING (true);
CREATE POLICY "Managers can update settings" ON app_settings FOR UPDATE USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('manager', 'super_admin'))
);

-- User Profiles
CREATE POLICY "Users read own profile" ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins read all" ON user_profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'super_admin')
);

-- Geofence Zones: Everyone can read, managers+ can manage
CREATE POLICY "Anyone can read zones" ON geofence_zones FOR SELECT USING (true);
CREATE POLICY "Managers manage zones" ON geofence_zones FOR ALL USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('manager', 'super_admin'))
);
```

## Web Deployment

This app is configured for web deployment at **foxcreek.golf**.

### Browser Experience
- **Browser Tab:** "Fox Creek Member Portal"
- **Favicon:** FC club logo
- **PWA Manifest:** Configured for "Fox Creek Golf Club"

### Authentication
- Login screen is the default landing page for unauthenticated users
- Authenticated members are redirected to the Member Hub
- Sessions persist across browser refreshes

### How to Deploy

1. **Export the web build:**
   ```bash
   bunx expo export --platform web
   ```

2. **Deploy the `dist` folder** to any static hosting service:
   - **Vercel:** Drag and drop the `dist` folder, or connect your git repo
   - **Netlify:** Drag and drop the `dist` folder
   - **Cloudflare Pages:** Connect your git repo
   - **Your own domain:** Upload to any web server

### Web Features
- Works on iPhone Safari, Android Chrome, and desktop browsers
- Members can "Add to Home Screen" for an app-like experience
- Optimized for mobile touch interactions
- Dark theme matches native app

### Web Limitations
- No native push notifications (consider email alerts instead)
- No Apple Pay (use Stripe web checkout if needed)
- Some animations may be simpler than native
