import { useEffect, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useMemberAuthStore } from '@/lib/member-auth-store';
import { getMembersForChallenge } from '@/lib/social-service';
import {
  getTeamsForPlayer,
  getTournamentById,
  getTournamentTeams,
} from '@/lib/tournament-service';
import { getTournamentMatchGroups } from '@/lib/tournament-match-service';
import {
  buildTournamentPlayerMaps,
  getTournamentPlayers,
  resolveRosterEntries,
} from '@/lib/tournament-player-service';
import { getMatchGroupFormat, getRoundFormat, isTeamScorecardFormat } from '@/lib/tournament-labels';
import { buildSinglesHoleScores } from '@/lib/tournament-scoring';
import { flattenRoundFormats } from '@/lib/tournament-schedule';
import { FOX_CREEK_DATA } from '@/lib/course-data';
import {
  useTournamentStore,
  useTournamentIsDirty,
} from '@/lib/tournament-store';
import type { TournamentTeamSide } from '@/types';

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
    enabled: Boolean(id && matchGroupId),
  });

  const activeMatchGroup = matchGroups.find((g) => g.id === matchGroupId) ?? null;
  const matchRoundNumber = activeMatchGroup?.round_number ?? initialRound;

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

  const buildPlayersForRound = useCallback(
    (
      roundFormat: ReturnType<typeof getRoundFormat>,
      roundNum: number,
      group: typeof activeMatchGroup = null
    ) => {
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

        const playerIds =
          side === 'side_b'
            ? group.side_b_player_ids
            : side === 'side_a'
              ? group.side_a_player_ids
              : roundFormat === 'singles' || roundFormat === 'match_play'
                ? interleaveSinglesPlayers()
                : teamGroupedPlayers();

        if (roundFormat !== 'singles' && roundFormat !== 'match_play' && !side) return null;

        const teamId =
          side === 'side_b'
            ? group.side_b_team_id
            : side === 'side_a'
              ? group.side_a_team_id
              : null;

        const teamName =
          allTeams.find((t) => t.id === teamId)?.team_name ??
          (side === 'side_a' ? 'Team A' : side === 'side_b' ? 'Team B' : null);

        return {
          teamId: roundFormat === 'singles' ? null : teamId,
          teamName,
          userId: null as string | null,
          matchGroupId: group.id,
          roundNumber: roundNum,
          players: playerIds.map((pid) => ({
            id: pid,
            name: playerNameById[pid] ?? 'Player',
            handicapIndex: playerHandicapById[pid] ?? 0,
            tournamentPlayerId: tournamentPlayers.some((p) => p.id === pid) ? pid : null,
          })),
        };
      }

      if (roundFormat === 'singles' && user?.id) {
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
              handicapIndex: profile?.handicap_index ?? 0,
            },
          ],
        };
      }

      if (!selectedTeam) return null;

      return {
        teamId: selectedTeam.id,
        teamName: selectedTeam.team_name,
        userId: null as string | null,
        matchGroupId: null as string | null,
        roundNumber: roundNum,
        players: resolveRosterEntries(selectedTeam.player_ids, tournamentPlayers, members).map(
          (entry) => ({
            id: entry.id,
            name: entry.display_name,
            handicapIndex: entry.handicap_index,
            tournamentPlayerId: entry.id,
          })
        ),
      };
    },
    [
      side,
      allTeams,
      user?.id,
      profile?.full_name,
      profile?.handicap_index,
      selectedTeam,
      tournamentPlayers,
      members,
      playerNameById,
      playerHandicapById,
    ]
  );

  useEffect(() => {
    if (!id || !tournament) return;
    if (matchGroupId && !activeMatchGroup) return;

    const bootstrap = async () => {
      const restored = await restoreSession(id);
      if (restored) {
        await loadExistingScores();
        return;
      }

      const roundNum = matchRoundNumber;
      const matchFormat = activeMatchGroup
        ? getMatchGroupFormat(activeMatchGroup, tournament)
        : getRoundFormat(tournament, roundNum);
      const context = buildPlayersForRound(matchFormat, roundNum, activeMatchGroup);
      if (!context) return;

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
  }, [id, tournament?.id, selectedTeam?.id, user?.id, activeMatchGroup?.id, matchGroupId]);

  const handleRoundChange = async (nextRound: number) => {
    if (!tournament) return;
    const matchGroupForRound =
      activeMatchGroup?.round_number === nextRound ? activeMatchGroup : null;
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

  const matchTeeTimeLabel = useMemo(() => {
    if (!activeMatchGroup?.tee_time) return null;
    return new Date(activeMatchGroup.tee_time).toLocaleTimeString('en-CA', {
      hour: 'numeric',
      minute: '2-digit',
    });
  }, [activeMatchGroup?.tee_time]);

  const paperScores = useMemo(() => {
    const map: Record<string, Record<number, number | null>> = {};
    for (const player of players) {
      map[player.id] = { ...(grossScores[player.id] ?? {}) };
    }
    return map;
  }, [players, grossScores]);

  const paperNetScores = useMemo(() => {
    if (!format) return {};
    const nets: Record<string, Record<number, number>> = {};

    if (format === 'best_ball') {
      for (const player of players) {
        const details = playerDetails[player.id];
        if (details) {
          nets[player.id] = {};
          for (const d of details) {
            nets[player.id][d.hole] = d.net;
          }
        }
      }
    } else if (format === 'singles') {
      for (const player of players) {
        const holes = Object.entries(grossScores[player.id] ?? {}).map(([hole, gross]) => ({
          hole: Number(hole),
          gross,
        }));
        const holeScores = buildSinglesHoleScores(holes, player.handicapIndex, teePlayed);
        nets[player.id] = {};
        for (const h of holeScores) {
          nets[player.id][h.hole] = h.net;
        }
      }
    }

    return nets;
  }, [format, players, grossScores, playerDetails, teePlayed]);

  const bestBallByHole = useMemo(() => {
    if (format !== 'best_ball') return undefined;
    const map: Record<number, string> = {};
    for (const player of players) {
      const details = playerDetails[player.id];
      if (details) {
        for (const d of details) {
          if (d.isBestBall) {
            map[d.hole] = player.id;
          }
        }
      }
    }
    return map;
  }, [format, players, playerDetails]);

  const paperPlayers = useMemo(
    () =>
      players.map((p) => ({
        id: p.id,
        name: p.name,
        playingHandicap: p.playingHandicap,
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

  const handleSync = async () => {
    const result = await syncScoresToSupabase();
    if (result.success) {
      await queryClient.invalidateQueries({ queryKey: ['tournamentScores', id] });
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
    paperNetScores,
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
  };
}
