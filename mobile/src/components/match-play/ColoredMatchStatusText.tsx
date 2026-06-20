import { View, Text } from 'react-native';

import type { MatchStatus } from '@/lib/tournament-match-status';
import { SIDE_A_COLOR, SIDE_B_COLOR } from '@/lib/match-play-theme';
import type { TournamentTeamSide } from '@/types';
import { cn } from '@/lib/cn';

function leaderColor(side: TournamentTeamSide | null): string {
  if (side === 'side_a') return SIDE_A_COLOR;
  if (side === 'side_b') return SIDE_B_COLOR;
  return '#e5e5e5';
}

function formatHoleProgress(matchStatus: MatchStatus): string | null {
  if (matchStatus.throughHole <= 0) return null;

  if (matchStatus.clinched) {
    return `Final · thru ${matchStatus.throughHole}`;
  }

  if (matchStatus.holesRemaining > 0) {
    const currentHole = Math.min(18, matchStatus.throughHole + 1);
    return `Thru ${matchStatus.throughHole} · on ${currentHole}`;
  }

  return `Thru ${matchStatus.throughHole}`;
}

interface ColoredMatchStatusTextProps {
  matchStatus: MatchStatus;
  sideAName: string;
  sideBName: string;
  compact?: boolean;
  lounge?: boolean;
  prominent?: boolean;
}

/** TV / leaderboard live match standing with team colors and hole progress. */
export function ColoredMatchStatusText({
  matchStatus,
  sideAName,
  sideBName,
  compact = false,
  lounge = false,
  prominent = false,
}: ColoredMatchStatusTextProps) {
  const { lead, dormie, clinched, throughHole } = matchStatus;
  const leaderSide: TournamentTeamSide | null =
    lead > 0 ? 'side_a' : lead < 0 ? 'side_b' : null;
  const leaderName = leaderSide === 'side_a' ? sideAName : leaderSide === 'side_b' ? sideBName : null;
  const color = leaderColor(leaderSide);
  const progress = formatHoleProgress(matchStatus);
  const standingSize = prominent
    ? 'text-lg font-bold'
    : lounge
      ? 'text-2xl'
      : compact
        ? 'text-[10px]'
        : 'text-sm';
  const progressSize = prominent
    ? 'text-[10px]'
    : lounge
      ? 'text-lg'
      : compact
        ? 'text-[9px]'
        : 'text-[10px]';

  if (throughHole === 0) {
    return null;
  }

  if (lead === 0) {
    return (
      <View>
        <Text className={cn('text-neutral-200 font-semibold', standingSize)}>ALL SQUARE</Text>
        {progress ? (
          <Text className={cn('text-neutral-500 mt-0.5', progressSize)}>
            {progress}
          </Text>
        ) : null}
      </View>
    );
  }

  if (clinched) {
    return (
      <View>
        <Text className={cn('font-semibold', standingSize)} style={{ color }}>
          {matchStatus.label}
        </Text>
        {progress ? (
          <Text className={cn('text-neutral-500 mt-0.5', progressSize)}>
            {progress}
          </Text>
        ) : null}
      </View>
    );
  }

  const abs = Math.abs(lead);

  return (
    <View>
      <Text className={cn('font-semibold', standingSize)}>
        <Text style={{ color }}>{leaderName}</Text>
        <Text style={{ color }}> {abs} UP</Text>
        {dormie ? <Text style={{ color }}> · DORMIE</Text> : null}
      </Text>
      {progress ? (
        <Text className={cn('text-neutral-500 mt-1', progressSize)}>
          {progress}
          {matchStatus.holesRemaining > 0 && !dormie
            ? ` · ${matchStatus.holesRemaining} to play`
            : ''}
        </Text>
      ) : null}
    </View>
  );
}

/** Color the winning team name in a final result line (e.g. "Diapers won"). */
export function ColoredMatchResultText({
  summary,
  sideAName,
  sideBName,
  compact = false,
  lounge = false,
  prominent = false,
}: {
  summary: string;
  sideAName: string;
  sideBName: string;
  compact?: boolean;
  lounge?: boolean;
  prominent?: boolean;
}) {
  const standingSize = prominent
    ? 'text-lg font-bold'
    : lounge
      ? 'text-xl'
      : compact
        ? 'text-[10px]'
        : 'text-sm';

  if (summary === 'Halved') {
    return (
      <Text className={cn('text-neutral-300 font-semibold', standingSize)}>{summary}</Text>
    );
  }

  if (summary === `${sideAName} won`) {
    return (
      <Text className={cn('font-semibold', standingSize)}>
        <Text style={{ color: SIDE_A_COLOR }}>{sideAName}</Text>
        <Text className="text-neutral-200"> won</Text>
      </Text>
    );
  }

  if (summary === `${sideBName} won`) {
    return (
      <Text className={cn('font-semibold', standingSize)}>
        <Text style={{ color: SIDE_B_COLOR }}>{sideBName}</Text>
        <Text className="text-neutral-200"> won</Text>
      </Text>
    );
  }

  return (
    <Text className={cn('text-neutral-200 font-semibold', standingSize)} numberOfLines={1}>
      {summary}
    </Text>
  );
}
