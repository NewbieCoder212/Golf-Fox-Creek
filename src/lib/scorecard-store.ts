import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@foxcreek_scorecard';
const HISTORY_KEY = '@foxcreek_round_history';

interface HoleScore {
  hole: number;
  par: number;
  scores: (number | null)[];
  completedAt?: number; // Timestamp when hole was completed
  duration?: number; // Time spent on hole in seconds
}

interface Player {
  id: number;
  name: string;
  initials: string;
}

interface RoundSummary {
  id: string;
  date: number;
  players: Player[];
  scores: HoleScore[];
  totalTime: number; // Total round time in seconds
  coursePar: number;
}

interface SavedRoundData {
  players: Player[];
  scores: HoleScore[];
  currentHole: number;
  holeStartTime: number;
  elapsedSeconds: number;
  isTracking: boolean;
  isTurnPaused: boolean;
  turnTimeRemaining: number;
  savedAt: number;
  roundStartTime: number;
}

interface ScorecardState {
  players: Player[];
  scores: HoleScore[];
  currentHole: number;
  holeStartTime: number;
  elapsedSeconds: number;
  isTracking: boolean;
  isTurnPaused: boolean;
  turnTimeRemaining: number;
  isScorePromptVisible: boolean;
  pendingHoleTransition: number | null;
  hasUnfinishedRound: boolean;
  showResumePrompt: boolean;
  showRoundSummary: boolean;
  roundStartTime: number;
  roundHistory: RoundSummary[];

  // Actions
  setPlayerName: (playerId: number, name: string) => void;
  setScore: (hole: number, playerId: number, score: number | null) => void;
  setCurrentHole: (hole: number) => void;
  resetHoleTimer: () => void;
  updateElapsedTime: () => void;
  startTracking: () => void;
  stopTracking: () => void;
  startTurn: () => void;
  updateTurnTime: () => void;
  skipTurn: () => void;
  triggerHoleComplete: (completedHole: number) => void;
  confirmScoreAndAdvance: () => void;
  dismissScorePrompt: () => void;
  getTotalScore: (playerId: number) => number;
  getRelativeToPar: (playerId: number) => number;
  getCoursePar: () => number;
  getTotalRoundTime: () => number;
  getHolesCompleted: (playerId: number) => number;
  isRoundComplete: () => boolean;
  finishRound: () => void;
  saveRoundToHistory: () => Promise<void>;
  loadRoundHistory: () => Promise<void>;
  deleteRound: (roundId: string) => Promise<void>;
  dismissRoundSummary: () => void;
  saveRound: () => Promise<void>;
  loadSavedRound: () => Promise<void>;
  resumeRound: () => void;
  discardSavedRound: () => Promise<void>;
  resetRound: () => Promise<void>;
}

// Fox Creek Golf Club - Dieppe, NB, Canada
// Traditional 18-hole sequence with GPS coordinates
const COURSE_DATA: { hole: number; par: number; lat: number; lng: number }[] = [
  { hole: 1, par: 5, lat: 46.0665, lng: -64.7314 },
  { hole: 2, par: 3, lat: 46.0652, lng: -64.7302 },
  { hole: 3, par: 4, lat: 46.0629, lng: -64.7296 },
  { hole: 4, par: 3, lat: 46.0608, lng: -64.7281 },
  { hole: 5, par: 5, lat: 46.0614, lng: -64.7246 },
  { hole: 6, par: 4, lat: 46.0633, lng: -64.7229 },
  { hole: 7, par: 4, lat: 46.0654, lng: -64.7241 },
  { hole: 8, par: 3, lat: 46.0677, lng: -64.7266 },
  { hole: 9, par: 5, lat: 46.0686, lng: -64.7291 },
  { hole: 10, par: 5, lat: 46.0691, lng: -64.7321 },
  { hole: 11, par: 4, lat: 46.0714, lng: -64.7346 },
  { hole: 12, par: 4, lat: 46.0731, lng: -64.7361 },
  { hole: 13, par: 3, lat: 46.0719, lng: -64.7386 },
  { hole: 14, par: 4, lat: 46.0706, lng: -64.7411 },
  { hole: 15, par: 5, lat: 46.0689, lng: -64.7424 },
  { hole: 16, par: 4, lat: 46.0671, lng: -64.7404 },
  { hole: 17, par: 3, lat: 46.0656, lng: -64.7381 },
  { hole: 18, par: 4, lat: 46.0672, lng: -64.7356 },
];

const DEFAULT_PLAYERS: Player[] = [
  { id: 0, name: 'Player 1', initials: 'P1' },
  { id: 1, name: 'Player 2', initials: 'P2' },
  { id: 2, name: 'Player 3', initials: 'P3' },
  { id: 3, name: 'Player 4', initials: 'P4' },
];

const createInitialScores = (): HoleScore[] => {
  return COURSE_DATA.map(({ hole, par }) => ({
    hole,
    par,
    scores: [null, null, null, null],
  }));
};

