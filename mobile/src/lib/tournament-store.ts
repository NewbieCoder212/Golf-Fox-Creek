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
  TournamentScoreInsert,
  WageringGameType,
  WageringResults,
  WageringSettings,
} from '@/types';
import {
  buildBestBallPlayerDetails,
  buildTournamentHoleScores,
  getPlayingHandicap,
  inferNextHoleFromEntry,
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
  clearTournamentMatchScoresViaBackend,
  syncTournamentMatchScoresViaBackend,
} from './tournament-score-sync-service';
import {
  getTournamentMatchGroups,
  getMatchHoleResults,
} from './tournament-match-service';
import type { HoleOutcomesMap, PairingOutcomesMap } from './match-hole-outcomes';
import {
  holeResultsToOutcomes,
  holeResultsToPairingOutcomes,
  setHoleOutcome as applyHoleOutcome,
} from './match-hole-outcomes';
import type { TournamentMatchHoleWinner } from '@/types';
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
  /** Team this player represents (best ball foursome). */
  teamId?: string | null;
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
  matchRosterPlayers?: TournamentStorePlayer[];
  grossScores: Record<string, Record<number, number>>;
  teamGrossScores: Record<number, number>;
  holeOutcomes: HoleOutcomesMap;
  pairingOutcomes: PairingOutcomesMap;
  activePairingIndex: number;
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
  matchRosterPlayers: TournamentStorePlayer[];
  grossScores: Record<string, Record<number, number>>;
  teamGrossScores: Record<number, number>;
  holeOutcomes: HoleOutcomesMap;
  pairingOutcomes: PairingOutcomesMap;
  activePairingIndex: number;
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
      playingHandicap: number;
      tournamentPlayerId?: string | null;
      teamId?: string | null;
    }>;
    matchRosterPlayers?: Array<{
      id: string;
      name: string;
      handicapIndex: number;
      playingHandicap: number;
      tournamentPlayerId?: string | null;
      teamId?: string | null;
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
      playingHandicap: number;
      tournamentPlayerId?: string | null;
      teamId?: string | null;
    }>;
    matchRosterPlayers?: Array<{
      id: string;
      name: string;
      handicapIndex: number;
      playingHandicap: number;
      tournamentPlayerId?: string | null;
      teamId?: string | null;
    }>;
  }) => void;
  setCurrentHole: (hole: number) => void;
  setActivePairingIndex: (index: number) => void;
  setHoleOutcome: (hole: number, winner: TournamentMatchHoleWinner, pairingIndex?: number) => void;
  clearHoleOutcome: (hole: number, pairingIndex?: number) => void;
  setPlayerGross: (playerId: string, hole: number, gross: number) => void;
  setTeamGross: (hole: number, gross: number) => void;
  loadExistingScores: () => Promise<void>;
  clearMatchRoundScores: () => Promise<{ success: boolean; error?: string }>;
  getComputedHoleScores: () => TournamentHoleScore[];
  getPlayerHoleDetails: (playerId: string) => ReturnType<typeof buildBestBallPlayerDetails>[string] | null;
  getTotals: () => { total_gross: number; total_net: number };
  syncScoresToSupabase: (options?: {
    matchUseNetScoring?: boolean;
  }) => Promise<{ success: boolean; error?: string }>;
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
  clearPersistedSession: () => Promise<void>;
}

/** Only holes actually saved on a scorecard — never pad with par placeholders. */
function grossMapFromSavedHoles(
  holeScores: TournamentHoleScore[] | undefined
): Record<number, number> {
  const map: Record<number, number> = {};
  if (!holeScores?.length) return map;

  for (const row of holeScores) {
    if (row.entered === false) continue;
    if (row.entered !== true && holeScores.length === 18) continue;
    map[row.hole] = row.gross;
  }
  return map;
}

