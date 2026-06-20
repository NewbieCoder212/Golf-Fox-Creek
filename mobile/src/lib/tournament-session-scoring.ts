import {
  buildMatchStatusFromHoleResults,
  isAdminDeclaredMatchResult,
  resolveEffectiveGroupHoleResults,
  resolveMatchWinnerSide,
  type MatchPlayStatus,
} from '@/lib/tournament-match-play-status';
import { buildPairingMatchStatus } from '@/lib/tournament-pairing-status';
import { getMatchGroupFormat, isSinglesFormat } from '@/lib/tournament-labels';
import type { MatchPointsStanding } from '@/lib/tournament-service';
import type { MatchStatus } from '@/lib/tournament-match-status';
import type {
  Tournament,
  TournamentMatchGroup,
  TournamentMatchHoleResult,
  TournamentScore,
  TournamentTeam,
} from '@/types';

type SessionUnitPoints = {
  pointsA: number;
  pointsB: number;
  wonA: boolean;
  wonB: boolean;
  countAsMatch: boolean;
};

function sessionPointsForUnit(
  playStatus: MatchPlayStatus,
  matchStatus: Pick<MatchStatus, 'lead'>,
  winnerSide: 'side_a' | 'side_b' | 'tie' | null
): SessionUnitPoints {
  if (playStatus === 'not_started') {
    return { pointsA: 0, pointsB: 0, wonA: false, wonB: false, countAsMatch: false };
  }

  if (playStatus === 'complete') {
    if (winnerSide === 'tie') {
      return { pointsA: 0.5, pointsB: 0.5, wonA: false, wonB: false, countAsMatch: true };
    }
    if (winnerSide === 'side_a') {
      return { pointsA: 1, pointsB: 0, wonA: true, wonB: false, countAsMatch: true };
    }
    if (winnerSide === 'side_b') {
      return { pointsA: 0, pointsB: 1, wonA: false, wonB: true, countAsMatch: true };
    }
    return { pointsA: 0, pointsB: 0, wonA: false, wonB: false, countAsMatch: true };
  }

  if (matchStatus.lead === 0) {
    return { pointsA: 0.5, pointsB: 0.5, wonA: false, wonB: false, countAsMatch: true };
  }
  if (matchStatus.lead > 0) {
    return { pointsA: 1, pointsB: 0, wonA: false, wonB: false, countAsMatch: true };
  }
  return { pointsA: 0, pointsB: 1, wonA: false, wonB: false, countAsMatch: true };
}

function adminDeclaredSessionPoints(
  group: TournamentMatchGroup
): SessionUnitPoints {
  if (group.match_winner === 'tie') {
    return { pointsA: 0.5, pointsB: 0.5, wonA: false, wonB: false, countAsMatch: true };
  }
  if (group.match_winner === 'side_a') {
    return { pointsA: 1, pointsB: 0, wonA: true, wonB: false, countAsMatch: true };
  }
  if (group.match_winner === 'side_b') {
    return { pointsA: 0, pointsB: 1, wonA: false, wonB: true, countAsMatch: true };
  }
  return { pointsA: 0, pointsB: 0, wonA: false, wonB: false, countAsMatch: false };
}

function applySessionPoints(
  byTeamId: Map<string, MatchPointsStanding>,
  group: TournamentMatchGroup,
  unit: SessionUnitPoints
): void {
  const teamA = byTeamId.get(group.side_a_team_id);
  const teamB = byTeamId.get(group.side_b_team_id);

  if (teamA) {
    teamA.matchPoints += unit.pointsA;
    if (unit.wonA) teamA.matchesWon += 1;
    if (unit.countAsMatch) teamA.matchesPlayed += 1;
  }
  if (teamB) {
    teamB.matchPoints += unit.pointsB;
    if (unit.wonB) teamB.matchesWon += 1;
    if (unit.countAsMatch) teamB.matchesPlayed += 1;
  }
}

/** Live round session totals — completed wins/ties plus in-progress up/as projection. */
export function buildRoundSessionPointsLeaderboard(
  teams: { id: string; team_name: string; side: string | null }[],
  matchGroups: TournamentMatchGroup[],
  holeResults: TournamentMatchHoleResult[],
  tournament: Tournament,
  sideAName: string,
  sideBName: string,
  scores: TournamentScore[] = [],
  useNetScoring = false
): MatchPointsStanding[] {
  const byTeamId = new Map<string, MatchPointsStanding>();

  for (const team of teams) {
    if (!team.side) continue;
    byTeamId.set(team.id, {
      teamId: team.id,
      teamName: team.team_name,
      side: team.side as 'side_a' | 'side_b',
      matchPoints: 0,
      matchesWon: 0,
      matchesPlayed: 0,
    });
  }

  for (const group of matchGroups) {
    if (isAdminDeclaredMatchResult(group)) {
      applySessionPoints(byTeamId, group, adminDeclaredSessionPoints(group));
      continue;
    }

    const groupHoleResults = resolveEffectiveGroupHoleResults(
      group,
      holeResults,
      scores,
      useNetScoring
    );
    const groupFormat = getMatchGroupFormat(group, tournament);

    if (isSinglesFormat(groupFormat)) {
      const pairingCount = Math.max(
        group.side_a_player_ids.length,
        group.side_b_player_ids.length,
        1
      );

      for (let pairingIndex = 0; pairingIndex < pairingCount; pairingIndex += 1) {
        const pairing = buildPairingMatchStatus(
          groupHoleResults,
          pairingIndex,
          sideAName,
          sideBName
        );
        const unit = sessionPointsForUnit(
          pairing.playStatus,
          pairing.matchStatus,
          pairing.winnerSide
        );
        applySessionPoints(byTeamId, group, unit);
      }
      continue;
    }

    const { matchStatus, playStatus } = buildMatchStatusFromHoleResults(
      group,
      holeResults,
      sideAName,
      sideBName,
      { scores, useNetScoring }
    );
    const winnerSide = resolveMatchWinnerSide(group, matchStatus);
    const unit = sessionPointsForUnit(playStatus, matchStatus, winnerSide);
    applySessionPoints(byTeamId, group, unit);
  }

  return Array.from(byTeamId.values()).sort((a, b) => {
    if (b.matchPoints !== a.matchPoints) return b.matchPoints - a.matchPoints;
    return b.matchesWon - a.matchesWon;
  });
}
