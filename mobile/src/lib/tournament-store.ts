/**
 * Tournament live scoring + side games state (Zustand).
 * Local state syncs to Supabase via tournament-service on demand.
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  TeeName,
  TournamentFormat,
  TournamentHoleScore,
  WageringGameType,
  WageringResults,
  WageringSettings,
} from '@/types';
import {
  buildBestBallPlayerDetails,
  buildTournamentHoleScores,
  getPlayingHandicap,
  sumHoleScores,
  type PlayerGrossScores,
} from './tournament-scoring';
import {
  getScoresForMatchGroup,
  getSinglesRoundScore,
  getSinglesRoundScoreByTournamentPlayer,
  getTeamRoundScore,
  saveTournamentScore,
} from './tournament-service';
import {
  getTournamentMatchGroups,
  syncMatchHoleResults,
} from './tournament-match-service';
import {
  calculateSkinsResults,
  calculateStablefordResults,
  type PlayerNetScores,
} from './wagering-engine';
import { FOX_CREEK_DATA } from './course-data';

const STORAGE_KEY = '@foxcreek_tournament_session';

export interface TournamentStorePlayer {
  id: string;
  name: string;
  handicapIndex: number;
  playingHandicap: number;
  /** When set, singles scores save to tournament_player_id instead of user_id. */
  tournamentPlayerId?: string | null;
}

interface PersistedSession {
  tournamentId: string;
  roundFormats: TournamentFormat[];
  format: TournamentFormat;
  roundNumber: number;
  teamId: string | null;
  teamName: string | null;
  userId: string | null;
  matchGroupId: string | null;
  currentHole: number;
  teePlayed: TeeName;
  players: TournamentStorePlayer[];
  grossScores: Record<string, Record<number, number>>;
  teamGrossScores: Record<number, number>;
}

interface TournamentStoreState {
  tournamentId: string | null;
  roundFormats: TournamentFormat[];
  format: TournamentFormat | null;
  roundNumber: number;
  teamId: string | null;
  teamName: string | null;
  userId: string | null;
  matchGroupId: string | null;
  currentHole: number;
  teePlayed: TeeName;
  players: TournamentStorePlayer[];
  grossScores: Record<string, Record<number, number>>;
  teamGrossScores: Record<number, number>;
  isDirty: boolean;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  leaderboardMode: 'gross' | 'net';
  wageringSessionId: string | null;
  wageringGameType: WageringGameType | null;
  wageringSettings: WageringSettings | null;
  wageringResults: WageringResults | null;

  initSession: (params: {
    tournamentId: string;
    roundFormats: TournamentFormat[];
    roundNumber?: number;
    format?: TournamentFormat;
    teamId?: string | null;
    teamName?: string | null;
    userId?: string | null;
    matchGroupId?: string | null;
    players: Array<{
      id: string;
      name: string;
      handicapIndex: number;
      tournamentPlayerId?: string | null;
    }>;
    teePlayed?: TeeName;
  }) => void;
  setRoundNumber: (roundNumber: number) => void;
  switchRound: (params: {
    roundNumber: number;
    format?: TournamentFormat;
    teamId?: string | null;
    teamName?: string | null;
    userId?: string | null;
    matchGroupId?: string | null;
    players: Array<{
      id: string;
      name: string;
      handicapIndex: number;
      tournamentPlayerId?: string | null;
    }>;
  }) => void;
  setCurrentHole: (hole: number) => void;
  setPlayerGross: (playerId: string, hole: number, gross: number) => void;
  setTeamGross: (hole: number, gross: number) => void;
  loadExistingScores: () => Promise<void>;
  getComputedHoleScores: () => TournamentHoleScore[];
  getPlayerHoleDetails: (playerId: string) => ReturnType<typeof buildBestBallPlayerDetails>[string] | null;
  getTotals: () => { total_gross: number; total_net: number };
  syncScoresToSupabase: () => Promise<{ success: boolean; error?: string }>;
  setLeaderboardMode: (mode: 'gross' | 'net') => void;
  setWageringLive: (params: {
    sessionId: string;
    gameType: WageringGameType;
    settings: WageringSettings;
  }) => void;
  recalculateWagering: () => void;
  persistSession: () => Promise<void>;
  restoreSession: (tournamentId: string) => Promise<boolean>;
  reset: () => void;
}

