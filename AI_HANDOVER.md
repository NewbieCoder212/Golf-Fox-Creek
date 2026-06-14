# AI Handover Documentation
## Fox Creek Golf Club Member App

**Last Updated:** February 11, 2026
**Project Status:** Active Development
**Version:** 1.0.0

---

## Table of Contents
1. [Project Architecture](#project-architecture)
2. [Database Schema](#database-schema)
3. [Current State & Recent Bug Fixes](#current-state--recent-bug-fixes)
4. [Pending Tasks](#pending-tasks)
5. [Known Quirks & Workarounds](#known-quirks--workarounds)

---

## Project Architecture

### Tech Stack Overview

| Layer | Technology | Notes |
|-------|------------|-------|
| **Mobile Frontend** | React Native 0.79.6 + Expo SDK 53 | Port 8081 (auto-managed) |
| **Styling** | NativeWind v4.1.23 + TailwindCSS | Mobile-first design |
| **State Management** | Zustand (local) + React Query (server) | Selector pattern enforced |
| **Animations** | React Native Reanimated v3.17 | Micro-interactions |
| **Backend** | Hono v4.6.0 on Bun | Port 3000 (auto-managed) |
| **Database** | Supabase (PostgreSQL) | REST API access |
| **Authentication** | Supabase Auth | Two-tier: members + admin |
| **Package Manager** | Bun | NOT npm |

### Directory Structure

```
/home/user/workspace/
├── mobile/                     # Expo React Native app
│   ├── src/
│   │   ├── app/               # Expo Router (file-based routing)
│   │   │   ├── (tabs)/        # Main tab navigation
│   │   │   ├── admin/         # Admin portal (modal routes)
│   │   │   └── *.tsx          # Other screens
│   │   ├── components/        # Reusable UI components
│   │   ├── lib/               # Utilities, stores, hooks
│   │   └── types/             # TypeScript definitions
│   ├── patches/               # React Native patches
│   └── expo.log               # Runtime logs
├── backend/                    # Hono API server
│   ├── src/
│   │   ├── index.ts           # Entry point + middleware
│   │   ├── lib/vibecode.ts    # VibeCode SDK integration
│   │   └── routes/            # API routes
│   └── server.log             # Backend logs
└── AI_HANDOVER.md             # This file
```

### How Frontend & Backend Connect

```
┌─────────────────────────────────────────────────────────────────┐
│                     MOBILE APP (Expo)                           │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   SUPABASE    │    │ HONO BACKEND  │    │ EXTERNAL APIs │
│  (Primary DB) │    │  (Optional)   │    │               │
│               │    │               │    │ • OpenWeather │
│ • Auth        │    │ Port 3000     │    │ • OpenAI      │
│ • PostgreSQL  │    │ Custom logic  │    │ • ElevenLabs  │
│ • REST API    │    │ Future APIs   │    │ • Google Maps │
└───────────────┘    └───────────────┘    └───────────────┘
```

**Supabase Connection:**
- URL: `https://xoxtzptwdgcziigzvdkc.supabase.co`
- Access via REST API (no SDK - custom client in `/mobile/src/lib/supabase.ts`)
- Auth tokens stored in AsyncStorage

**Backend Connection:**
- VibeCode proxy rewrites `EXPO_PUBLIC_VIBECODE_BACKEND_URL` to actual URL
- CORS configured for `*.vibecode.run` and `*.dev.vibecode.run`

### Environment Variables

**Mobile (`.env`):**
```
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
EXPO_PUBLIC_OPENWEATHERMAP_API_KEY
EXPO_PUBLIC_VIBECODE_OPENAI_API_KEY
EXPO_PUBLIC_VIBECODE_ANTHROPIC_API_KEY
EXPO_PUBLIC_VIBECODE_GROK_API_KEY
EXPO_PUBLIC_VIBECODE_ELEVENLABS_API_KEY
EXPO_PUBLIC_VIBECODE_GOOGLE_API_KEY
```

**Backend (`.env`):**
```
PORT=3000
OPENAI_API_KEY
```

---

## Database Schema

### Supabase PostgreSQL Tables

#### 1. `user_profiles`
Primary user account and profile information.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key (from Supabase Auth) |
| `full_name` | TEXT | User's display name |
| `email` | TEXT | User email |
| `role` | TEXT | `'member'` \| `'manager'` \| `'super_admin'` |
| `club_id` | TEXT | Golf club association |
| `location_tracking_enabled` | BOOLEAN | GPS opt-in (default: true) |
| `handicap_index` | NUMERIC | Golf handicap |
| `loyalty_points` | INTEGER | Accumulated points (default: 0) |
| `handicap_updated_at` | TIMESTAMP | Last handicap calculation |
| `created_at` | TIMESTAMP | Account creation |
| `updated_at` | TIMESTAMP | Last update |

#### 2. `geofence_zones`
GPS boundaries for location-based triggers.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `zone_name` | TEXT | Display name |
| `zone_type` | TEXT | `'clubhouse'` \| `'range'` \| `'canteen'` \| `'hole_green'` \| `'hole_tee'` |
| `hole_number` | INTEGER | Hole number (if applicable) |
| `latitude` | NUMERIC | GPS latitude |
| `longitude` | NUMERIC | GPS longitude |
| `radius_meters` | INTEGER | Geofence radius |
| `trigger_action` | TEXT | `'check_in'` \| `'tee_alert'` \| `'fnb_prompt'` \| `'auto_start'` |
| `is_active` | BOOLEAN | Zone enabled |
| `created_at` | TIMESTAMP | Creation time |
| `updated_at` | TIMESTAMP | Last update |

#### 3. `app_settings`
Global configuration and announcements.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `setting_key` | TEXT | Unique key (e.g., `'geofence_tracking'`, `'gm_announcements'`) |
| `setting_value` | JSONB | Configuration object |
| `description` | TEXT | Human description |
| `updated_by` | TEXT | User who last updated |
| `updated_at` | TIMESTAMP | Last update |
| `created_at` | TIMESTAMP | Creation time |

**Setting Key Structures:**
```typescript
// geofence_tracking
{
  enabled: boolean;
  check_in_enabled: boolean;
  tee_time_alerts: boolean;
  turn_prompt_enabled: boolean;
}

// gm_announcements
{
  enabled: boolean;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'alert';
  expires_at: string | null;
}
```

#### 4. `tee_times`
Tee time bookings.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK to user_profiles |
| `tee_time` | TIMESTAMP | Scheduled time |
| `course_id` | TEXT | Course identifier |
| `chronogolf_booking_id` | TEXT | External booking ID |
| `players` | INTEGER | Number of players |
| `status` | TEXT | `'confirmed'` \| `'pending'` \| `'cancelled'` |
| `created_at` | TIMESTAMP | Booking creation |

#### 5. `rounds`
Completed golf rounds with scorecard data.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK to user_profiles |
| `course_id` | TEXT | Course identifier |
| `played_at` | TIMESTAMP | Round date/time |
| `tee_played` | TEXT | `'Black'` \| `'Blue'` \| `'White'` \| `'Green'` \| `'Red'` |
| `gross_score` | INTEGER | Total strokes |
| `adjusted_score` | INTEGER | ESC-adjusted score |
| `course_rating` | NUMERIC | Course rating |
| `slope_rating` | NUMERIC | Slope rating |
| `differential` | NUMERIC | Handicap differential |
| `scores` | JSONB | Array of hole scores |
| `duration_seconds` | INTEGER | Round duration |
| `weather_conditions` | TEXT | Weather notes |
| `created_at` | TIMESTAMP | Entry time |

**Scores JSONB Structure:**
```typescript
{
  hole: number;      // 1-18
  par: number;       // 3-5
  score: number | null;
  adjustedScore: number;  // ESC adjusted
}[]
```

#### 6. `loyalty_transactions`
Points transaction history.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK to user_profiles |
| `points` | INTEGER | Points awarded/deducted |
| `transaction_type` | TEXT | See types below |
| `description` | TEXT | Human description |
| `reference_id` | TEXT | Related object ID |
| `created_at` | TIMESTAMP | Transaction time |

**Transaction Types:** `round_completed`, `round_under_par`, `eagle_bonus`, `birdie_bonus`, `hole_in_one`, `first_round_bonus`, `milestone_10_rounds`, `milestone_25_rounds`, `milestone_50_rounds`, `redemption_proshop`, `redemption_fnb`, `redemption_greenfee`, `redemption_lesson`, `admin_adjustment`, `expiration`

#### 7. `loyalty_config`
Loyalty program rules.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `config_key` | TEXT | `'point_rules'` |
| `config_value` | JSONB | Rules configuration |

#### 8. `course_reports`
Member-submitted condition reports.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | FK to user_profiles |
| `reporter_name` | TEXT | Reporter name |
| `hole_number` | INTEGER | Hole (if applicable) |
| `area` | TEXT | `'fairway'` \| `'green'` \| `'bunker'` \| `'tee_box'` \| `'rough'` \| `'cart_path'` \| `'other'` |
| `report_type` | TEXT | `'wet_bunker'` \| `'damaged_turf'` \| `'fallen_tree'` \| `'drainage_issue'` \| `'other'` |
| `description` | TEXT | Issue description |
| `photo_url` | TEXT | Evidence photo |
| `latitude` | NUMERIC | GPS location |
| `longitude` | NUMERIC | GPS location |
| `status` | TEXT | `'pending'` \| `'in_progress'` \| `'resolved'` \| `'dismissed'` |
| `admin_notes` | TEXT | Staff notes |
| `created_at` | TIMESTAMP | Report time |
| `updated_at` | TIMESTAMP | Last update |
| `resolved_at` | TIMESTAMP | Resolution time |

### Relationships

```
user_profiles (1) ──┬── (N) tee_times
                    ├── (N) rounds
                    ├── (N) loyalty_transactions
                    └── (N) course_reports
```

---

## Current State & Recent Bug Fixes

### Recently Fixed Bugs

#### 1. RLS Authentication Blocker (Commit: `4e6fc4e`)
**Issue:** Admin login failing - "could not load profile" error
**Root Cause:** Supabase Row-Level Security policies blocking profile reads
**Fix Applied:** Temporarily disabled RLS policies to allow admin authentication
**Status:** ✅ Fixed (RLS disabled)
**Note:** RLS should be re-enabled with proper policies before production

#### 2. Profile Loading Error (Commit: `0de6b96`)
**Issue:** "Could not load profile" after successful authentication
**Location:** `/mobile/src/app/admin/index.tsx:68`
**Fix Logic:**
```typescript
// Check profile exists before dashboard access
if (!profile) {
  return <ErrorState message="Could not load profile" />;
}
```
**Status:** ✅ Handled with error state

#### 3. Supabase Configuration Errors (Commits: `fac6335`, `2adee78`, `225e75d`)
**Issue:** "Supabase not configured" errors in logs
**Location:** `/mobile/src/lib/supabase.ts`
**Fix Logic:** Added fallback when env vars missing
```typescript
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('Supabase not configured');
  return { data: null, error: 'Not configured' };
}
```
**Status:** ✅ Graceful degradation implemented

#### 4. Password Setup for Admin (Commits: `9eca526`, `bf7b7fa`, `5a7d4f1`)
**Issue:** Admin created in Supabase but unable to set password
**Status:** ⚠️ Requires manual password setup via Supabase dashboard

---

## Pending Tasks

### Next 3 Features to Build

#### 1. Loyalty Points Screen Navigation
**Location:** `/mobile/src/app/(tabs)/index.tsx:286`
**Current State:** TODO comment - navigation not implemented
**Trigger:** User taps "Loyalty Points" stat on home screen
**Required:**
- Create `/mobile/src/app/loyalty.tsx` screen
- Show points balance, transaction history
- Redemption options (pro shop, F&B, green fees, lessons)

#### 2. F&B Menu Integration ("The Turn" Prompt)
**Location:** `/mobile/src/app/(tabs)/index.tsx:351`
**Current State:** TODO comment - menu not implemented
**Trigger:** User clicks "View Menu" at 9-hole checkpoint
**Required:**
- Create F&B menu screen or modal
- Integrate with club's menu data
- Optional: ordering capability

#### 3. Social Contact/Message Flow
**Location:** `/mobile/src/app/(tabs)/social.tsx:509`
**Current State:** TODO comment - contact action not implemented
**Trigger:** User clicks "Contact" on "Looking for Game" post
**Required:**
- In-app messaging or
- Email/SMS integration
- Privacy considerations for contact info

### Other Planned Features (Lower Priority)
- Chronogolf SSO integration for member login
- Push notifications for tee time reminders
- Re-enable RLS with proper security policies
- Course condition map overlay

---

## Known Quirks & Workarounds

### Critical VibeCode Integration

#### 1. Proxy Import (MUST NOT REMOVE)
**File:** `/backend/src/index.ts:1`
```typescript
import "@vibecodeapp/proxy"; // DO NOT REMOVE OTHERWISE VIBECODE PROXY WILL NOT WORK
```
**Why:** Required for VibeCode development tooling to function.

#### 2. CORS Whitelist for VibeCode Domains
**File:** `/backend/src/index.ts:10-16`
```typescript
const allowed = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https:\/\/[a-z0-9-]+\.dev\.vibecode\.run$/,
  /^https:\/\/[a-z0-9-]+\.vibecode\.run$/,
];
```

### Metro Bundler Workarounds

#### 3. Dynamic Imports Fix (CRITICAL)
**File:** `/mobile/metro.config.js:50-62`
```javascript
// unstable_enablePackageExports ONLY enabled when shared folder exists
// If enabled globally, it BREAKS dynamic imports like `await import("expo-image")`
...(sharedFolderExists && {
  unstable_enablePackageExports: true,
  // ...
}),
```
**Why:** Global enablement breaks `await import()` statements.

#### 4. Better-Auth ESM/CJS Resolution
**File:** `/mobile/metro.config.js:95-100`
```javascript
// Metro resolves to .cjs but better-auth only ships .mjs
if (moduleName.includes("better-auth") && moduleName.endsWith(".cjs")) {
  const mjsPath = moduleName.replace(/\.cjs$/, ".mjs");
  return context.resolveRequest(context, mjsPath, platform);
}
```
**Why:** Module format mismatch between Metro expectations and package exports.

#### 5. Dev-Time Import Mocking
**File:** `/mobile/metro.config.js:102-106`
```javascript
// @better-auth/expo incorrectly imports metro-config (build-time only)
if (moduleName.includes("@expo/metro-config") || moduleName.includes("async-require")) {
  return { type: "empty" };
}
```
**Why:** Client code shouldn't import build tools.

#### 6. Native-Only Module Mocking for Web
**File:** `/mobile/metro.config.js:108-121`
```javascript
if (platform === "web") {
  const nativeOnlyModules = [
    "react-native-pager-view",
    "reanimated-tab-view",
    "@bottom-tabs/react-navigation",
  ];
  if (nativeOnlyModules.some((mod) => moduleName.includes(mod))) {
    return { type: "empty" };
  }
}
```
**Why:** Prevents web build errors from native-only packages.

### React Native Patches

#### 7. Modal Dismiss Workaround
**File:** `/mobile/patches/react-native@0.79.6.patch:575`
```javascript
// workaround for https://github.com/facebook/react-native/pull/50867
// [self dismiss];
```
**Why:** React Native modal dismiss issue.

### Other Quirks

#### 8. Watchman Disabled
**File:** `/mobile/metro.config.js:27`
```javascript
config.resolver.useWatchman = false;
```
**Why:** Avoids file watching issues in VibeCode environment.

#### 9. Database Viewer Auto-Enable
**File:** `/backend/scripts/start:27-30`
```bash
if [ -n "${VIBECODE_PROJECT_ID:-}" ]; then
  curl -s -X POST "https://api.vibecodeapp.com/api/projects/${VIBECODE_PROJECT_ID}/cloud/db/enable" || true
fi
```
**Why:** Automatically enables VibeCode DB viewer on startup.

#### 10. Forbidden Files (DO NOT MODIFY)
These files are managed by VibeCode and should not be edited:
- `patches/`
- `babel.config.js`
- `metro.config.js`
- `app.json`
- `tsconfig.json`
- `nativewind-env.d.ts`

---

## Quick Reference

### Key Commands
```bash
# View mobile logs
tail -f /home/user/workspace/mobile/expo.log

# View backend logs
tail -f /home/user/workspace/backend/server.log

# Check environment
env | grep EXPO_PUBLIC

# TypeScript check
cd /home/user/workspace/mobile && bun run typecheck
```

### Important Files
| Purpose | Path |
|---------|------|
| Supabase client | `/mobile/src/lib/supabase.ts` |
| TypeScript types | `/mobile/src/types/index.ts` |
| Tab navigation | `/mobile/src/app/(tabs)/_layout.tsx` |
| Admin dashboard | `/mobile/src/app/admin/dashboard.tsx` |
| Auth stores | `/mobile/src/lib/member-auth-store.ts`, `admin-auth-store.ts` |
| Scorecard state | `/mobile/src/lib/scorecard-store.ts` |
| Geofencing | `/mobile/src/lib/useGeofencing.ts` |

### User Roles
| Role | Access |
|------|--------|
| `member` | Main app, scorecard, social, booking |
| `manager` | + Admin dashboard (limited) |
| `super_admin` | + Full admin, member management |

---

*This document should be updated as features are completed and new quirks are discovered.*