function isLikelyParPlaceholderMap(map: Record<number, number>): boolean {
  const entries = Object.entries(map);
  if (entries.length !== 18) return false;
  return FOX_CREEK_DATA.holeData.every(
    (hole) => map[hole.holeNumber] === hole.par
  );
}

function inferNextHoleFromOutcomes(outcomes: HoleOutcomesMap): number {
  const played = Object.entries(outcomes)
    .filter(([, winner]) => winner != null)
    .map(([hole]) => Number(hole));
  if (played.length === 0) return 1;
  return Math.min(18, Math.max(...played) + 1);
}

function sanitizeGrossScoresState(
  grossScores: Record<string, Record<number, number>>
): Record<string, Record<number, number>> {
  const sanitized: Record<string, Record<number, number>> = {};
  for (const [playerId, holes] of Object.entries(grossScores)) {
    sanitized[playerId] = isLikelyParPlaceholderMap(holes) ? {} : holes;
  }
  return sanitized;
}

function sanitizeTeamGrossScores(
  teamGrossScores: Record<number, number>
): Record<number, number> {
  return isLikelyParPlaceholderMap(teamGrossScores) ? {} : teamGrossScores;
}

function buildEmptyPlayerGrossMaps(
  players: TournamentStorePlayer[]
): Record<string, Record<number, number>> {
  const grossScores: Record<string, Record<number, number>> = {};
  for (const player of players) {
    grossScores[player.id] = {};
  }
  return grossScores;
}

function mergeGrossScoreMaps(
  local: Record<string, Record<number, number>>,
  remote: Record<string, Record<number, number>>
): Record<string, Record<number, number>> {
  const merged: Record<string, Record<number, number>> = {};
  const playerIds = new Set([...Object.keys(local), ...Object.keys(remote)]);

  for (const playerId of playerIds) {
    const existing = { ...(local[playerId] ?? {}) };
    for (const [holeStr, gross] of Object.entries(remote[playerId] ?? {})) {
      const hole = Number(holeStr);
      if (!Number.isFinite(hole)) continue;
      if (existing[hole] == null) existing[hole] = gross;
    }
    merged[playerId] = existing;
  }

  return merged;
}

function hasAnyGrossProgress(
  grossScores: Record<string, Record<number, number>>,
  teamGrossScores: Record<number, number>
): boolean {
  if (Object.keys(teamGrossScores).length > 0) return true;
  return Object.values(grossScores).some((holes) => Object.keys(holes).length > 0);
}

function scorecardPlayersForSync(state: {
  format: TournamentFormat | null;
  players: TournamentStorePlayer[];
  matchRosterPlayers: TournamentStorePlayer[];
  grossScores: Record<string, Record<number, number>>;
  matchGroupId: string | null;
}): TournamentStorePlayer[] {
  if (state.format === 'best_ball' && state.matchGroupId) {
    const rosterById = new Map(state.matchRosterPlayers.map((player) => [player.id, player]));
    const playerById = new Map(state.players.map((player) => [player.id, player]));
    const idsWithScores = Object.entries(state.grossScores)
      .filter(([, holes]) => Object.keys(holes).length > 0)
      .map(([playerId]) => playerId);

    const syncIds = new Set([
      ...state.players.map((player) => player.id),
      ...idsWithScores,
    ]);

    return [...syncIds]
      .map((playerId) => rosterById.get(playerId) ?? playerById.get(playerId))
      .filter((player): player is TournamentStorePlayer => Boolean(player));
  }

  return state.players;
}