function buildInitialGrossMap(): Record<number, number> {
  const map: Record<number, number> = {};
  FOX_CREEK_DATA.holeData.forEach((h) => {
    map[h.holeNumber] = h.par;
  });
  return map;
}

function buildPlayerGrossScores(
  players: TournamentStorePlayer[],
  grossScores: Record<string, Record<number, number>>
): PlayerGrossScores[] {
  return players.map((player) => ({
    playerId: player.id,
    handicapIndex: player.handicapIndex,
    holes: Object.entries(grossScores[player.id] ?? buildInitialGrossMap()).map(
      ([hole, gross]) => ({
        hole: Number(hole),
        gross,
      })
    ),
  }));
}

const initialState = {
  tournamentId: null,
  roundFormats: [] as TournamentFormat[],
  format: null,
  roundNumber: 1,
  teamId: null,
  teamName: null,
  userId: null,
  matchGroupId: null,
  currentHole: 1,
  teePlayed: 'White' as TeeName,
  players: [] as TournamentStorePlayer[],
  grossScores: {} as Record<string, Record<number, number>>,
  teamGrossScores: buildInitialGrossMap(),
  isDirty: false,
  isSyncing: false,
  lastSyncedAt: null as string | null,
  leaderboardMode: 'net' as const,
  wageringSessionId: null,
  wageringGameType: null,
  wageringSettings: null,
  wageringResults: null,
};

