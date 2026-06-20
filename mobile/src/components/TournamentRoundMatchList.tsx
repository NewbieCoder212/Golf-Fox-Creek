import { useMemo } from 'react';
import { View, Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import {
  ColoredMatchResultText,
  ColoredMatchStatusText,
} from '@/components/match-play/ColoredMatchStatusText';
import { useTournamentRoundMatchSummaries } from '@/hooks/useTournamentRoundMatchSummaries';
import type {
  RoundMatchLineup,
  RoundMatchSinglesPairing,
  RoundMatchSummary,
} from '@/hooks/useTournamentRoundMatchSummaries';
import { formatRoundPickerLabel } from '@/lib/tournament-labels';
import { formatTeeAssignmentTime } from '@/lib/tournament-tee-service';
import { getActiveRoundNumber } from '@/lib/tournament-scorecard-routing';
import { getTeamSideTheme } from '@/lib/match-play-theme';
import type { MatchStatus } from '@/lib/tournament-match-status';
import { buildTournamentPlayerMaps, getTournamentPlayers } from '@/lib/tournament-player-service';
import { getMembersForChallenge } from '@/lib/social-service';
import type { Tournament, TournamentMatchGroup, TournamentTeam } from '@/types';
import { cn } from '@/lib/cn';

interface TournamentRoundMatchListProps {
  tournament: Tournament;
  teams: TournamentTeam[];
  matchGroups: TournamentMatchGroup[];
  playerNameById?: Record<string, string>;
  roundNumber?: number;
  compact?: boolean;
  className?: string;
}

function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: 'complete' | 'progress' | 'scheduled';
}) {
  return (
    <View
      className={cn(
        'rounded-full px-2.5 py-1 border',
        tone === 'complete' && 'bg-neutral-900 border-neutral-700',
        tone === 'progress' && 'bg-amber-950/40 border-amber-700/50',
        tone === 'scheduled' && 'bg-neutral-900 border-neutral-700'
      )}
    >
      <Text
        className={cn(
          'text-[10px] font-bold uppercase tracking-wider',
          tone === 'complete' && 'text-neutral-300',
          tone === 'progress' && 'text-amber-300',
          tone === 'scheduled' && 'text-neutral-500'
        )}
      >
        {label}
      </Text>
    </View>
  );
}

function PlayerNames({
  names,
  alignEnd = false,
  compact = false,
}: {
  names: string[];
  alignEnd?: boolean;
  compact?: boolean;
}) {
  if (names.length === 0) {
    return (
      <Text
        className={cn(
          'text-neutral-500 italic mt-1',
          compact ? 'text-[11px]' : 'text-xs',
          alignEnd && 'text-right'
        )}
      >
        TBD
      </Text>
    );
  }

  return (
    <View className={cn('mt-1 gap-0.5', alignEnd && 'items-end')}>
      {names.map((name, index) => (
        <Text
          key={`${name}-${index}`}
          className={cn(
            'text-neutral-200',
            compact ? 'text-[11px]' : 'text-xs',
            name === 'TBD' && 'text-neutral-500 italic',
            alignEnd && 'text-right'
          )}
          numberOfLines={1}
        >
          {name}
        </Text>
      ))}
    </View>
  );
}

type StatusAlignment = 'left' | 'center' | 'right';

function getStatusAlignment(
  matchStatus: MatchStatus,
  winnerSide: RoundMatchSummary['winnerSide']
): StatusAlignment {
  if (winnerSide === 'tie' || matchStatus.lead === 0) {
    return 'center';
  }
  if (winnerSide === 'side_a' || matchStatus.lead > 0) {
    return 'left';
  }
  if (winnerSide === 'side_b' || matchStatus.lead < 0) {
    return 'right';
  }
  return 'center';
}

function isFinalWinSummary(
  summary: string,
  sideAName: string,
  sideBName: string
): boolean {
  return (
    summary === 'Halved' ||
    summary === `${sideAName} won` ||
    summary === `${sideBName} won`
  );
}

