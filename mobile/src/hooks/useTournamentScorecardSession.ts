import { useEffect, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { formatClubTime } from '@/lib/club-timezone';
import { useMemberAuthStore } from '@/lib/member-auth-store';
import { getMembersForChallenge } from '@/lib/social-service';
import {
  getTeamsForPlayer,
  getTournamentById,
  getTournamentTeams,
  getScoresForMatchGroup,
} from '@/lib/tournament-service';
import { getTournamentMatchGroups } from '@/lib/tournament-match-service';
import {
  buildLiveMatchScores,
  computeMatchHoleResults,
  mergeMatchScoresForStatus,
} from '@/lib/tournament-match-scoring';
import {
  computeLiveMatchStatus,
  recentHoleOutcomeRows,
} from '@/lib/tournament-match-status';
import {
  buildTournamentPlayerMaps,
  getTournamentPlayers,
  getTournamentRosterPlayerIdsForUser,
  resolveRosterEntries,
  resolveTournamentPlayerHandicap,
} from '@/lib/tournament-player-service';
import { findMatchGroupForRosterPlayer } from '@/lib/tournament-scorecard-routing';
import { getMatchGroupFormat, getRoundFormat, isSideScopedTeamFormat, isTeamScorecardFormat } from '@/lib/tournament-labels';
import type { HandicapAllowancePct } from '@/lib/tournament-scoring';
import { flattenRoundFormats } from '@/lib/tournament-schedule';
import { FOX_CREEK_DATA } from '@/lib/course-data';
import {
  useTournamentStore,
  useTournamentIsDirty,
} from '@/lib/tournament-store';
import type { TournamentTeamSide } from '@/types';
import type { MatchPanelPlayer } from '@/components/TournamentMatchHolePanel';

export interface TournamentScorecardParams {
  id: string;
  matchGroupId?: string;
  round?: string;
  side?: TournamentTeamSide;
}

function initialsFromName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2) || 'PL';
}

