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
  holes: GrossHoleInput[];
}

const DEFAULT_TEE: TeeName = 'White';
const DEFAULT_GENDER: 'mens' | 'womens' = 'mens';

/** Golf Canada playing handicap allowances by format. */
export const HANDICAP_ALLOWANCES: Record<TournamentFormat, number> = {
  singles: 1.0,
  best_ball: 0.85,
  scramble: 1.0,
  alternate_shot: 1.0,
};

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
  format: TournamentFormat = 'singles'
): TournamentHoleScore[] {
  const holeData = getFoxCreekHoleData();
  const playingHandicap = getPlayingHandicap(handicapIndex, format, teePlayed, gender);

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
  gender: 'mens' | 'womens' = DEFAULT_GENDER
): TournamentHoleScore[] {
  const holeData = getFoxCreekHoleData();
  const playerCards = players.map((player) =>
    buildSinglesHoleScores(player.holes, player.handicapIndex, teePlayed, gender, 'best_ball')
  );

  return holeData.map((hole, index) => {
    const nets = playerCards.map((card) => card[index]?.net ?? hole.par);
    const grosses = playerCards.map((card) => card[index]?.gross ?? hole.par);
    const bestNetIndex = nets.indexOf(Math.min(...nets));

    return {
      hole: hole.hole,
      par: hole.par,
      gross: grosses[bestNetIndex] ?? hole.par,
      net: Math.min(...nets),
    };
  });
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
      'best_ball'
    ),
  }));

  const result: Record<string, PlayerHoleDetail[]> = {};

  for (const { playerId, cards } of playerCards) {
    result[playerId] = holeData.map((hole, index) => {
      const card = cards[index];
      const playingHandicap = getPlayingHandicap(
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
}): TournamentHoleScore[] {
  const {
    format,
    grossByHole = [],
    players = [],
    teamCourseHandicap,
    handicapIndex = 0,
    teePlayed = DEFAULT_TEE,
    gender = DEFAULT_GENDER,
  } = params;

  switch (format) {
    case 'singles':
      return buildSinglesHoleScores(grossByHole, handicapIndex, teePlayed, gender, 'singles');
    case 'best_ball':
      return buildBestBallHoleScores(players, teePlayed, gender);
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