function AlignedMatchStatus({
  matchStatus,
  resultSummary,
  winnerSide,
  playStatus,
  sideAName,
  sideBName,
  prominent = true,
}: {
  matchStatus: MatchStatus;
  resultSummary: string | null;
  winnerSide: RoundMatchSummary['winnerSide'];
  playStatus: RoundMatchSummary['playStatus'];
  sideAName: string;
  sideBName: string;
  prominent?: boolean;
}) {
  if (playStatus === 'not_started' || matchStatus.throughHole === 0) {
    return null;
  }

  const alignment = getStatusAlignment(matchStatus, winnerSide);
  const summary = resultSummary ?? matchStatus.label;
  const showResultText =
    playStatus === 'complete' && summary != null && isFinalWinSummary(summary, sideAName, sideBName);

  const content = showResultText ? (
    <ColoredMatchResultText
      summary={summary}
      sideAName={sideAName}
      sideBName={sideBName}
      prominent={prominent}
    />
  ) : (
    <ColoredMatchStatusText
      matchStatus={matchStatus}
      sideAName={sideAName}
      sideBName={sideBName}
      prominent={prominent}
    />
  );

  return (
    <View
      className={cn(
        'flex-row',
        alignment === 'left' && 'justify-start',
        alignment === 'right' && 'justify-end',
        alignment === 'center' && 'justify-center'
      )}
    >
      <View
        className={cn(
          alignment === 'left' && 'items-start',
          alignment === 'right' && 'items-end',
          alignment === 'center' && 'items-center'
        )}
      >
        {content}
      </View>
    </View>
  );
}

function SinglesPairingStatusBar({
  pairing,
  sideAName,
  sideBName,
}: {
  pairing: RoundMatchSinglesPairing;
  sideAName: string;
  sideBName: string;
}) {
  if (pairing.playStatus === 'not_started' || pairing.matchStatus.throughHole === 0) {
    return null;
  }

  return (
    <View className="px-3 py-1.5 bg-[#0f0f0f] border-t border-neutral-800/80">
      <AlignedMatchStatus
        matchStatus={pairing.matchStatus}
        resultSummary={pairing.resultSummary}
        winnerSide={pairing.winnerSide}
        playStatus={pairing.playStatus}
        sideAName={sideAName}
        sideBName={sideBName}
      />
    </View>
  );
}

function MatchLineupRow({
  lineup,
  sideAName,
  sideBName,
  compact,
}: {
  lineup: RoundMatchLineup;
  sideAName: string;
  sideBName: string;
  compact: boolean;
}) {
  const themeA = getTeamSideTheme('side_a');
  const themeB = getTeamSideTheme('side_b');

  if (lineup.kind === 'singles') {
    return (
      <View className="gap-1.5">
        {lineup.pairings.map((pairing) => (
          <View key={`pair-${pairing.pairingIndex}`}>
            <View className="flex-row items-stretch">
              <View
                className="flex-1 px-3 py-2 justify-center"
                style={{
                  backgroundColor: themeA.panelBg,
                  borderLeftWidth: 3,
                  borderLeftColor: themeA.color,
                }}
              >
                {pairing.pairingIndex === 0 ? (
                  <Text
                    style={{ color: themeA.color }}
                    className={cn('font-bold', compact ? 'text-xs' : 'text-sm')}
                    numberOfLines={1}
                  >
                    {sideAName}
                  </Text>
                ) : null}
                <Text
                  className={cn(
                    'text-neutral-100 font-medium',
                    compact ? 'text-[11px]' : 'text-xs',
                    pairing.pairingIndex === 0 ? 'mt-0.5' : ''
                  )}
                  numberOfLines={1}
                >
                  {pairing.sideAPlayer}
                </Text>
              </View>

              <View className="items-center justify-center px-1.5 bg-[#111] border-x border-neutral-800">
                <Text className="text-neutral-600 text-[8px] font-bold">VS</Text>
              </View>

              <View
                className="flex-1 px-3 py-2 justify-center items-end"
                style={{
                  backgroundColor: themeB.panelBg,
                  borderRightWidth: 3,
                  borderRightColor: themeB.color,
                }}
              >
                {pairing.pairingIndex === 0 ? (
                  <Text
                    style={{ color: themeB.color }}
                    className={cn('font-bold text-right', compact ? 'text-xs' : 'text-sm')}
                    numberOfLines={1}
                  >
                    {sideBName}
                  </Text>
                ) : null}
                <Text
                  className={cn(
                    'text-neutral-100 font-medium text-right',
                    compact ? 'text-[11px]' : 'text-xs',
                    pairing.pairingIndex === 0 ? 'mt-0.5' : ''
                  )}
                  numberOfLines={1}
                >
                  {pairing.sideBPlayer}
                </Text>
              </View>
            </View>
            <SinglesPairingStatusBar
              pairing={pairing}
              sideAName={sideAName}
              sideBName={sideBName}
            />
          </View>
        ))}
      </View>
    );
  }

  return (
    <View className="flex-row items-stretch">
      <View
        className="flex-1 px-3 py-2.5"
        style={{
          backgroundColor: themeA.panelBg,
          borderBottomWidth: 2,
          borderBottomColor: themeA.color,
        }}
      >
        <Text
          style={{ color: themeA.color }}
          className={cn('font-bold', compact ? 'text-sm' : 'text-base')}
          numberOfLines={1}
        >
          {sideAName}
        </Text>
        <PlayerNames names={lineup.sideAPlayers} compact={compact} />
      </View>

      <View className="items-center justify-center px-2 bg-[#111] border-x border-neutral-800">
        <Text className="text-neutral-600 text-[9px] font-bold tracking-widest">VS</Text>
      </View>

      <View
        className="flex-1 px-3 py-2.5 items-end"
        style={{
          backgroundColor: themeB.panelBg,
          borderBottomWidth: 2,
          borderBottomColor: themeB.color,
        }}
      >
        <Text
          style={{ color: themeB.color }}
          className={cn('font-bold text-right', compact ? 'text-sm' : 'text-base')}
          numberOfLines={1}
        >
          {sideBName}
        </Text>
        <PlayerNames names={lineup.sideBPlayers} alignEnd compact={compact} />
      </View>
    </View>
  );
}