export const useScorecardStore = create<ScorecardState>((set, get) => ({
  players: DEFAULT_PLAYERS,
  scores: createInitialScores(),
  currentHole: 1,
  holeStartTime: Date.now(),
  elapsedSeconds: 0,
  isTracking: false,
  isTurnPaused: false,
  turnTimeRemaining: 0,
  isScorePromptVisible: false,
  pendingHoleTransition: null,
  hasUnfinishedRound: false,
  showResumePrompt: false,
  showRoundSummary: false,
  roundStartTime: Date.now(),
  roundHistory: [],

  setPlayerName: (playerId, name) => {
    const initials = name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || `P${playerId + 1}`;

    set((state) => ({
      players: state.players.map((p) =>
        p.id === playerId ? { ...p, name, initials } : p
      ),
    }));
    // Auto-save after player name change
    get().saveRound();
  },

  setScore: (hole, playerId, score) => {
    set((state) => ({
      scores: state.scores.map((h) =>
        h.hole === hole
          ? { ...h, scores: h.scores.map((s, i) => (i === playerId ? score : s)) }
          : h
      ),
    }));
    // Auto-save after score entry
    get().saveRound();
  },

  setCurrentHole: (hole) => {
    set({ currentHole: hole, holeStartTime: Date.now(), elapsedSeconds: 0 });
    get().saveRound();
  },

  resetHoleTimer: () => {
    set({ holeStartTime: Date.now(), elapsedSeconds: 0 });
  },

  updateElapsedTime: () => {
    const { holeStartTime } = get();
    const elapsed = Math.floor((Date.now() - holeStartTime) / 1000);
    set({ elapsedSeconds: elapsed });
  },

  startTracking: () => {
    set({ isTracking: true, holeStartTime: Date.now(), elapsedSeconds: 0, roundStartTime: Date.now() });
    get().saveRound();
  },

  stopTracking: () => {
    set({ isTracking: false });
    get().saveRound();
  },

  startTurn: () => {
    set({ isTurnPaused: true, turnTimeRemaining: 10 * 60 }); // 10 minutes
    get().saveRound();
  },

  updateTurnTime: () => {
    const { turnTimeRemaining } = get();
    if (turnTimeRemaining <= 1) {
      // Turn break is over, advance to hole 10
      set({
        isTurnPaused: false,
        turnTimeRemaining: 0,
        currentHole: 10,
        holeStartTime: Date.now(),
        elapsedSeconds: 0
      });
      get().saveRound();
    } else {
      set({ turnTimeRemaining: turnTimeRemaining - 1 });
    }
  },

  skipTurn: () => {
    set({
      isTurnPaused: false,
      turnTimeRemaining: 0,
      currentHole: 10,
      holeStartTime: Date.now(),
      elapsedSeconds: 0
    });
    get().saveRound();
  },

  triggerHoleComplete: (completedHole) => {
    const { elapsedSeconds, scores } = get();
    const timestamp = Date.now();

    // Save the timestamp and duration for the completed hole
    set({
      isScorePromptVisible: true,
      pendingHoleTransition: completedHole,
      scores: scores.map((h) =>
        h.hole === completedHole
          ? { ...h, completedAt: timestamp, duration: elapsedSeconds }
          : h
      ),
    });
    get().saveRound();
  },

  confirmScoreAndAdvance: () => {
    const { pendingHoleTransition } = get();
    if (pendingHoleTransition === null) return;

    const nextHole = pendingHoleTransition + 1;

    // Check if this was hole 9 - trigger The Turn
    if (pendingHoleTransition === 9) {
      set({
        isScorePromptVisible: false,
        pendingHoleTransition: null,
        isTurnPaused: true,
        turnTimeRemaining: 10 * 60, // 10 minutes
      });
    } else if (nextHole <= 18) {
      set({
        isScorePromptVisible: false,
        pendingHoleTransition: null,
        currentHole: nextHole,
        holeStartTime: Date.now(),
        elapsedSeconds: 0,
      });
    } else {
      // Round complete - clear saved data
      set({
        isScorePromptVisible: false,
        pendingHoleTransition: null,
        isTracking: false,
      });
      get().discardSavedRound();
      return;
    }
    get().saveRound();
  },

  dismissScorePrompt: () => {
    set({
      isScorePromptVisible: false,
      pendingHoleTransition: null,
    });
  },

  getTotalScore: (playerId) => {
    const { scores } = get();
    return scores.reduce((sum, hole) => {
      const score = hole.scores[playerId];
      return sum + (score ?? 0);
    }, 0);
  },

  getRelativeToPar: (playerId) => {
    const { scores } = get();
    let totalScore = 0;
    let totalPar = 0;

    scores.forEach((hole) => {
      const score = hole.scores[playerId];
      if (score !== null) {
        totalScore += score;
        totalPar += hole.par;
      }
    });

    return totalScore - totalPar;
  },

  getCoursePar: () => {
    const { scores } = get();
    return scores.reduce((sum, hole) => sum + hole.par, 0);
  },

  getTotalRoundTime: () => {
    const { scores, roundStartTime } = get();
    // Sum all hole durations
    const totalDuration = scores.reduce((sum, hole) => sum + (hole.duration ?? 0), 0);
    if (totalDuration > 0) return totalDuration;
    // Fallback to time since round started
    return Math.floor((Date.now() - roundStartTime) / 1000);
  },

  getHolesCompleted: (playerId) => {
    const { scores } = get();
    return scores.filter((hole) => hole.scores[playerId] !== null).length;
  },

  isRoundComplete: () => {
    const { scores } = get();
    // Check if all 18 holes have at least one player with a score
    return scores.every((hole) => hole.scores.some((score) => score !== null));
  },

  finishRound: () => {
    set({ showRoundSummary: true, isTracking: false });
  },

  saveRoundToHistory: async () => {
    try {
      const { players, scores, roundHistory, roundStartTime } = get();
      const coursePar = get().getCoursePar();
      const totalTime = get().getTotalRoundTime();

      const newRound: RoundSummary = {
        id: Date.now().toString(),
        date: Date.now(),
        players: [...players],
        scores: scores.map((h) => ({ ...h, scores: [...h.scores] })),
        totalTime,
        coursePar,
      };

      const updatedHistory = [newRound, ...roundHistory].slice(0, 50); // Keep last 50 rounds

      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));
      set({ roundHistory: updatedHistory });
    } catch (error) {
      console.log('Error saving round to history:', error);
    }
  },

  loadRoundHistory: async () => {
    try {
      const historyData = await AsyncStorage.getItem(HISTORY_KEY);
      if (historyData) {
        const parsed: RoundSummary[] = JSON.parse(historyData);
        set({ roundHistory: parsed });
      }
    } catch (error) {
      console.log('Error loading round history:', error);
    }
  },

  deleteRound: async (roundId: string) => {
    try {
      const { roundHistory } = get();
      const updatedHistory = roundHistory.filter((round) => round.id !== roundId);
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));
      set({ roundHistory: updatedHistory });
    } catch (error) {
      console.log('Error deleting round:', error);
    }
  },

  dismissRoundSummary: () => {
    set({ showRoundSummary: false });
  },

  saveRound: async () => {
    try {
      const { players, scores, currentHole, holeStartTime, elapsedSeconds, isTracking, isTurnPaused, turnTimeRemaining, roundStartTime } = get();

      // Only save if tracking is active (round in progress)
      if (!isTracking && !isTurnPaused) return;

      const dataToSave: SavedRoundData = {
        players,
        scores,
        currentHole,
        holeStartTime,
        elapsedSeconds,
        isTracking,
        isTurnPaused,
        turnTimeRemaining,
        savedAt: Date.now(),
        roundStartTime,
      };

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    } catch (error) {
      console.log('Error saving round:', error);
    }
  },

  loadSavedRound: async () => {
    try {
      const savedData = await AsyncStorage.getItem(STORAGE_KEY);
      if (savedData) {
        const parsed: SavedRoundData = JSON.parse(savedData);

        // Check if round has any scores entered (not just started)
        const hasScores = parsed.scores.some(hole =>
          hole.scores.some(score => score !== null)
        );

        // Only show resume prompt if round was in progress with scores
        if ((parsed.isTracking || parsed.isTurnPaused) || hasScores) {
          set({
            hasUnfinishedRound: true,
            showResumePrompt: true,
          });
        }
      }
    } catch (error) {
      console.log('Error loading saved round:', error);
    }
  },

  resumeRound: async () => {
    try {
      const savedData = await AsyncStorage.getItem(STORAGE_KEY);
      if (savedData) {
        const parsed: SavedRoundData = JSON.parse(savedData);

        // Calculate elapsed time since save
        const timeSinceSave = Math.floor((Date.now() - parsed.savedAt) / 1000);

        // Adjust hole start time to account for time passed while app was closed
        const adjustedHoleStartTime = parsed.holeStartTime;

        set({
          players: parsed.players,
          scores: parsed.scores,
          currentHole: parsed.currentHole,
          holeStartTime: adjustedHoleStartTime,
          elapsedSeconds: parsed.elapsedSeconds + timeSinceSave,
          isTracking: parsed.isTracking,
          isTurnPaused: parsed.isTurnPaused,
          turnTimeRemaining: Math.max(0, parsed.turnTimeRemaining - timeSinceSave),
          hasUnfinishedRound: false,
          showResumePrompt: false,
          roundStartTime: parsed.roundStartTime ?? Date.now(),
        });
      }
    } catch (error) {
      console.log('Error resuming round:', error);
    }
  },

  discardSavedRound: async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      set({
        hasUnfinishedRound: false,
        showResumePrompt: false,
      });
    } catch (error) {
      console.log('Error discarding saved round:', error);
    }
  },

  resetRound: async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    set({
      players: DEFAULT_PLAYERS,
      scores: createInitialScores(),
      currentHole: 1,
      holeStartTime: Date.now(),
      elapsedSeconds: 0,
      isTracking: false,
      isTurnPaused: false,
      turnTimeRemaining: 0,
      isScorePromptVisible: false,
      pendingHoleTransition: null,
      hasUnfinishedRound: false,
      showResumePrompt: false,
      showRoundSummary: false,
      roundStartTime: Date.now(),
    });
  },
}));
