/**
 * Tournament scoring utilities with Golf Canada / WHS handicap integration.
 * Builds per-hole gross/net scorecards for singles and team formats.
 */

import type { TeeName, TournamentFormat, TournamentHoleScore } from '@/types';
import {
  calculateCourseHandicap,
  getFoxCreekHoleData,
  getFoxCreekRatings,
} from './handicap';

export interface GrossHoleInput {
  hole: number;
  gross: number;
}

export interface PlayerGrossScores {
  playerId: string;
  handicapIndex: number;
  /** When set, used instead of deriving from handicap index + format allowance. */
  playingHandicap?: number;
  holes: GrossHoleInput[];
}

const DEFAULT_TEE: TeeName = 'White';
const DEFAULT_GENDER: 'mens' | 'womens' = 'mens';

/** Golf Canada playing handicap allowances by format (fallback when no tournament default). */
export const HANDICAP_ALLOWANCES: Record<TournamentFormat, number> = {
  singles: 1.0,
  best_ball: 0.85,
  scramble: 1.0,
  alternate_shot: 1.0,
};

export type HandicapAllowancePct = 75 | 85 | 100;

export interface TournamentHandicapDefaults {
  handicap_use_index: boolean;
  handicap_allowance_pct: HandicapAllowancePct;
}

export interface PlayerHandicapOverrides {
  handicap_use_index?: boolean | null;
  handicap_allowance_pct?: HandicapAllowancePct | null;
  handicap_index?: number | null;
  manual_handicap?: string | null;
}