export function TournamentRoundMatchList({
  tournament,
  teams,
  matchGroups,
  playerNameById: playerNameByIdProp,
  roundNumber,
  compact = false,
  className,
}: TournamentRoundMatchListProps) {
  const activeRound = roundNumber ?? getActiveRoundNumber(tournament);

  const { data: tournamentPlayers = [] } = useQuery({
    queryKey: ['tournamentPlayers', tournament.id],
    queryFn: () => getTournamentPlayers(tournament.id),
    enabled: !playerNameByIdProp,
  });

  const { data: members = [] } = useQuery({
    queryKey: ['membersForTeam'],
    queryFn: getMembersForChallenge,
    enabled: !playerNameByIdProp,
  });

  const resolvedPlayerNameById = useMemo(() => {
    if (playerNameByIdProp) return playerNameByIdProp;
    return buildTournamentPlayerMaps(tournamentPlayers, members).nameById;
  }, [playerNameByIdProp, tournamentPlayers, members]);

  const { summaries } = useTournamentRoundMatchSummaries(
    tournament,
    teams,
    matchGroups,
    activeRound,
    resolvedPlayerNameById
  );

  if (summaries.length === 0) {
    return (
      <View className={cn('py-3 px-1', className)}>
        <Text className="text-neutral-500 text-xs text-center">
          No tee-time matches scheduled for this round yet.
        </Text>
      </View>
    );
  }

  const roundLabel = formatRoundPickerLabel(tournament, activeRound);

  return (
    <View className={cn(className)}>
      <Text className="text-neutral-500 text-[10px] uppercase tracking-widest mb-2 px-1">
        {roundLabel} · Matches
      </Text>
      <View className="gap-2">
        {summaries.map((match) => {
          const tone =
            match.playStatus === 'complete'
              ? 'complete'
              : match.playStatus === 'in_progress'
                ? 'progress'
                : 'scheduled';

          return (
            <View
              key={match.group.id}
              className="rounded-xl overflow-hidden border border-neutral-800 bg-[#0a0a0a]"
            >
              <MatchLineupRow
                lineup={match.lineup}
                sideAName={match.sideAName}
                sideBName={match.sideBName}
                compact={compact}
              />

              <View className="px-3 py-2">
                <View className="flex-row items-start justify-between gap-2">
                  <Text className="text-neutral-500 text-[10px] font-semibold uppercase tracking-wide flex-1">
                    {formatTeeAssignmentTime(match.group.tee_time)} · Group {match.group.group_number}
                  </Text>
                  <StatusBadge label={match.statusLabel} tone={tone} />
                </View>
                {match.lineup.kind !== 'singles' && match.resultSummary ? (
                  <View className="mt-1.5">
                    <AlignedMatchStatus
                      matchStatus={match.matchStatus}
                      resultSummary={match.resultSummary}
                      winnerSide={match.winnerSide}
                      playStatus={match.playStatus}
                      sideAName={match.sideAName}
                      sideBName={match.sideBName}
                    />
                  </View>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