export const useTournamentStore = create<TournamentStoreState>((set, get) => ({
  ...initialState,

  initSession: ({
    tournamentId,
    roundFormats,
    roundNumber = 1,
    format: formatOverride,
    teamId = null,
    teamName = null,
    userId = null,
    matchGroupId = null,
    players,
    teePlayed = 'White',
  }) => {
    const format =
      formatOverride ?? roundFormats[roundNumber - 1] ?? roundFormats[0] ?? 'scramble';
    const grossScores: Record<string, Record<number, number>> = {};
    const storePlayers: TournamentStorePlayer[] = players.map((player) => ({
      id: player.id,
      name: player.name,
      handicapIndex: player.handicapIndex,
      playingHandicap: getPlayingHandicap(player.handicapIndex, format, teePlayed),
      tournamentPlayerId: player.tournamentPlayerId ?? null,
    }));

    for (const player of storePlayers) {
      grossScores[player.id] = buildInitialGrossMap();
    }

    set({
      ...initialState,
      tournamentId,
      roundFormats,
      format,
      roundNumber,
      teamId,
      teamName,
      userId,
      matchGroupId,
      players: storePlayers,
      grossScores,
      teamGrossScores: buildInitialGrossMap(),
      teePlayed,
      isDirty: false,
    });
  },

  setRoundNumber: (roundNumber) => {
    const state = get();
    const format = state.roundFormats[roundNumber - 1] ?? state.format;
    if (!format) {
      set({ roundNumber, isDirty: true });
      return;
    }

    const players = state.players.map((player) => ({
      ...player,
      playingHandicap: getPlayingHandicap(player.handicapIndex, format, state.teePlayed),
    }));

    set({ roundNumber, format, players, isDirty: true });
  },

  switchRound: ({
    roundNumber,
    format: formatOverride,
    teamId = null,
    teamName = null,
    userId = null,
    matchGroupId = null,
    players,
  }) => {
    const state = get();
    const format =
      formatOverride ??
      state.roundFormats[roundNumber - 1] ??
      state.format ??
      'scramble';
    const grossScores: Record<string, Record<number, number>> = {};
    const storePlayers: TournamentStorePlayer[] = players.map((player) => ({
      id: player.id,
      name: player.name,
      handicapIndex: player.handicapIndex,
      playingHandicap: getPlayingHandicap(player.handicapIndex, format, state.teePlayed),
      tournamentPlayerId: player.tournamentPlayerId ?? null,
    }));

    for (const player of storePlayers) {
      grossScores[player.id] = buildInitialGrossMap();
    }

    set({
      roundNumber,
      format,
      teamId,
      teamName,
      userId,
      matchGroupId,
      players: storePlayers,
      grossScores,
      teamGrossScores: buildInitialGrossMap(),
      isDirty: false,
    });
  },

  setCurrentHole: (hole) => {
    set({ currentHole: Math.min(18, Math.max(1, hole)) });
  },

  setPlayerGross: (playerId, hole, gross) => {
    set((state) => ({
      grossScores: {
        ...state.grossScores,
        [playerId]: {
          ...(state.grossScores[playerId] ?? buildInitialGrossMap()),
          [hole]: Math.max(1, gross),
        },
      },
      isDirty: true,
    }));
    get().recalculateWagering();
  },

  setTeamGross: (hole, gross) => {
    set((state) => ({
      teamGrossScores: {
        ...state.teamGrossScores,
        [hole]: Math.max(1, gross),
      },
      isDirty: true,
    }));
    get().recalculateWagering();
  },

  loadExistingScores: async () => {
    const state = get();
    if (!state.tournamentId || !state.format) return;

    if (state.matchGroupId) {
      const scores = await getScoresForMatchGroup(state.matchGroupId, state.roundNumber);
      if (scores.length === 0) return;

      if (state.format === 'singles') {
        const grossScores = { ...state.grossScores };
        for (const player of state.players) {
          const card = scores.find(
            (s) =>
              s.tournament_player_id === (player.tournamentPlayerId ?? player.id) ||
              s.user_id === player.id
          );
          if (!card?.hole_scores?.length) continue;
          const map = buildInitialGrossMap();
          card.hole_scores.forEach((h) => {
            map[h.hole] = h.gross;
          });
          grossScores[player.id] = map;
        }
        set({ grossScores, isDirty: false });
        return;
      }

      if (state.teamId) {
        const card = scores.find((s) => s.team_id === state.teamId);
        if (!card?.hole_scores?.length) return;

        if (state.format === 'best_ball') {
          const grossScores = { ...state.grossScores };
          for (const player of state.players) {
            grossScores[player.id] = buildInitialGrossMap();
          }
          set({ grossScores, isDirty: false });
          return;
        }

        const teamGross = buildInitialGrossMap();
        card.hole_scores.forEach((h) => {
          teamGross[h.hole] = h.gross;
        });
        set({ teamGrossScores: teamGross, isDirty: false });
      }
      return;
    }

    let existing = null;

    if (state.format === 'singles' && state.userId && !state.players.some((p) => p.tournamentPlayerId)) {
      existing = await getSinglesRoundScore(
        state.tournamentId,
        state.userId,
        state.roundNumber
      );
    } else if (state.format === 'singles' && state.players.length === 1 && state.players[0].tournamentPlayerId) {
      existing = await getSinglesRoundScoreByTournamentPlayer(
        state.tournamentId,
        state.players[0].tournamentPlayerId,
        state.roundNumber
      );
    } else if (state.teamId) {
      existing = await getTeamRoundScore(
        state.tournamentId,
        state.teamId,
        state.roundNumber
      );
    }

    if (!existing?.hole_scores?.length) return;

    if (state.format === 'best_ball') {
      const grossScores = { ...state.grossScores };
      for (const player of state.players) {
        grossScores[player.id] = buildInitialGrossMap();
      }
      set({ grossScores, isDirty: false });
      return;
    }

    const teamGross = buildInitialGrossMap();
    existing.hole_scores.forEach((h) => {
      teamGross[h.hole] = h.gross;
    });

    if (state.format === 'singles' && state.userId) {
      set({
        grossScores: {
          ...state.grossScores,
          [state.userId]: teamGross,
        },
        isDirty: false,
      });
      return;
    }

    set({ teamGrossScores: teamGross, isDirty: false });
  },

  getComputedHoleScores: () => {
    const state = get();
    if (!state.format) return [];

    if (state.format === 'singles') {
      const player = state.players[0];
      if (!player) return [];
      return buildTournamentHoleScores({
        format: 'singles',
        grossByHole: Object.entries(state.grossScores[player.id] ?? {}).map(
          ([hole, gross]) => ({ hole: Number(hole), gross })
        ),
        handicapIndex: player.handicapIndex,
        teePlayed: state.teePlayed,
      });
    }

    if (state.format === 'best_ball') {
      return buildTournamentHoleScores({
        format: 'best_ball',
        players: buildPlayerGrossScores(state.players, state.grossScores),
        teePlayed: state.teePlayed,
      });
    }

    return buildTournamentHoleScores({
      format: state.format,
      grossByHole: Object.entries(state.teamGrossScores).map(([hole, gross]) => ({
        hole: Number(hole),
        gross,
      })),
      players: buildPlayerGrossScores(state.players, state.grossScores),
      teePlayed: state.teePlayed,
    });
  },

  getPlayerHoleDetails: (playerId) => {
    const state = get();
    if (state.format !== 'best_ball') return null;
    const details = buildBestBallPlayerDetails(
      buildPlayerGrossScores(state.players, state.grossScores),
      state.teePlayed
    );
    return details[playerId] ?? null;
  },

  getTotals: () => sumHoleScores(get().getComputedHoleScores()),

  syncScoresToSupabase: async () => {
    const state = get();
    if (!state.tournamentId || !state.format) {
      return { success: false, error: 'No active tournament session' };
    }

    set({ isSyncing: true });

    try {
      const matchGroupId = state.matchGroupId;

      if (state.format === 'singles' && state.players.length > 1) {
        for (const player of state.players) {
          const holeScores = buildTournamentHoleScores({
            format: 'singles',
            grossByHole: Object.entries(state.grossScores[player.id] ?? {}).map(
              ([hole, gross]) => ({ hole: Number(hole), gross })
            ),
            handicapIndex: player.handicapIndex,
            teePlayed: state.teePlayed,
          });
          const totals = sumHoleScores(holeScores);
          const saved = await saveTournamentScore({
            tournament_id: state.tournamentId,
            round_number: state.roundNumber,
            hole_scores: holeScores,
            ...totals,
            user_id: player.tournamentPlayerId ? null : player.id,
            tournament_player_id: player.tournamentPlayerId ?? null,
            team_id: null,
            match_group_id: matchGroupId,
          });
          if (!saved) {
            return { success: false, error: 'Failed to save player scores' };
          }
        }
      } else {
        const holeScores = state.getComputedHoleScores();
        const totals = sumHoleScores(holeScores);

        const singlePlayer = state.players[0];
        const saved = await saveTournamentScore({
          tournament_id: state.tournamentId,
          round_number: state.roundNumber,
          hole_scores: holeScores,
          ...totals,
          team_id: state.format === 'singles' ? null : state.teamId,
          user_id:
            state.format === 'singles'
              ? singlePlayer?.tournamentPlayerId
                ? null
                : state.userId
              : null,
          tournament_player_id:
            state.format === 'singles' ? singlePlayer?.tournamentPlayerId ?? null : null,
          match_group_id: matchGroupId,
        });

        if (!saved) {
          return { success: false, error: 'Failed to save scores' };
        }
      }

      if (matchGroupId) {
        const groups = await getTournamentMatchGroups(state.tournamentId!);
        const matchGroup = groups.find((g) => g.id === matchGroupId);
        if (matchGroup) {
          const scores = await getScoresForMatchGroup(matchGroupId, state.roundNumber);
          await syncMatchHoleResults({
            matchGroup,
            roundNumber: state.roundNumber,
            format: matchGroup.format ?? state.format ?? 'scramble',
            scores,
          });
        }
      }

      set({
        isDirty: false,
        isSyncing: false,
        lastSyncedAt: new Date().toISOString(),
      });
      await get().persistSession();
      return { success: true };
    } catch {
      set({ isSyncing: false });
      return { success: false, error: 'Unexpected error saving scores' };
    }
  },

  setLeaderboardMode: (mode) => set({ leaderboardMode: mode }),

  setWageringLive: ({ sessionId, gameType, settings }) => {
    set({
      wageringSessionId: sessionId,
      wageringGameType: gameType,
      wageringSettings: settings,
      wageringResults: null,
    });
    get().recalculateWagering();
  },

  recalculateWagering: () => {
    const state = get();
    if (!state.wageringGameType || !state.wageringSettings) return;

    const playerInputs: PlayerNetScores[] = state.players.map((player) => ({
      playerId: player.id,
      courseHandicap: player.playingHandicap,
      grossByHole: Object.entries(state.grossScores[player.id] ?? buildInitialGrossMap()).map(
        ([hole, gross]) => ({ hole: Number(hole), gross })
      ),
    }));

    if (state.wageringGameType === 'skins') {
      set({
        wageringResults: calculateSkinsResults(
          playerInputs,
          state.wageringSettings as { carryover: boolean; value_per_skin?: number }
        ),
      });
      return;
    }

    set({
      wageringResults: calculateStablefordResults(
        playerInputs,
        state.wageringSettings as { point_values: Record<string, number> }
      ),
    });
  },

  persistSession: async () => {
    const state = get();
    if (!state.tournamentId || !state.format) return;

    const payload: PersistedSession = {
      tournamentId: state.tournamentId,
      roundFormats: state.roundFormats,
      format: state.format!,
      roundNumber: state.roundNumber,
      teamId: state.teamId,
      teamName: state.teamName,
      userId: state.userId,
      matchGroupId: state.matchGroupId,
      currentHole: state.currentHole,
      teePlayed: state.teePlayed,
      players: state.players,
      grossScores: state.grossScores,
      teamGrossScores: state.teamGrossScores,
    };

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  },

  restoreSession: async (tournamentId) => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return false;

      const data = JSON.parse(raw) as PersistedSession & { roundFormats?: TournamentFormat[] };
      if (data.tournamentId !== tournamentId) return false;

      const roundFormats = data.roundFormats ?? [data.format];

      set({
        tournamentId: data.tournamentId,
        roundFormats,
        format: roundFormats[data.roundNumber - 1] ?? data.format,
        roundNumber: data.roundNumber,
        teamId: data.teamId,
        teamName: data.teamName,
        userId: data.userId,
        matchGroupId: data.matchGroupId ?? null,
        currentHole: data.currentHole,
        teePlayed: data.teePlayed,
        players: data.players,
        grossScores: data.grossScores,
        teamGrossScores: data.teamGrossScores,
        isDirty: true,
      });
      return true;
    } catch {
      return false;
    }
  },

  reset: () => set({ ...initialState, teamGrossScores: buildInitialGrossMap() }),
}));

export const useTournamentPlayers = () => useTournamentStore((s) => s.players);
export const useTournamentCurrentHole = () => useTournamentStore((s) => s.currentHole);
export const useTournamentTotals = () => useTournamentStore((s) => s.getTotals());
export const useTournamentIsDirty = () => useTournamentStore((s) => s.isDirty);
export const useTournamentWageringResults = () => useTournamentStore((s) => s.wageringResults);
export const useTournamentLeaderboardMode = () => useTournamentStore((s) => s.leaderboardMode);
