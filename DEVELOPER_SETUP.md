# Developer Setup Guide
## Fox Creek Golf Club Member App

This document lists all environment variables and commands needed to run the app locally.

---

## Prerequisites

- **Node.js** v18+ (v20 recommended)
- **Bun** v1.0+ (package manager and runtime)
- **Expo CLI** (installed via npx)
- **iOS Simulator** (macOS) or **Expo Go** app (iOS/Android device)

---

## Environment Variables

### Mobile App (`mobile/.env`)

Create a `.env` file in the `mobile/` directory with the following variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `EXPO_PUBLIC_SUPABASE_URL` | **Yes** | Supabase project URL (e.g., `https://xxxxx.supabase.co`) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | **Yes** | Supabase anonymous/public API key |
| `EXPO_PUBLIC_OPENWEATHERMAP_API_KEY` | Optional | OpenWeatherMap API key for weather data |
| `EXPO_PUBLIC_VIBECODE_OPENAI_API_KEY` | Optional | OpenAI API key for AI features |
| `EXPO_PUBLIC_VIBECODE_ANTHROPIC_API_KEY` | Optional | Anthropic Claude API key |
| `EXPO_PUBLIC_VIBECODE_GROK_API_KEY` | Optional | xAI Grok API key |
| `EXPO_PUBLIC_VIBECODE_ELEVENLABS_API_KEY` | Optional | ElevenLabs API key for voice features |
| `EXPO_PUBLIC_VIBECODE_GOOGLE_API_KEY` | Optional | Google API key (Maps, etc.) |

**Example `mobile/.env`:**
```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
EXPO_PUBLIC_OPENWEATHERMAP_API_KEY=your-openweathermap-key
EXPO_PUBLIC_VIBECODE_OPENAI_API_KEY=sk-proj-your-openai-key
EXPO_PUBLIC_VIBECODE_ANTHROPIC_API_KEY=sk-ant-api03-your-anthropic-key
EXPO_PUBLIC_VIBECODE_GROK_API_KEY=xai-your-grok-key
EXPO_PUBLIC_VIBECODE_ELEVENLABS_API_KEY=your-elevenlabs-key
EXPO_PUBLIC_VIBECODE_GOOGLE_API_KEY=your-google-api-key
```

### Backend Server (`backend/.env`)

Create a `.env` file in the `backend/` directory with the following variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | Optional | Server port (default: `3000`) |
| `OPENAI_API_KEY` | Optional | OpenAI API key for server-side AI features |

**Example `backend/.env`:**
```env
PORT=3000
OPENAI_API_KEY=sk-proj-your-openai-key
```

---

## Running the App Locally

### 1. Install Dependencies

```bash
# Install mobile app dependencies
cd mobile
bun install

# Install backend dependencies
cd ../backend
bun install
```

### 2. Start the Backend Server

```bash
cd backend

# Development mode (with hot reload)
bun run dev

# OR production mode
bun run start
```

The backend server runs on `http://localhost:3000`.

### 3. Start the Mobile App

```bash
cd mobile

# Start Expo development server
bun run start

# OR start for specific platforms
bun run ios      # iOS Simulator
bun run android  # Android Emulator
bun run web      # Web browser
```

The Expo dev server runs on `http://localhost:8081`.

---

## Available Scripts

### Mobile (`mobile/package.json`)

| Command | Description |
|---------|-------------|
| `bun run start` | Start Expo development server |
| `bun run ios` | Start on iOS Simulator |
| `bun run android` | Start on Android Emulator |
| `bun run web` | Start web version (dark mode enabled) |
| `bun run lint` | Run ESLint |
| `bun run typecheck` | Run TypeScript type checking |

### Backend (`backend/package.json`)

| Command | Description |
|---------|-------------|
| `bun run dev` | Start server with hot reload |
| `bun run start` | Start server (production) |
| `bun run studio` | Start Cloud Studio on port 3001 |
| `bun run typecheck` | Run TypeScript type checking |

---

## Quick Start (All-in-One)

Run these commands from the project root:

```bash
# Terminal 1 - Backend
cd backend && bun install && bun run dev

# Terminal 2 - Mobile
cd mobile && bun install && bun run start
```

Then:
- Press `i` to open iOS Simulator
- Press `a` to open Android Emulator
- Press `w` to open in web browser
- Scan QR code with Expo Go app on your device

---

## Supabase Setup

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Copy your project URL and anon key from **Settings > API**
3. Run the SQL in `supabase_schema.sql` in the Supabase SQL Editor
4. Add the credentials to `mobile/.env`

---

## Troubleshooting

### "Supabase not configured" in logs
- Ensure `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are set
- Restart the Expo dev server after changing `.env`

### Metro bundler errors
- Clear cache: `cd mobile && bun run start --clear`
- Delete `node_modules` and reinstall: `rm -rf node_modules && bun install`

### Backend connection issues
- Verify backend is running on port 3000
- Check CORS settings in `backend/src/index.ts`

---

## Tech Stack Reference

| Layer | Technology | Version |
|-------|------------|---------|
| Mobile Runtime | Expo SDK | 53 |
| Mobile Framework | React Native | 0.79.6 |
| Styling | NativeWind + TailwindCSS | 4.1.23 / 3.4.17 |
| State Management | Zustand | 5.x |
| Server State | TanStack React Query | 5.x |
| Backend Runtime | Bun | 1.x |
| Backend Framework | Hono | 4.6.0 |
| Database | Supabase (PostgreSQL) | - |
| Auth | Supabase Auth | - |
