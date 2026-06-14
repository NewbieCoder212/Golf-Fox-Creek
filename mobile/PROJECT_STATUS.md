# Fox Creek Golf App - Project Status

**Last Updated:** June 14, 2026
**Your Anchor for Tomorrow**

---

## Implemented Features

### 1. GPS & Geofencing
- Real-time location tracking using `expo-location`
- **Green proximity detection** (30m radius) - auto-prompts score entry when approaching green
- **Practice Range geofencing** (50m radius at 46.0691, -64.7319)
- GPS coordinates stored for all 18 holes (tee boxes and greens)
- Haversine distance calculation in `src/lib/geo.ts`

### 2. Traditional Scorecard Layout
- **18-hole scorecard** with accurate par information
- **Multi-player support** (up to 4 players)
- +/- buttons for score entry per hole
- Front 9 / Back 9 subtotals
- Relative to par display (E, +2, -1, etc.)
- Player name customization
- **Round persistence** - resumes unfinished rounds on app launch

### 3. Pace of Play Logic
- **Per-hole timer** tracking elapsed time
- **15-minute threshold** with color-coded status:
  - Green (0-12 min): On pace
  - Yellow (12-15 min): Warning
  - Red (15+ min): Overtime with pulsing animation
- Haptic feedback when overtime
- **"The Turn" break** - 10-minute countdown after hole 9
- Total round time calculation and storage

### 4. Round History
- View all completed rounds (last 50 saved)
- Round details: date, total time, score, vs par
- Front 9 / Back 9 breakdown per round
- **Delete round** functionality with confirmation modal
- Stored in AsyncStorage (`@foxcreek_round_history`)

---

## Weather API Status

| Item | Status |
|------|--------|
| **API Provider** | OpenWeatherMap (Free Tier) |
| **ENV Key** | `EXPO_PUBLIC_OPENWEATHERMAP_API_KEY` |
| **Key Set?** | Yes - configured in `.env` |
| **Functionality** | Working - displays temp, conditions, wind, humidity |
| **Location** | Uses device GPS or falls back to Dieppe, NB coordinates |
| **Caching** | 30-min stale time, 1-hour cache |

The weather card displays on the Home screen with real-time conditions.

---

## Next Steps (Parking Lot)

These are the features we discussed for future implementation:

### 1. Parking Lot Check-in
- Geofence the club parking lot
- Detect when user arrives at the course
- Trigger welcome notification or show "You've arrived" screen
- Could auto-suggest checking tee time or heading to range

### 2. Marshal View
- Separate interface for course marshals
- Overview of all active rounds on the course
- Pace of play monitoring across groups
- Ability to send alerts to slow groups
- Could use real-time sync (would need backend)

### 3. Onboarding Screen
- First-time user welcome flow
- Explain app features (GPS tracking, pace timer, etc.)
- Request location permissions with context
- Set up player profile/name
- Optional tutorial walkthrough

### 4. Tee Time Alerts (Enhancement)
- Currently: Alerts when at practice range + within 10 min of tee time
- **Enhancements to consider:**
  - Calendar integration (add tee time to phone calendar)
  - Multiple tee time tracking
  - Push notifications (would need expo-notifications setup)
  - Reminder 1 hour before, 30 min before, etc.

### 5. Sponsor Ad Rotation (revisit)
- **Shipped (feature branch):** `ad_placements` table, `SponsorBanner` component, admin CRUD, integrations (tournament scorecard header, hole sponsor, The Turn)
- **Current behavior:** Static — one active ad per placement; newest `created_at` wins (`limit: 1` in `getActiveAdPlacement`)
- **Revisit options when ready:**
  - **Random:** pick one active ad per page load (fair split among sponsors)
  - **Carousel:** swipe or auto-advance multiple banners in the same slot (e.g. scorecard header)
  - **Priority / weight:** admin-controlled impression share
  - **Scheduled:** `start_date` / `end_date` for calendar-based swaps
- **Likely touch points:** `mobile/src/lib/ad-placement-service.ts`, `mobile/src/components/SponsorBanner.tsx`, optional DB columns (`priority`, `weight`, `starts_at`, `ends_at`)

---

### Key Files
| Feature | Location |
|---------|----------|
| Scorecard | `src/app/(tabs)/scorecard.tsx` |
| Scorecard State | `src/lib/scorecard-store.ts` |
| Round History | `src/app/history.tsx` |
| Weather Hook | `src/lib/useWeather.ts` |
| GPS Utilities | `src/lib/geo.ts` |
| Tee Time Alerts | `src/lib/tee-time-alert-store.ts` |
| Home Screen | `src/app/(tabs)/index.tsx` |
| Sponsor ads (service) | `src/lib/ad-placement-service.ts` |
| Sponsor banner UI | `src/components/SponsorBanner.tsx` |
| Sponsor ads admin | `src/components/admin/AdminAdPlacementsSection.tsx` |
| Ad placements SQL | `supabase/migrations/20260623000000_ad_placements.sql` |

### Storage Keys
- `@foxcreek_scorecard` - Current round state
- `@foxcreek_round_history` - Saved rounds
- `@foxcreek_tee_time_alert` - Scheduled tee time

### GPS Coordinates
- Practice Range: `46.0691, -64.7319` (50m radius)
- Green detection: 30m radius from green center
- Weather fallback: `46.0984, -64.7242` (Dieppe, NB)

---

## Git Status
- **Branch:** main (clean)
- **Latest commits:**
  - "End Round" button on scorecard
  - Delete round option in history
  - Geofencing testing support
  - Round history delete functionality

---

Good luck tomorrow! Pick up where you left off with the Next Steps.