function buildPlayerScorePayload(
  state: {
    tournamentId: string;
    roundNumber: number;
    teePlayed: TeeName;
    matchGroupId: string | null;
    grossScores: Record<string, Record<number, number>>;
  },
  player: TournamentStorePlayer
): TournamentScoreInsert {
  const holeScores = buildTournamentHoleScores({
    format: 'singles',
    grossByHole: Object.entries(state.grossScores[player.id] ?? {}).map(
      ([hole, gross]) => ({ hole: Number(hole), gross })
    ),
    handicapIndex: player.handicapIndex,
    teePlayed: state.teePlayed,
    includeUnplayedHoles: false,
  });
  const totals = sumHoleScores(holeScores);
  return {
    tournament_id: state.tournamentId,
    round_number: state.roundNumber,
    hole_scores: holeScores,
    ...totals,
    user_id: player.tournamentPlayerId ? null : player.id,
    tournament_player_id: player.tournamentPlayerId ?? null,
    team_id: null,
    match_group_id: state.matchGroupId,
  };
}

function applyLoadedGrossScores(params: {
  grossScores: Record<string, Record<number, number>>;
  teamGrossScores: Record<number, number>;
  currentHole: number;
  playerIds: string[];
}): { grossScores: Record<string, Record<number, number>>; currentHole: number } {
  const nextHole = inferNextHoleFromEntry(
    params.grossScores,
    params.teamGrossScores,
    params.playerIds
  );
  const currentHole =
    params.currentHole <= 1 && nextHole > 1 ? nextHole : params.currentHole;

  return { grossScores: params.grossScores, currentHole };
}

function buildScoreInsertPayloads(state: {
  tournamentId: string;
  format: TournamentFormat;
  roundNumber: number;
  players: TournamentStorePlayer[];
  matchRosterPlayers: TournamentStorePlayer[];
  grossScores: Record<string, Record<number, number>>;
  teamGrossScores: Record<number, number>;
  teePlayed: TeeName;
  teamId: string | null;
  userId: string | null;
  matchGroupId: string | null;
  getComputedHoleScores: () => TournamentHoleScore[];
}): TournamentScoreInsert[] {
  const matchGroupId = state.matchGroupId;

  if (state.format === 'singles' && state.players.length > 1) {
    return state.players.map((player) => {
      const holeScores = buildTournamentHoleScores({
        format: 'singles',
        grossByHole: Object.entries(state.grossScores[player.id] ?? {}).map(
          ([hole, gross]) => ({ hole: Number(hole), gross })
        ),
        handicapIndex: player.handicapIndex,
        teePlayed: state.teePlayed,
        includeUnplayedHoles: false,
      });
      const totals = sumHoleScores(holeScores);
      return {
        tournament_id: state.tournamentId,
        round_number: state.roundNumber,
        hole_scores: holeScores,
        ...totals,
        user_id: player.tournamentPlayerId ? null : player.id,
        tournament_player_id: player.tournamentPlayerId ?? null,
        team_id: null,
        match_group_id: matchGroupId,
      };
    });
  }

  if (state.format === 'best_ball' && state.players.length > 1) {
    const playersToSync = scorecardPlayersForSync(state);
    return playersToSync
      .filter((player) => Object.keys(state.grossScores[player.id] ?? {}).length > 0)
      .map((player) => buildPlayerScorePayload(state, player));
  }

  const holeScores = state.getComputedHoleScores();
  const totals = sumHoleScores(holeScores);
  const singlePlayer = state.players[0];

  return [
    {
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
    },
  ];
}

function buildPlayerGrossScores(
  players: TournamentStorePlayer[],
  grossScores: Record<string, Record<number, number>>
): PlayerGrossScores[] {
  return players.map((player) => ({
    playerId: player.id,
    handicapIndex: player.handicapIndex,
    playingHandicap: player.playingHandicap,
    holes: Object.entries(grossScores[player.id] ?? {}).map(
      ([hole, gross]) => ({
        hole: Number(hole),
        gross,
      })
    ),
  }));
}

