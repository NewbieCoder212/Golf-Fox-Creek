import type { Tournament, TournamentFormat, TournamentMatchGroup } from '@/types';
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
  best_ball: 'Best Ball',
  alternate_shot: 'Alternate Shot',
  singles: 'Singles',
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
  if (group.format) return group.format;
  if (tournament) return getRoundFormat(tournament, group.round_number);
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
  const startDate = new Date(start);
  const endDate = new Date(end);
  const sameDay = startDate.toDateString() === endDate.toDateString();

  const fmt = (d: Date) =>
    d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });

  if (sameDay) return fmt(startDate);
  return `${fmt(startDate)} – ${fmt(endDate)}`;
}

export { flattenRoundFormats };

export const GAME_TYPE_LABELS: Record<string, string> = {
  skins: 'Skins',
  stableford_points: 'Stableford Points',
};
