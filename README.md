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

### Home Screen
- Hero image with course branding
- Live weather/course conditions display (OpenWeatherMap API)
- Weather data auto-refreshes every 30 minutes
- Uses GPS location when available, falls back to Dieppe, NB
- Dynamic weather icons based on conditions
- Practice mode with tee time alert
- Quick access buttons for tee times, scorecard, and course info
- Upcoming events section
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
