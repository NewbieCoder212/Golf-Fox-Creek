import type { Tournament, TournamentFormat, TournamentMatchGroup, TournamentTeamSide } from '@/types';
import {
  clubDateInputToIso,
  clubDateInputValue,
  formatTournamentDateRange,
} from './club-timezone';
import {
  flattenRoundFormats,
  formatRoundLabel,
  getRoundFormatFromSchedule,
  scheduleHasSinglesRound,
  scheduleNeedsTeams,
} from './tournament-schedule';

export const KNOWN_FORMATS = [
  'scramble',
  'best_ball',
  'alternate_shot',
  'singles',
  'match_play',
] as const;

export type KnownTournamentFormat = (typeof KNOWN_FORMATS)[number];

export const FORMAT_LABELS: Record<string, string> = {
  scramble: 'Scramble',
  best_ball: 'Best Ball (Four-Ball)',
  alternate_shot: 'Alternate Shot',
  singles: 'Head-to-Head Singles (Match Play)',
  match_play: 'Match Play',
};

export const FORMAT_MATCH_SCORING_HINTS: Record<string, string> = {
  scramble: 'One team score per side — lower net wins the hole',
  best_ball: 'Best net among partners per side wins the hole',
  alternate_shot: 'One team score per side — lower net wins the hole',
  singles: 'Each player scores — paired 1v1 matches within the foursome',
  match_play: 'Match play scoring — lower net wins the hole',
};

export const MATCH_FORMATS: TournamentFormat[] = [
  'scramble',
  'best_ball',
  'alternate_shot',
  'singles',
  'match_play',
];

export const PRESET_TOURNAMENT_FORMATS: TournamentFormat[] = [
  'scramble',
  'best_ball',
  'alternate_shot',
  'singles',
  'match_play',
];

export function formatLabel(format: TournamentFormat): string {
  if (FORMAT_LABELS[format]) return FORMAT_LABELS[format];
  return format
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function formatScoringHint(format: TournamentFormat): string {
  return (
    FORMAT_MATCH_SCORING_HINTS[format] ??
    'Team gross entry — configure scoring rules for this custom format'
  );
}

export function isKnownFormat(format: TournamentFormat): format is KnownTournamentFormat {
  return (KNOWN_FORMATS as readonly string[]).includes(format);
}

export function isSinglesFormat(format: TournamentFormat): boolean {
  return format === 'singles' || format === 'match_play';
}

export function isTeamScorecardFormat(format: TournamentFormat): boolean {
  return format === 'scramble' || format === 'alternate_shot';
}

/** Team formats where each phone only enters one side's team score (not full foursome). */
export function isSideScopedTeamFormat(format: TournamentFormat): boolean {
  return isTeamScorecardFormat(format);
}

/** Formats where the scorecard lists every player in the tee-time foursome. */
export function isFoursomePlayerScorecardFormat(format: TournamentFormat): boolean {
  return format === 'best_ball' || format === 'singles' || format === 'match_play';
}

export function getRoundFormat(
  tournament: Pick<Tournament, 'round_schedule'>,
  roundNumber: number
): TournamentFormat {
  return getRoundFormatFromSchedule(tournament.round_schedule, roundNumber);
}

export function getMatchGroupFormat(
  group: Pick<TournamentMatchGroup, 'format' | 'round_number'>,
  tournament?: Pick<Tournament, 'round_schedule'>
): TournamentFormat {
  // Tournament round schedule is authoritative (match group format can be stale).
  if (tournament) {
    return getRoundFormat(tournament, group.round_number);
  }
  if (group.format) return group.format;
  return 'scramble';
}

export function formatRoundFormatsSummary(schedule: Tournament['round_schedule']): string {
  return schedule
    .map((day, dayIndex) => {
      const formats = day.formats.map((format) => formatLabel(format)).join(', ');
      return `Day ${dayIndex + 1}: ${formats}`;
    })
    .join(' · ');
}

export function formatRoundPickerLabel(
  tournament: Pick<Tournament, 'round_schedule'>,
  roundNumber: number
): string {
  const label = formatRoundLabel(tournament.round_schedule, roundNumber);
  const format = getRoundFormat(tournament, roundNumber);
  return `${label} · ${formatLabel(format)}`;
}

export function tournamentNeedsTeams(tournament: Pick<Tournament, 'round_schedule'>): boolean {
  return scheduleNeedsTeams(tournament.round_schedule);
}

export function tournamentHasSinglesRound(tournament: Pick<Tournament, 'round_schedule'>): boolean {
  return scheduleHasSinglesRound(tournament.round_schedule);
}

export function formatTournamentDates(start: string, end: string): string {
  return formatTournamentDateRange(start, end);
}

/** YYYY-MM-DD on the Moncton calendar — use for date inputs. */
export function toTournamentDateInputValue(iso: string): string {
  return clubDateInputValue(iso);
}

/** Parse YYYY-MM-DD as a Moncton calendar day. */
export function tournamentDateInputToIso(dateStr: string): string {
  return clubDateInputToIso(dateStr);
}

export function getTeamSideDisplayName(
  side: TournamentTeamSide,
  teams: Array<{ side: TournamentTeamSide | null; team_name: string }>
): string {
  const team = teams.find((entry) => entry.side === side);
  return team?.team_name ?? (side === 'side_a' ? 'Team A' : 'Team B');
}

export { flattenRoundFormats };

export const GAME_TYPE_LABELS: Record<string, string> = {
  skins: 'Skins',
  stableford_points: 'Stableford Points',
};