export function useTournamentScorecardSession(params: TournamentScorecardParams | null) {
  const id = params?.id;
  const matchGroupId = params?.matchGroupId;
  const side = params?.side;
  const initialRound = params?.round ? Number(params.round) : 1;

  const queryClient = useQueryClient();
  const user = useMemberAuthStore((s) => s.user);
  const profile = useMemberAuthStore((s) => s.profile);

  const initSession = useTournamentStore((s) => s.initSession);
  const switchRound = useTournamentStore((s) => s.switchRound);
  const setRoundNumber = useTournamentStore((s) => s.setRoundNumber);
  const setCurrentHole = useTournamentStore((s) => s.setCurrentHole);
  const setPlayerGross = useTournamentStore((s) => s.setPlayerGross);
  const setTeamGross = useTournamentStore((s) => s.setTeamGross);
  const loadExistingScores = useTournamentStore((s) => s.loadExistingScores);
  const restoreSession = useTournamentStore((s) => s.restoreSession);
  const syncScoresToSupabase = useTournamentStore((s) => s.syncScoresToSupabase);
  const persistSession = useTournamentStore((s) => s.persistSession);
  const getPlayerHoleDetails = useTournamentStore((s) => s.getPlayerHoleDetails);

  const format = useTournamentStore((s) => s.format);
  const roundNumber = useTournamentStore((s) => s.roundNumber);
  const currentHole = useTournamentStore((s) => s.currentHole);
  const players = useTournamentStore((s) => s.players);
  const grossScores = useTournamentStore((s) => s.grossScores);
  const teamGrossScores = useTournamentStore((s) => s.teamGrossScores);
  const isSyncing = useTournamentStore((s) => s.isSyncing);
  const isDirty = useTournamentIsDirty();
  const teePlayed = useTournamentStore((s) => s.teePlayed);
  const teamName = useTournamentStore((s) => s.teamName);

  const { data: tournament, isLoading: tournamentLoading } = useQuery({
    queryKey: ['tournament', id],
    queryFn: () => getTournamentById(id!),
    enabled: Boolean(id),
  });

  const { data: myTeams = [] } = useQuery({
    queryKey: ['myTeams', id, user?.id],
    queryFn: () => getTeamsForPlayer(id!, user!.id),
    enabled: Boolean(id && user?.id),
  });

  const { data: allTeams = [] } = useQuery({
    queryKey: ['tournamentTeams', id],
    queryFn: () => getTournamentTeams(id!),
    enabled: Boolean(id),
  });

  const { data: matchGroups = [] } = useQuery({
    queryKey: ['tournamentMatchGroups', id],
    queryFn: () => getTournamentMatchGroups(id!),
    enabled: Boolean(id),
  });

  const { data: myRosterPlayerIds = [] } = useQuery({
    queryKey: ['myRosterPlayerIds', id, user?.id],
    queryFn: () => getTournamentRosterPlayerIdsForUser(id!, user!.id),
    enabled: Boolean(id && user?.id),
  });

  const matchRoundNumber = initialRound;

  const resolvedMatch = useMemo(() => {
    if (matchGroupId) {
      const group = matchGroups.find((g) => g.id === matchGroupId) ?? null;
      if (!group) return null;
      const inferredSide =
        side ??
        (myRosterPlayerIds.some((pid) => group.side_a_player_ids.includes(pid))
          ? 'side_a'
          : myRosterPlayerIds.some((pid) => group.side_b_player_ids.includes(pid))
            ? 'side_b'
            : undefined);
      return { group, side: inferredSide as TournamentTeamSide | undefined };
    }

    return findMatchGroupForRosterPlayer(matchGroups, myRosterPlayerIds, matchRoundNumber);
  }, [matchGroupId, matchGroups, myRosterPlayerIds, matchRoundNumber, side]);

  const activeMatchGroup = resolvedMatch?.group ?? null;
  const effectiveSide = side ?? resolvedMatch?.side;

  const { data: members = [] } = useQuery({
    queryKey: ['membersForTeam'],
    queryFn: getMembersForChallenge,
  });

  const { data: tournamentPlayers = [] } = useQuery({
    queryKey: ['tournamentPlayers', id],
    queryFn: () => getTournamentPlayers(id!),
    enabled: Boolean(id),
  });

  const { nameById: playerNameById, handicapById: playerHandicapById } = useMemo(
    () => buildTournamentPlayerMaps(tournamentPlayers, members),
    [tournamentPlayers, members]
  );

  const selectedTeam = myTeams[0] ?? allTeams[0] ?? null;

  const tournamentHandicapDefaults = useMemo(
    () => ({
      handicap_use_index: tournament?.handicap_use_index ?? true,
      handicap_allowance_pct: (tournament?.handicap_allowance_pct ?? 100) as HandicapAllowancePct,
    }),
    [tournament?.handicap_use_index, tournament?.handicap_allowance_pct]
  );

  const resolvePlayerHandicapForRound = useCallback(
    (playerId: string, roundFormat: ReturnType<typeof getRoundFormat>) =>
      resolveTournamentPlayerHandicap({
        playerId,
        tournamentPlayers,
        members,
        tournamentDefaults: tournamentHandicapDefaults,
        format: roundFormat ?? 'scramble',
        teePlayed,
      }),
    [tournamentPlayers, members, tournamentHandicapDefaults, teePlayed]
  );

  const buildPlayersForRound = useCallback(
    (
      roundFormat: ReturnType<typeof getRoundFormat>,
      roundNum: number,
      group: typeof activeMatchGroup = null,
      sideOverride?: TournamentTeamSide
    ) => {
      const activeSide = sideOverride ?? effectiveSide;

      if (group && group.round_number === roundNum) {
        const interleaveSinglesPlayers = () => {
          const ids: string[] = [];
          const maxLen = Math.max(
            group.side_a_player_ids.length,
            group.side_b_player_ids.length
          );
          for (let i = 0; i < maxLen; i++) {
            const aId = group.side_a_player_ids[i];
            const bId = group.side_b_player_ids[i];
            if (aId) ids.push(aId);
            if (bId) ids.push(bId);
          }
          return ids;
        };

        const teamGroupedPlayers = () => [
          ...group.side_a_player_ids,
          ...group.side_b_player_ids,
        ];

        const sideScopedPlayers =
          activeSide &&
          isSideScopedTeamFormat(roundFormat);

        const playerIds = sideScopedPlayers
          ? activeSide === 'side_b'
            ? group.side_b_player_ids
            : group.side_a_player_ids
          : roundFormat === 'singles' || roundFormat === 'match_play'
            ? interleaveSinglesPlayers()
            : teamGroupedPlayers();

        const viewerTeamId =
          effectiveSide === 'side_b'
            ? group.side_b_team_id
            : effectiveSide === 'side_a'
              ? group.side_a_team_id
              : myTeams[0]?.id ?? null;

        const teamId = sideScopedPlayers
          ? activeSide === 'side_b'
            ? group.side_b_team_id
            : group.side_a_team_id
          : roundFormat === 'singles'
            ? null
            : viewerTeamId;

        const teamName =
          allTeams.find((t) => t.id === teamId)?.team_name ??
          (effectiveSide === 'side_a' ? 'Team A' : effectiveSide === 'side_b' ? 'Team B' : null);

        return {
          teamId,
          teamName,
          userId: user?.id ?? null,
          matchGroupId: group.id,
          roundNumber: roundNum,
          players: playerIds.map((pid) => {
            const resolved = resolvePlayerHandicapForRound(pid, roundFormat);
            return {
              id: pid,
              name: playerNameById[pid] ?? 'Player',
              handicapIndex: resolved.handicapIndex,
              playingHandicap: resolved.playingHandicap,
              tournamentPlayerId: tournamentPlayers.some((p) => p.id === pid) ? pid : null,
              teamId: group.side_a_player_ids.includes(pid)
                ? group.side_a_team_id
                : group.side_b_team_id,
            };
          }),
        };
      }

      if (roundFormat === 'singles' && user?.id) {
        const resolved = resolvePlayerHandicapForRound(user.id, roundFormat);
        return {
          teamId: null as string | null,
          teamName: null as string | null,
          userId: user.id,
          matchGroupId: null as string | null,
          roundNumber: roundNum,
          players: [
            {
              id: user.id,
              name: profile?.full_name ?? 'Player',
              handicapIndex: resolved.handicapIndex,
              playingHandicap: resolved.playingHandicap,
            },
          ],
        };
      }

      if (!selectedTeam) return null;

      return {
        teamId: selectedTeam.id,
        teamName: selectedTeam.team_name,
        userId: user?.id ?? null,
        matchGroupId: null as string | null,
        roundNumber: roundNum,
        players: resolveRosterEntries(selectedTeam.player_ids, tournamentPlayers, members).map(
          (entry) => {
            const resolved = resolvePlayerHandicapForRound(entry.id, roundFormat);
            return {
              id: entry.id,
              name: entry.display_name,
              handicapIndex: resolved.handicapIndex,
              playingHandicap: resolved.playingHandicap,
              tournamentPlayerId: entry.id,
            };
          }
        ),
      };
    },
    [
      effectiveSide,
      myTeams,
      allTeams,
      user?.id,
      profile?.full_name,
      profile?.handicap_index,
      selectedTeam,
      tournamentPlayers,
      members,
      playerNameById,
      playerHandicapById,
      resolvePlayerHandicapForRound,
    ]
  );

  const findMatchGroupForRound = useCallback(
    (roundNum: number) => {
      if (activeMatchGroup?.round_number === roundNum) return activeMatchGroup;
      if (myRosterPlayerIds.length === 0) {
        return matchGroups.find((group) => group.round_number === roundNum) ?? null;
      }
      return findMatchGroupForRosterPlayer(matchGroups, myRosterPlayerIds, roundNum)?.group ?? null;
    },
    [activeMatchGroup, matchGroups, myRosterPlayerIds]
  );

  const sessionsMatch = useCallback(
    (
      expected: NonNullable<ReturnType<typeof buildPlayersForRound>>,
      actual: {
        roundNumber: number;
        matchGroupId: string | null;
        userId: string | null;
        format: string | null;
        players: Array<{ id: string }>;
      }
    ) => {
      if (actual.roundNumber !== expected.roundNumber) return false;
      if ((actual.matchGroupId ?? null) !== (expected.matchGroupId ?? null)) return false;
      if (user?.id && actual.userId && actual.userId !== user.id) return false;

      const expectedIds = expected.players.map((p) => p.id).sort().join(',');
      const actualIds = actual.players.map((p) => p.id).sort().join(',');
      if (expectedIds !== actualIds) return false;

      return true;
    },
    [user?.id]
  );

  useEffect(() => {
    if (!id || !tournament) return;
    if (matchGroupId && matchGroups.length > 0 && !activeMatchGroup) return;

    const bootstrap = async () => {
      const roundNum = activeMatchGroup?.round_number ?? matchRoundNumber;
      const matchFormat = activeMatchGroup
        ? getMatchGroupFormat(activeMatchGroup, tournament)
        : getRoundFormat(tournament, roundNum);
      const context = buildPlayersForRound(matchFormat, roundNum, activeMatchGroup);
      if (!context) return;

      const restored = await restoreSession(id);
      if (restored) {
        const current = useTournamentStore.getState();
        if (
          sessionsMatch(context, current) &&
          current.format === matchFormat
        ) {
          await loadExistingScores();
          return;
        }
      }

      initSession({
        tournamentId: id,
        roundFormats: flattenRoundFormats(tournament.round_schedule),
        roundNumber: roundNum,
        format: matchFormat,
        teamId: context.teamId,
        teamName: context.teamName,
        userId: context.userId,
        matchGroupId: context.matchGroupId,
        players: context.players,
      });

      await loadExistingScores();
    };

    bootstrap();
  }, [
    id,
    tournament?.id,
    selectedTeam?.id,
    user?.id,
    activeMatchGroup?.id,
    matchGroupId,
    matchGroups.length,
    myRosterPlayerIds.join(','),
    effectiveSide,
  ]);

  const handleRoundChange = async (nextRound: number) => {
    if (!tournament) return;
    const matchGroupForRound = findMatchGroupForRound(nextRound);
    const matchFormat = matchGroupForRound
      ? getMatchGroupFormat(matchGroupForRound, tournament)
      : getRoundFormat(tournament, nextRound);
    const context = buildPlayersForRound(matchFormat, nextRound, matchGroupForRound);
    if (!context) {
      setRoundNumber(nextRound);
      await loadExistingScores();
      return;
    }

    switchRound({
      roundNumber: nextRound,
      format: matchFormat,
      teamId: context.teamId,
      teamName: context.teamName,
      userId: context.userId,
      matchGroupId: context.matchGroupId,
      players: context.players,
    });
    await loadExistingScores();
  };

  const playerDetails = useMemo(() => {
    const map: Record<string, ReturnType<typeof getPlayerHoleDetails>> = {};
    for (const player of players) {
      map[player.id] = getPlayerHoleDetails(player.id);
    }
    return map;
  }, [players, grossScores, format, getPlayerHoleDetails]);

  const isTeamFormat = format ? isTeamScorecardFormat(format) : false;

  const sideAName = useMemo(() => {
    if (!activeMatchGroup) return 'Side A';
    return allTeams.find((t) => t.id === activeMatchGroup.side_a_team_id)?.team_name ?? 'Side A';
  }, [activeMatchGroup, allTeams]);

  const sideBName = useMemo(() => {
    if (!activeMatchGroup) return 'Side B';
    return allTeams.find((t) => t.id === activeMatchGroup.side_b_team_id)?.team_name ?? 'Side B';
  }, [activeMatchGroup, allTeams]);

  const viewerSide: TournamentTeamSide = useMemo(() => {
    if (effectiveSide) return effectiveSide;
    if (!activeMatchGroup || myRosterPlayerIds.length === 0) return 'side_a';
    if (myRosterPlayerIds.some((id) => activeMatchGroup.side_b_player_ids.includes(id))) {
      return 'side_b';
    }
    return 'side_a';
  }, [effectiveSide, activeMatchGroup, myRosterPlayerIds]);

  const { data: savedMatchScores = [] } = useQuery({
    queryKey: ['matchGroupScores', activeMatchGroup?.id, roundNumber],
    queryFn: () => getScoresForMatchGroup(activeMatchGroup!.id, roundNumber),
    enabled: Boolean(activeMatchGroup?.id),
  });

  const allMatchPlayerIds = useMemo(() => {
    if (!activeMatchGroup) return [];
    return [
      ...activeMatchGroup.side_a_player_ids,
      ...activeMatchGroup.side_b_player_ids,
    ];
  }, [activeMatchGroup]);

  const playersForMatchStatus = useMemo(() => {
    if (allMatchPlayerIds.length === 0) return players;

    return allMatchPlayerIds.map((pid) => {
      const sessionPlayer = players.find((p) => p.id === pid);
      if (sessionPlayer) return sessionPlayer;

      const resolved = resolvePlayerHandicapForRound(pid, format ?? 'best_ball');
      return {
        id: pid,
        name: playerNameById[pid] ?? 'Player',
        handicapIndex: resolved.handicapIndex,
        playingHandicap: resolved.playingHandicap,
        tournamentPlayerId: tournamentPlayers.some((p) => p.id === pid) ? pid : null,
        teamId: activeMatchGroup?.side_a_player_ids.includes(pid)
          ? activeMatchGroup.side_a_team_id
          : activeMatchGroup?.side_b_team_id ?? null,
      };
    });
  }, [
    allMatchPlayerIds,
    players,
    resolvePlayerHandicapForRound,
    format,
    playerNameById,
    tournamentPlayers,
    activeMatchGroup,
  ]);

  const grossScoresForMatchStatus = useMemo(() => {
    const merged: Record<string, Record<number, number>> = {};

    for (const pid of allMatchPlayerIds) {
      merged[pid] = {};
    }

    for (const saved of savedMatchScores) {
      const playerId = saved.tournament_player_id ?? saved.user_id;
      if (!playerId) continue;

      for (const holeRow of saved.hole_scores ?? []) {
        if (holeRow.entered === false) continue;
        if (holeRow.entered !== true && (saved.hole_scores?.length ?? 0) === 18) {
          continue;
        }
        merged[playerId][holeRow.hole] = holeRow.gross;
      }
    }

    for (const pid of allMatchPlayerIds) {
      const local = grossScores[pid];
      if (local) {
        Object.assign(merged[pid], local);
      }
    }

    return merged;
  }, [allMatchPlayerIds, savedMatchScores, grossScores]);

  const liveHoleResults = useMemo(() => {
    if (!activeMatchGroup || !format) return [];

    const liveScores = buildLiveMatchScores({
      matchGroup: activeMatchGroup,
      format,
      players: playersForMatchStatus,
      grossScores: grossScoresForMatchStatus,
      teamGrossScores,
      teePlayed,
    });

    const mergedScores = mergeMatchScoresForStatus(savedMatchScores, liveScores);

    return computeMatchHoleResults(
      activeMatchGroup,
      roundNumber,
      format,
      mergedScores,
      { useNetScoring: tournament?.match_use_net_scoring ?? false }
    );
  }, [
    activeMatchGroup,
    format,
    playersForMatchStatus,
    grossScoresForMatchStatus,
    teamGrossScores,
    teePlayed,
    roundNumber,
    savedMatchScores,
    tournament?.match_use_net_scoring,
  ]);

  const matchStatus = useMemo(
    () =>
      computeLiveMatchStatus({
        holeResults: liveHoleResults,
        perspectiveSide: viewerSide,
        sideAName,
        sideBName,
      }),
    [liveHoleResults, viewerSide, sideAName, sideBName]
  );

  const currentHoleMatchResult = useMemo(
    () => liveHoleResults.find((row) => row.hole === currentHole),
    [liveHoleResults, currentHole]
  );

  const matchRecentHoleRows = useMemo(
    () => recentHoleOutcomeRows(liveHoleResults, viewerSide, 6),
    [liveHoleResults, viewerSide]
  );

  const matchScoringModeLabel = useMemo(() => {
    return tournament?.match_use_net_scoring
      ? 'Match holes: net (handicap)'
      : 'Match holes: gross best-ball';
  }, [tournament?.match_use_net_scoring]);

  const currentHoleOutcomeLabel = useMemo(() => {
    if (!currentHoleMatchResult || !activeMatchGroup) return undefined;

    const { hole_winner: winner } = currentHoleMatchResult;

    if (winner === 'tie') {
      return 'Halved';
    }

    const winnerName = winner === 'side_a' ? sideAName : sideBName;
    return `${winnerName} Win`;
  }, [currentHoleMatchResult, activeMatchGroup, sideAName, sideBName]);


  const matchTeeTimeLabel = useMemo(() => {
    if (!activeMatchGroup?.tee_time) return null;
    return formatClubTime(activeMatchGroup.tee_time, true);
  }, [activeMatchGroup?.tee_time]);

  const paperScores = useMemo(() => {
    const map: Record<string, Record<number, number | null>> = {};
    for (const player of players) {
      map[player.id] = { ...(grossScores[player.id] ?? {}) };
    }
    return map;
  }, [players, grossScores]);

  const bestBallByHole = useMemo(() => {
    if (format !== 'best_ball' || !activeMatchGroup) return undefined;

    const useNetScoring = tournament?.match_use_net_scoring ?? false;

    const highlightForSide = (playerIds: string[]) => {
      const map: Record<number, string[]> = {};
      for (let hole = 1; hole <= 18; hole++) {
        let bestId: string | null = null;
        let bestValue = Infinity;
        for (const playerId of playerIds) {
          if (useNetScoring) {
            const details = playerDetails[playerId];
            const row = details?.find((d) => d.hole === hole);
            if (row && row.net < bestValue) {
              bestValue = row.net;
              bestId = playerId;
            }
          } else {
            const gross = grossScoresForMatchStatus[playerId]?.[hole];
            if (gross != null && gross < bestValue) {
              bestValue = gross;
              bestId = playerId;
            }
          }
        }
        if (bestId) {
          map[hole] = [bestId];
        }
      }
      return map;
    };

    const sideA = highlightForSide(activeMatchGroup.side_a_player_ids);
    const sideB = highlightForSide(activeMatchGroup.side_b_player_ids);
    const merged: Record<number, string[]> = {};

    for (const hole of Object.keys({ ...sideA, ...sideB }).map(Number)) {
      merged[hole] = [...(sideA[hole] ?? []), ...(sideB[hole] ?? [])];
    }

    return merged;
  }, [format, activeMatchGroup, playerDetails, grossScoresForMatchStatus, tournament?.match_use_net_scoring]);

  const paperPlayers = useMemo(
    () =>
      players.map((p) => ({
        id: p.id,
        name: p.name,
      })),
    [players]
  );

  const assistPlayers = useMemo(
    () =>
      players.map((p, index) => ({
        id: index,
        name: p.name,
        initials: initialsFromName(p.name),
      })),
    [players]
  );

  const currentHolePar =
    FOX_CREEK_DATA.holeData.find((h) => h.holeNumber === currentHole)?.par ?? 4;

  const currentHoleScores = useMemo(
    () =>
      players.map((p) => {
        const gross = grossScores[p.id]?.[currentHole];
        return gross ?? null;
      }),
    [players, grossScores, currentHole]
  );

  const getTournamentRelativeToPar = useCallback(
    (playerIndex: number) => {
      const player = players[playerIndex];
      if (!player) return 0;
      const holeMap = grossScores[player.id] ?? {};
      let totalScore = 0;
      let totalPar = 0;
      FOX_CREEK_DATA.holeData.forEach((hole) => {
        const score = holeMap[hole.holeNumber];
        if (score != null) {
          totalScore += score;
          totalPar += hole.par;
        }
      });
      return totalScore - totalPar;
    },
    [players, grossScores]
  );

  const handleTournamentScoreAdjust = useCallback(
    (playerIndex: number, delta: number) => {
      const player = players[playerIndex];
      if (!player) return;
      const current = grossScores[player.id]?.[currentHole] ?? currentHolePar;
      const next = Math.max(1, Math.min(15, current + delta));
      setPlayerGross(player.id, currentHole, next);
    },
    [players, grossScores, currentHole, currentHolePar, setPlayerGross]
  );

  const teamId = useTournamentStore((s) => s.teamId);

  const bestBallHighlightIds = useMemo(() => {
    const holeHighlights = bestBallByHole?.[currentHole];
    return new Set(
      Array.isArray(holeHighlights)
        ? holeHighlights
        : holeHighlights
          ? [holeHighlights]
          : []
    );
  }, [bestBallByHole, currentHole]);

  const buildSidePlayers = useCallback(
    (side: 'a' | 'b'): MatchPanelPlayer[] => {
      if (!activeMatchGroup) return [];
      const ids =
        side === 'a' ? activeMatchGroup.side_a_player_ids : activeMatchGroup.side_b_player_ids;
      return ids.map((pid) => {
        const storePlayer = players.find((p) => p.id === pid);
        return {
          id: pid,
          name: playerNameById[pid] ?? storePlayer?.name ?? 'Player',
          gross: grossScoresForMatchStatus[pid]?.[currentHole] ?? null,
          isCounting: bestBallHighlightIds.has(pid),
        };
      });
    },
    [
      activeMatchGroup,
      players,
      playerNameById,
      grossScoresForMatchStatus,
      currentHole,
      bestBallHighlightIds,
    ]
  );

  const sideAPlayers = useMemo(() => buildSidePlayers('a'), [buildSidePlayers]);
  const sideBPlayers = useMemo(() => buildSidePlayers('b'), [buildSidePlayers]);

  const handleMatchPlayerAdjust = useCallback(
    (side: 'a' | 'b', playerIndex: number, delta: number) => {
      if (!activeMatchGroup) return;
      const ids =
        side === 'a' ? activeMatchGroup.side_a_player_ids : activeMatchGroup.side_b_player_ids;
      const playerId = ids[playerIndex];
      if (!playerId) return;
      const globalIndex = players.findIndex((p) => p.id === playerId);
      if (globalIndex >= 0) {
        handleTournamentScoreAdjust(globalIndex, delta);
        return;
      }
      const current = grossScores[playerId]?.[currentHole] ?? currentHolePar;
      setPlayerGross(playerId, currentHole, Math.max(1, Math.min(15, current + delta)));
    },
    [
      activeMatchGroup,
      players,
      handleTournamentScoreAdjust,
      grossScores,
      currentHole,
      currentHolePar,
      setPlayerGross,
    ]
  );

  const handleMatchTeamAdjust = useCallback(
    (side: 'a' | 'b', delta: number) => {
      if (!isTeamFormat) return;
      const targetTeamId =
        side === 'a' ? activeMatchGroup?.side_a_team_id : activeMatchGroup?.side_b_team_id;
      if (targetTeamId && targetTeamId === teamId) {
        const current = teamGrossScores[currentHole] ?? currentHolePar;
        setTeamGross(currentHole, Math.max(1, Math.min(15, current + delta)));
      }
    },
    [isTeamFormat, activeMatchGroup, teamId, teamGrossScores, currentHole, currentHolePar, setTeamGross]
  );

  const sideATeamGross = useMemo(() => {
    if (!activeMatchGroup || !isTeamFormat || teamId !== activeMatchGroup.side_a_team_id) {
      return null;
    }
    return teamGrossScores[currentHole] ?? currentHolePar;
  }, [activeMatchGroup, isTeamFormat, teamId, teamGrossScores, currentHole, currentHolePar]);

  const sideBTeamGross = useMemo(() => {
    if (!activeMatchGroup || !isTeamFormat || teamId !== activeMatchGroup.side_b_team_id) {
      return null;
    }
    return teamGrossScores[currentHole] ?? currentHolePar;
  }, [activeMatchGroup, isTeamFormat, teamId, teamGrossScores, currentHole, currentHolePar]);

  const handleSync = async () => {
    const result = await syncScoresToSupabase({
      matchUseNetScoring: tournament?.match_use_net_scoring ?? false,
    });
    if (result.success) {
      await queryClient.invalidateQueries({ queryKey: ['tournamentScores', id] });
      await queryClient.invalidateQueries({ queryKey: ['matchGroupScores', activeMatchGroup?.id] });
      await queryClient.invalidateQueries({ queryKey: ['matchHoleResults'] });
      await queryClient.invalidateQueries({ queryKey: ['tournamentMatchGroups', id] });
    }
    return result;
  };

  const isReady = Boolean(tournament && format);
  const isLoading = Boolean(id && (tournamentLoading || !isReady));

  return {
    isLoading,
    isReady,
    tournament,
    format,
    roundNumber,
    currentHole,
    setCurrentHole,
    isTeamFormat,
    paperPlayers,
    paperScores,
    bestBallByHole,
    teamGrossScores,
    setPlayerGross,
    setTeamGross,
    assistPlayers,
    currentHolePar,
    currentHoleScores,
    getTournamentRelativeToPar,
    handleTournamentScoreAdjust,
    handleRoundChange,
    handleSync,
    persistSession,
    isSyncing,
    isDirty,
    activeMatchGroup,
    teamName,
    matchTeeTimeLabel,
    sideAName,
    sideBName,
    viewerSide,
    matchStatus,
    sideAPlayers,
    sideBPlayers,
    sideATeamGross,
    sideBTeamGross,
    currentHoleOutcomeLabel,
    currentHoleWinner: currentHoleMatchResult?.hole_winner ?? null,
    matchRecentHoleRows,
    matchScoringModeLabel,
    handleMatchPlayerAdjust,
    handleMatchTeamAdjust,
    hasMatchPlay: Boolean(activeMatchGroup),
  };
}