/** Parse free-text manual handicap (e.g. "12", "12.5", "12/18"). */
export function parseManualHandicap(value: string | null | undefined): number {
  if (!value?.trim()) return 0;
  const match = value.trim().match(/[\d.]+/);
  if (!match) return 0;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function resolveAllowancePct(
  playerOverride: number | null | undefined,
  tournamentDefault: number | null | undefined,
  format: TournamentFormat
): HandicapAllowancePct {
  const pct = playerOverride ?? tournamentDefault;
  if (pct === 75 || pct === 85 || pct === 100) return pct;
  const fallback = Math.round((HANDICAP_ALLOWANCES[format] ?? 1) * 100);
  if (fallback === 75 || fallback === 85) return fallback as HandicapAllowancePct;
  return 100;
}

/**
 * Resolve playing handicap from tournament defaults and optional per-player overrides.
 */
export function resolvePlayerHandicap(params: {
  handicapIndex: number | null | undefined;
  manualHandicap?: string | null;
  useIndex: boolean;
  allowancePct: HandicapAllowancePct;
  teePlayed?: TeeName;
  gender?: 'mens' | 'womens';
}): number {
  const {
    handicapIndex,
    manualHandicap,
    useIndex,
    allowancePct,
    teePlayed = DEFAULT_TEE,
    gender = DEFAULT_GENDER,
  } = params;
  const multiplier = allowancePct / 100;

  if (useIndex) {
    const courseHcp = getCourseHandicapFromIndex(handicapIndex ?? 0, teePlayed, gender);
    return Math.round(courseHcp * multiplier);
  }

  return Math.round(parseManualHandicap(manualHandicap) * multiplier);
}

export function resolvePlayerHandicapFromConfig(params: {
  tournament: TournamentHandicapDefaults;
  player: PlayerHandicapOverrides;
  format: TournamentFormat;
  teePlayed?: TeeName;
  gender?: 'mens' | 'womens';
}): number {
  const useIndex =
    params.player.handicap_use_index ?? params.tournament.handicap_use_index;
  const allowancePct = resolveAllowancePct(
    params.player.handicap_allowance_pct,
    params.tournament.handicap_allowance_pct,
    params.format
  );

  return resolvePlayerHandicap({
    handicapIndex: params.player.handicap_index,
    manualHandicap: params.player.manual_handicap,
    useIndex,
    allowancePct,
    teePlayed: params.teePlayed,
    gender: params.gender,
  });
}

export interface PlayerHoleDetail {
  hole: number;
  par: number;
  gross: number;
  net: number;
  strokes: number;
  isBestBall?: boolean;
}

/**
 * Course handicap adjusted for tournament format (e.g. 85% for Best Ball).
 */
export function getPlayingHandicap(
  handicapIndex: number,
  format: TournamentFormat,
  teePlayed: TeeName = DEFAULT_TEE,
  gender: 'mens' | 'womens' = DEFAULT_GENDER
): number {
  const courseHandicap = getCourseHandicapFromIndex(handicapIndex, teePlayed, gender);
  const allowance = HANDICAP_ALLOWANCES[format] ?? 1.0;
  return Math.round(courseHandicap * allowance);
}

/**
 * Team course handicap for scramble / alternate shot (Golf Canada).
 * Scramble: 25% of combined (2 players) or 10% (3–4 players).
 * Alternate shot: 50% of combined course handicaps.
 */
export function calculateTeamCourseHandicap(
  handicapIndexes: number[],
  format: 'scramble' | 'alternate_shot',
  teePlayed: TeeName = DEFAULT_TEE,
  gender: 'mens' | 'womens' = DEFAULT_GENDER
): number {
  const courseHandicaps = handicapIndexes.map((index) =>
    getCourseHandicapFromIndex(index, teePlayed, gender)
  );
  const sum = courseHandicaps.reduce((total, value) => total + value, 0);

  if (format === 'alternate_shot') {
    return Math.round(sum * 0.5);
  }

  if (courseHandicaps.length <= 2) {
    return Math.round(sum * 0.25);
  }

  return Math.round(sum * 0.1);
}

/**
 * Strokes received on a hole from course handicap (WHS stroke allocation).
 */
export function getStrokesOnHole(courseHandicap: number, holeHandicapIndex: number): number {
  if (courseHandicap <= 0) return 0;

  const baseStrokes = Math.floor(courseHandicap / 18);
  const extraStrokes = courseHandicap % 18;
  const bonusStroke = holeHandicapIndex <= extraStrokes ? 1 : 0;

  return baseStrokes + bonusStroke;
}

/**
 * Resolve course handicap from a Golf Canada handicap index for Fox Creek.
 */
export function getCourseHandicapFromIndex(
  handicapIndex: number,
  teePlayed: TeeName = DEFAULT_TEE,
  gender: 'mens' | 'womens' = DEFAULT_GENDER
): number {
  const ratings = getFoxCreekRatings(teePlayed, gender);
  if (!ratings) return 0;

  return calculateCourseHandicap(
    handicapIndex,
    ratings.slopeRating,
    ratings.courseRating,
    72
  );
}

/**
 * Build 18-hole gross/net rows for a singles player.
 */
export function buildSinglesHoleScores(
  grossByHole: GrossHoleInput[],
  handicapIndex: number,
  teePlayed: TeeName = DEFAULT_TEE,
  gender: 'mens' | 'womens' = DEFAULT_GENDER,
  format: TournamentFormat = 'singles',
  playingHandicapOverride?: number,
  includeUnplayedHoles: boolean = true
): TournamentHoleScore[] {
  const holeData = getFoxCreekHoleData();
  const playingHandicap =
    playingHandicapOverride ??
    getPlayingHandicap(handicapIndex, format, teePlayed, gender);

  if (!includeUnplayedHoles) {
    return grossByHole
      .map((entry) => {
        const hole = holeData.find((h) => h.hole === entry.hole);
        if (!hole) return null;
        const strokes = getStrokesOnHole(playingHandicap, hole.handicapIndex);
        return {
          hole: entry.hole,
          par: hole.par,
          gross: entry.gross,
          net: entry.gross - strokes,
          entered: true,
        };
      })
      .filter((row): row is TournamentHoleScore => row !== null)
      .sort((a, b) => a.hole - b.hole);
  }

  return holeData.map((hole) => {
    const grossEntry = grossByHole.find((h) => h.hole === hole.hole);
    const gross = grossEntry?.gross ?? hole.par;
    const strokes = getStrokesOnHole(playingHandicap, hole.handicapIndex);

    return {
      hole: hole.hole,
      par: hole.par,
      gross,
      net: gross - strokes,
    };
  });
}

/**
 * Best ball: lowest net score among team members on each hole.
 */
export function buildBestBallHoleScores(
  players: PlayerGrossScores[],
  teePlayed: TeeName = DEFAULT_TEE,
  gender: 'mens' | 'womens' = DEFAULT_GENDER,
  includeUnplayedHoles: boolean = true
): TournamentHoleScore[] {
  const holeData = getFoxCreekHoleData();
  const playerCards = players.map((player) =>
    buildSinglesHoleScores(
      player.holes,
      player.handicapIndex,
      teePlayed,
      gender,
      'best_ball',
      player.playingHandicap,
      includeUnplayedHoles
    )
  );

  return holeData
    .map((hole) => {
      const rows = playerCards.map((card) => card.find((row) => row.hole === hole.holeNumber) ?? null);
      const played = rows.filter((row): row is TournamentHoleScore => row !== null);

      if (!includeUnplayedHoles && played.length === 0) {
        return null;
      }

      const nets = rows.map((row) => row?.net ?? hole.par);
      const grosses = rows.map((row) => row?.gross ?? hole.par);
      const bestNetIndex = nets.indexOf(Math.min(...nets));

      return {
        hole: hole.holeNumber,
        par: hole.par,
        gross: grosses[bestNetIndex] ?? hole.par,
        net: Math.min(...nets),
      };
    })
    .filter((row): row is TournamentHoleScore => row !== null);
}

export function buildBestBallPlayerDetails(
  players: PlayerGrossScores[],
  teePlayed: TeeName = DEFAULT_TEE,
  gender: 'mens' | 'womens' = DEFAULT_GENDER
): Record<string, PlayerHoleDetail[]> {
  const holeData = getFoxCreekHoleData();
  const playerCards = players.map((player) => ({
    playerId: player.playerId,
    cards: buildSinglesHoleScores(
      player.holes,
      player.handicapIndex,
      teePlayed,
      gender,
      'best_ball',
      player.playingHandicap
    ),
  }));

  const result: Record<string, PlayerHoleDetail[]> = {};

  for (const { playerId, cards } of playerCards) {
    result[playerId] = holeData.map((hole, index) => {
      const card = cards[index];
      const playingHandicap =
        players.find((p) => p.playerId === playerId)?.playingHandicap ??
        getPlayingHandicap(
          players.find((p) => p.playerId === playerId)?.handicapIndex ?? 0,
          'best_ball',
          teePlayed,
          gender
        );
      const strokes = getStrokesOnHole(playingHandicap, hole.handicapIndex);
      const net = card?.net ?? hole.par;
      const allNets = playerCards.map(
        ({ cards: c }) => c[index]?.net ?? hole.par
      );
      const isBestBall = net === Math.min(...allNets);

      return {
        hole: hole.hole,
        par: hole.par,
        gross: card?.gross ?? hole.par,
        net,
        strokes,
        isBestBall,
      };
    });
  }

  return result;
}

/**
 * Scramble / alternate shot: one team gross scorecard; net optional via team allowance.
 */
export function buildTeamGrossHoleScores(
  grossByHole: GrossHoleInput[],
  teamCourseHandicap?: number
): TournamentHoleScore[] {
  const holeData = getFoxCreekHoleData();
  const courseHandicap = teamCourseHandicap ?? 0;

  return holeData.map((hole) => {
    const grossEntry = grossByHole.find((h) => h.hole === hole.hole);
    const gross = grossEntry?.gross ?? hole.par;
    const strokes = getStrokesOnHole(courseHandicap, hole.handicapIndex);

    return {
      hole: hole.hole,
      par: hole.par,
      gross,
      net: gross - strokes,
    };
  });
}

/**
 * Build hole scores for any tournament format from raw gross inputs.
 */
export function buildTournamentHoleScores(params: {
  format: TournamentFormat;
  grossByHole?: GrossHoleInput[];
  players?: PlayerGrossScores[];
  teamCourseHandicap?: number;
  handicapIndex?: number;
  teePlayed?: TeeName;
  gender?: 'mens' | 'womens';
  /** When false, only holes with explicit gross entry are included (sync / match scoring). */
  includeUnplayedHoles?: boolean;
}): TournamentHoleScore[] {
  const {
    format,
    grossByHole = [],
    players = [],
    teamCourseHandicap,
    handicapIndex = 0,
    teePlayed = DEFAULT_TEE,
    gender = DEFAULT_GENDER,
    includeUnplayedHoles = true,
  } = params;

  switch (format) {
    case 'singles':
      return buildSinglesHoleScores(
        grossByHole,
        handicapIndex,
        teePlayed,
        gender,
        'singles',
        undefined,
        includeUnplayedHoles
      );
    case 'best_ball':
      return buildBestBallHoleScores(players, teePlayed, gender, includeUnplayedHoles);
    case 'scramble':
    case 'alternate_shot': {
      const teamHandicap =
        teamCourseHandicap ??
        calculateTeamCourseHandicap(
          players.map((p) => p.handicapIndex),
          format,
          teePlayed,
          gender
        );
      return buildTeamGrossHoleScores(grossByHole, teamHandicap);
    }
    default:
      return buildTeamGrossHoleScores(grossByHole, teamCourseHandicap);
  }
}

export function sumHoleScores(holeScores: TournamentHoleScore[]): {
  total_gross: number;
  total_net: number;
} {
  return {
    total_gross: holeScores.reduce((sum, h) => sum + h.gross, 0),
    total_net: holeScores.reduce((sum, h) => sum + h.net, 0),
  };
}

/** Highest hole number with a gross score for the given players. */
export function furthestEnteredHole(
  grossScores: Record<string, Record<number, number>>,
  playerIds: string[]
): number {
  let maxHole = 0;
  for (const playerId of playerIds) {
    for (const holeStr of Object.keys(grossScores[playerId] ?? {})) {
      const hole = Number(holeStr);
      if (Number.isFinite(hole)) maxHole = Math.max(maxHole, hole);
    }
  }
  return maxHole;
}

/** Next hole to play after the furthest entered score (defaults to 1). */
export function inferNextHoleFromEntry(
  grossScores: Record<string, Record<number, number>>,
  teamGrossScores: Record<number, number> = {},
  playerIds?: string[]
): number {
  let maxHole = 0;
  const ids = playerIds?.length ? playerIds : Object.keys(grossScores);
  for (const playerId of ids) {
    for (const holeStr of Object.keys(grossScores[playerId] ?? {})) {
      const hole = Number(holeStr);
      if (Number.isFinite(hole)) maxHole = Math.max(maxHole, hole);
    }
  }
  for (const holeStr of Object.keys(teamGrossScores)) {
    const hole = Number(holeStr);
    if (Number.isFinite(hole)) maxHole = Math.max(maxHole, hole);
  }
  if (maxHole === 0) return 1;
  return Math.min(18, maxHole + 1);
}
