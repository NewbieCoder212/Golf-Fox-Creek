import type { Tournament, TournamentFormat, TournamentMatchGroup, WageringGameType } from '@/types';
import {
  flattenRoundFormats,
  formatRoundLabel,
  getRoundFormatFromSchedule,
  scheduleHasSinglesRound,
  scheduleNeedsTeams,
} from './tournament-schedule';

export const FORMAT_LABELS: Record<TournamentFormat, string> = {
  scramble: 'Scramble',
  best_ball: 'Best Ball',
  alternate_shot: 'Alternate Shot',
  singles: 'Singles',
};

export const FORMAT_MATCH_SCORING_HINTS: Record<TournamentFormat, string> = {
  scramble: 'One team score per side — lower net wins the hole',
  best_ball: 'Best net among partners per side wins the hole',
  alternate_shot: 'One team score per side — lower net wins the hole',
  singles: 'Each player scores — best net per side wins the hole',
};

export const MATCH_FORMATS: TournamentFormat[] = [
  'scramble',
  'best_ball',
  'alternate_shot',
  'singles',
];

export const GAME_TYPE_LABELS: Record<WageringGameType, string> = {
  skins: 'Skins',
  stableford_points: 'Stableford Points',
};

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
      const formats = day.formats.map((format) => FORMAT_LABELS[format]).join(', ');
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
  return `${label} · ${FORMAT_LABELS[format]}`;
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