function mapStorePlayer(
  player: {
    id: string;
    name: string;
    handicapIndex: number;
    playingHandicap: number;
    tournamentPlayerId?: string | null;
    teamId?: string | null;
  }
): TournamentStorePlayer {
  return {
    id: player.id,
    name: player.name,
    handicapIndex: player.handicapIndex,
    playingHandicap: player.playingHandicap,
    tournamentPlayerId: player.tournamentPlayerId ?? null,
    teamId: player.teamId ?? null,
  };
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
  matchRosterPlayers: [] as TournamentStorePlayer[],
  grossScores: {} as Record<string, Record<number, number>>,
  teamGrossScores: {} as Record<number, number>,
  holeOutcomes: {} as HoleOutcomesMap,
  pairingOutcomes: {} as PairingOutcomesMap,
  activePairingIndex: 0,
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
    matchRosterPlayers,
    teePlayed = 'White',
  }) => {
    const format =
      formatOverride ?? roundFormats[roundNumber - 1] ?? roundFormats[0] ?? 'scramble';
    const grossScores: Record<string, Record<number, number>> = {};
    const storePlayers: TournamentStorePlayer[] = players.map((player) =>
      mapStorePlayer({
        ...player,
        playingHandicap:
          player.playingHandicap ??
          getPlayingHandicap(player.handicapIndex, format, teePlayed),
      })
    );
    const rosterPlayers: TournamentStorePlayer[] = (matchRosterPlayers ?? players).map((player) =>
      mapStorePlayer({
        ...player,
        playingHandicap:
          player.playingHandicap ??
          getPlayingHandicap(player.handicapIndex, format, teePlayed),
      })
    );

    for (const player of rosterPlayers) {
      grossScores[player.id] = grossScores[player.id] ?? {};
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
      matchRosterPlayers: rosterPlayers,
      grossScores,
      teamGrossScores: {},
      holeOutcomes: {},
      pairingOutcomes: {},
      activePairingIndex: 0,
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
      playingHandicap:
        player.playingHandicap ??
        getPlayingHandicap(player.handicapIndex, format, state.teePlayed),
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
    matchRosterPlayers,
  }) => {
    const state = get();
    const format =
      formatOverride ??
      state.roundFormats[roundNumber - 1] ??
      state.format ??
      'scramble';
    const grossScores: Record<string, Record<number, number>> = {};
    const storePlayers: TournamentStorePlayer[] = players.map((player) =>
      mapStorePlayer({
        ...player,
        playingHandicap:
          player.playingHandicap ??
          getPlayingHandicap(player.handicapIndex, format, state.teePlayed),
      })
    );
    const rosterPlayers: TournamentStorePlayer[] = (matchRosterPlayers ?? players).map((player) =>
      mapStorePlayer({
        ...player,
        playingHandicap:
          player.playingHandicap ??
          getPlayingHandicap(player.handicapIndex, format, state.teePlayed),
      })
    );

    for (const player of rosterPlayers) {
      grossScores[player.id] = {};
    }

    set({
      roundNumber,
      format,
      teamId,
      teamName,
      userId,
      matchGroupId,
      players: storePlayers,
      matchRosterPlayers: rosterPlayers,
      grossScores,
      teamGrossScores: {},
      holeOutcomes: {},
      pairingOutcomes: {},
      activePairingIndex: 0,
      isDirty: false,
    });
  },

  setCurrentHole: (hole) => {
    set({ currentHole: Math.min(18, Math.max(1, hole)) });
  },

  setActivePairingIndex: (index) => {
    set({ activePairingIndex: index });
  },

  setHoleOutcome: (hole, winner, pairingIndex) => {
    set((state) => {
      const isSingles = state.format === 'singles' || state.format === 'match_play';
      if (isSingles) {
        const idx = pairingIndex ?? state.activePairingIndex;
        const current = state.pairingOutcomes[idx] ?? {};
        const nextPairing = applyHoleOutcome(current, hole, winner);
        const nextHole = Math.max(state.currentHole, Math.min(18, hole + 1));
        return {
          pairingOutcomes: { ...state.pairingOutcomes, [idx]: nextPairing },
          currentHole: Math.min(18, nextHole),
          isDirty: true,
        };
      }

      const nextOutcomes = applyHoleOutcome(state.holeOutcomes, hole, winner);
      const nextHole = Math.max(state.currentHole, Math.min(18, hole + 1));
      return {
        holeOutcomes: nextOutcomes,
        currentHole: Math.min(18, nextHole),
        isDirty: true,
      };
    });
    void get().persistSession();
  },

  clearHoleOutcome: (hole, pairingIndex) => {
    set((state) => {
      const isSingles = state.format === 'singles' || state.format === 'match_play';
      if (isSingles) {
        const idx = pairingIndex ?? state.activePairingIndex;
        const current = { ...(state.pairingOutcomes[idx] ?? {}) };
        delete current[hole];
        return {
          pairingOutcomes: { ...state.pairingOutcomes, [idx]: current },
          isDirty: true,
        };
      }
      const next = { ...state.holeOutcomes };
      delete next[hole];
      return { holeOutcomes: next, isDirty: true };
    });
    void get().persistSession();
  },

  setPlayerGross: (playerId, hole, gross) => {
    set((state) => ({
      grossScores: {
        ...state.grossScores,
        [playerId]: {
          ...(state.grossScores[playerId] ?? {}),
          [hole]: Math.max(1, gross),
        },
      },
      currentHole: Math.max(state.currentHole, Math.min(18, hole)),
      isDirty: true,
    }));
    get().recalculateWagering();
    void get().persistSession();
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

    const rosterPlayers =
      state.matchRosterPlayers.length > 0 ? state.matchRosterPlayers : state.players;
    const rosterPlayerIds = rosterPlayers.map((player) => player.id);

    const findCardForPlayer = (
      scores: Awaited<ReturnType<typeof getScoresForMatchGroup>>,
      player: TournamentStorePlayer
    ) =>
      scores.find(
        (score) =>
          score.tournament_player_id === (player.tournamentPlayerId ?? player.id) ||
          score.user_id === player.id
      );

    const remoteGrossFromCards = (
      scores: Awaited<ReturnType<typeof getScoresForMatchGroup>>,
      playersToLoad: TournamentStorePlayer[]
    ) => {
      const remote: Record<string, Record<number, number>> = {};
      for (const player of playersToLoad) {
        const card = findCardForPlayer(scores, player);
        if (!card?.hole_scores?.length) continue;
        remote[player.id] = grossMapFromSavedHoles(card.hole_scores);
      }
      return remote;
    };

    if (state.matchGroupId) {
      const holeResultRows = await getMatchHoleResults(
        state.matchGroupId,
        state.roundNumber
      );

      if (holeResultRows.length > 0) {
        const isSingles = state.format === 'singles' || state.format === 'match_play';
        if (isSingles) {
          const pairingOutcomes = holeResultsToPairingOutcomes(holeResultRows);
          const firstPairing = pairingOutcomes[0] ?? {};
          set({
            pairingOutcomes,
            holeOutcomes: {},
            currentHole: inferNextHoleFromOutcomes(firstPairing),
            isDirty: false,
          });
        } else {
          const holeOutcomes = holeResultsToOutcomes(holeResultRows);
          set({
            holeOutcomes,
            pairingOutcomes: {},
            currentHole: inferNextHoleFromOutcomes(holeOutcomes),
            isDirty: false,
          });
        }
        await get().persistSession();
        return;
      }

      const scores = await getScoresForMatchGroup(state.matchGroupId, state.roundNumber);
      const playersToLoad =
        state.format === 'best_ball' || state.format === 'singles'
          ? rosterPlayers
          : state.players;

      if (scores.length === 0) {
        if (!hasAnyGrossProgress(state.grossScores, state.teamGrossScores)) {
          set({
            grossScores: buildEmptyPlayerGrossMaps(rosterPlayers),
            teamGrossScores: {},
            isDirty: false,
            lastSyncedAt: null,
          });
        } else {
          const applied = applyLoadedGrossScores({
            grossScores: state.grossScores,
            teamGrossScores: state.teamGrossScores,
            currentHole: state.currentHole,
            playerIds: rosterPlayerIds,
          });
          set({
            grossScores: applied.grossScores,
            currentHole: applied.currentHole,
            isDirty: true,
          });
        }
        await get().persistSession();
        return;
      }

      if (state.format === 'singles' || state.format === 'best_ball') {
        const remoteGross = remoteGrossFromCards(scores, playersToLoad);
        const mergedGross = mergeGrossScoreMaps(state.grossScores, remoteGross);
        const applied = applyLoadedGrossScores({
          grossScores: mergedGross,
          teamGrossScores: state.teamGrossScores,
          currentHole: state.currentHole,
          playerIds: rosterPlayerIds,
        });
        set({
          grossScores: applied.grossScores,
          currentHole: applied.currentHole,
          isDirty: false,
        });
        await get().persistSession();
        return;
      }

      if (state.teamId) {
        const card = scores.find((score) => score.team_id === state.teamId);
        if (!card?.hole_scores?.length) return;

        const teamGross = grossMapFromSavedHoles(card.hole_scores);
        const applied = applyLoadedGrossScores({
          grossScores: state.grossScores,
          teamGrossScores: teamGross,
          currentHole: state.currentHole,
          playerIds: rosterPlayerIds,
        });
        set({
          teamGrossScores: teamGross,
          currentHole: applied.currentHole,
          isDirty: false,
        });
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

    if (state.format === 'best_ball' && state.players.length > 1) {
      if (!hasAnyGrossProgress(state.grossScores, state.teamGrossScores)) {
        set({
          grossScores: buildEmptyPlayerGrossMaps(state.players),
          isDirty: false,
          lastSyncedAt: null,
        });
      }
      await get().persistSession();
      return;
    }

    if (!existing?.hole_scores?.length) {
      if (!hasAnyGrossProgress(state.grossScores, state.teamGrossScores)) {
        set({
          grossScores: buildEmptyPlayerGrossMaps(state.players),
          teamGrossScores: {},
          isDirty: false,
          lastSyncedAt: null,
        });
      }
      await get().persistSession();
      return;
    }

    const teamGross = grossMapFromSavedHoles(existing.hole_scores);

    if (state.format === 'singles' && state.userId) {
      const mergedGross = mergeGrossScoreMaps(state.grossScores, {
        [state.userId]: teamGross,
      });
      const applied = applyLoadedGrossScores({
        grossScores: mergedGross,
        teamGrossScores: state.teamGrossScores,
        currentHole: state.currentHole,
        playerIds: [state.userId],
      });
      set({
        grossScores: applied.grossScores,
        currentHole: applied.currentHole,
        isDirty: false,
      });
      return;
    }

    const applied = applyLoadedGrossScores({
      grossScores: state.grossScores,
      teamGrossScores: teamGross,
      currentHole: state.currentHole,
      playerIds: rosterPlayerIds,
    });
    set({
      teamGrossScores: teamGross,
      currentHole: applied.currentHole,
      isDirty: false,
    });
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

  syncScoresToSupabase: async (options) => {
    const state = get();
    if (!state.tournamentId || !state.format) {
      return { success: false, error: 'No active tournament session' };
    }
    if (state.isSyncing) {
      return { success: false, error: 'Save already in progress' };
    }

    const matchUseNetScoring = options?.matchUseNetScoring ?? false;
    const isSingles = state.format === 'singles' || state.format === 'match_play';
    const hasDirectOutcomes =
      Object.keys(state.holeOutcomes).length > 0 ||
      Object.values(state.pairingOutcomes).some((m) => Object.keys(m).length > 0);

    set({ isSyncing: true });

    try {
      const matchGroupId = state.matchGroupId;

      if (matchGroupId) {
        const groups = await getTournamentMatchGroups(state.tournamentId);
        const matchGroup = groups.find((g) => g.id === matchGroupId);
        if (!matchGroup) {
          throw new Error('Match pairing not found');
        }

        const backendResult = await syncTournamentMatchScoresViaBackend({
          tournamentId: state.tournamentId,
          matchGroupId,
          roundNumber: state.roundNumber,
          format: state.format,
          scores: [],
          useNetScoring: matchUseNetScoring,
          matchGroup,
          holeOutcomes: isSingles ? undefined : state.holeOutcomes,
          pairingOutcomes: isSingles ? state.pairingOutcomes : undefined,
        });

        if (!backendResult.success) {
          throw new Error(backendResult.error ?? 'Failed to save scores');
        }
      } else if (hasDirectOutcomes) {
        return { success: false, error: 'Match pairing required to save direct results' };
      } else {
        const scorePayloads = buildScoreInsertPayloads({
          ...state,
          tournamentId: state.tournamentId,
          format: state.format,
        });
        for (const payload of scorePayloads) {
          const result = await saveTournamentScore(payload);
          if (result.error || !result.data) {
            throw new Error(result.error ?? 'Failed to save player scores');
          }
        }
      }

      set({
        isDirty: false,
        lastSyncedAt: new Date().toISOString(),
      });
      await get().persistSession();
      return { success: true };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unexpected error saving scores';
      console.log('[Tournament] Sync failed:', message);
      return { success: false, error: message };
    } finally {
      set({ isSyncing: false });
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
      grossByHole: Object.entries(state.grossScores[player.id] ?? {}).map(
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

  clearMatchRoundScores: async () => {
    const state = get();
    if (!state.matchGroupId || !state.tournamentId) {
      return { success: false, error: 'No match pairing loaded' };
    }

    const result = await clearTournamentMatchScoresViaBackend({
      tournamentId: state.tournamentId,
      matchGroupId: state.matchGroupId,
      roundNumber: state.roundNumber,
    });
    if (!result.success) return result;

    set({
      grossScores: buildEmptyPlayerGrossMaps(state.players),
      teamGrossScores: {},
      holeOutcomes: {},
      pairingOutcomes: {},
      activePairingIndex: 0,
      currentHole: 1,
      isDirty: false,
      lastSyncedAt: null,
    });
    await get().persistSession();
    return { success: true };
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
      matchRosterPlayers: state.matchRosterPlayers,
      grossScores: state.grossScores,
      teamGrossScores: state.teamGrossScores,
      holeOutcomes: state.holeOutcomes,
      pairingOutcomes: state.pairingOutcomes,
      activePairingIndex: state.activePairingIndex,
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
        matchRosterPlayers: data.matchRosterPlayers ?? data.players,
        grossScores: sanitizeGrossScoresState(data.grossScores),
        teamGrossScores: sanitizeTeamGrossScores(data.teamGrossScores),
        holeOutcomes: data.holeOutcomes ?? {},
        pairingOutcomes: data.pairingOutcomes ?? {},
        activePairingIndex: data.activePairingIndex ?? 0,
        isDirty: true,
      });
      return true;
    } catch {
      return false;
    }
  },

  reset: () => set({ ...initialState, teamGrossScores: {} }),
  clearPersistedSession: async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    set({ ...initialState, teamGrossScores: {} });
  },
}));

export const useTournamentPlayers = () => useTournamentStore((s) => s.players);
export const useTournamentCurrentHole = () => useTournamentStore((s) => s.currentHole);
export const useTournamentTotals = () => useTournamentStore((s) => s.getTotals());
export const useTournamentIsDirty = () => useTournamentStore((s) => s.isDirty);
export const useTournamentWageringResults = () => useTournamentStore((s) => s.wageringResults);
export const useTournamentLeaderboardMode = () => useTournamentStore((s) => s.leaderboardMode);
