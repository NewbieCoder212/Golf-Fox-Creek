import type { TournamentDaySchedule, TournamentFormat } from '@/types';

export const MAX_TOURNAMENT_DAYS = 14;
export const MAX_TOURNAMENT_ROUNDS = 14;

export function flattenRoundFormats(schedule: TournamentDaySchedule[]): TournamentFormat[] {
  return schedule.flatMap((day) => day.formats);
}

export function getTotalRounds(schedule: TournamentDaySchedule[]): number {
  return flattenRoundFormats(schedule).length;
}

export function getDayCount(schedule: TournamentDaySchedule[]): number {
  return schedule.length;
}

export function getRoundMeta(schedule: TournamentDaySchedule[], roundNumber: number) {
  let counter = 0;

  for (let dayIndex = 0; dayIndex < schedule.length; dayIndex++) {
    const day = schedule[dayIndex];
    for (let roundInDay = 0; roundInDay < day.formats.length; roundInDay++) {
      counter += 1;
      if (counter === roundNumber) {
        return {
          dayNumber: dayIndex + 1,
          roundInDay: roundInDay + 1,
          roundNumber,
          format: day.formats[roundInDay],
        };
      }
    }
  }

  return {
    dayNumber: 1,
    roundInDay: 1,
    roundNumber: 1,
    format: schedule[0]?.formats[0] ?? 'scramble',
  };
}

export function getRoundFormatFromSchedule(
  schedule: TournamentDaySchedule[],
  roundNumber: number
): TournamentFormat {
  return getRoundMeta(schedule, roundNumber).format;
}

export function getDayNumberForRound(
  schedule: TournamentDaySchedule[],
  roundNumber: number
): number {
  return getRoundMeta(schedule, roundNumber).dayNumber;
}

export function formatRoundLabel(
  schedule: TournamentDaySchedule[],
  roundNumber: number
): string {
  const meta = getRoundMeta(schedule, roundNumber);
  const day = schedule[meta.dayNumber - 1];
  const multiRoundDay = (day?.formats.length ?? 0) > 1;

  if (multiRoundDay) {
    return `D${meta.dayNumber} R${meta.roundInDay}`;
  }

  return `Day ${meta.dayNumber}`;
}

export function formatScheduleSummary(schedule: TournamentDaySchedule[]): string {
  return schedule
    .map((day, dayIndex) => {
      const formats = day.formats.join(', ');
      return `Day ${dayIndex + 1}: ${formats}`;
    })
    .join(' · ');
}

export function scheduleNeedsTeams(schedule: TournamentDaySchedule[]): boolean {
  return flattenRoundFormats(schedule).some((format) => format !== 'singles');
}

export function scheduleHasSinglesRound(schedule: TournamentDaySchedule[]): boolean {
  return flattenRoundFormats(schedule).some(
    (format) => format === 'singles' || format === 'match_play'
  );
}

export function createDefaultSchedule(): TournamentDaySchedule[] {
  return [{ formats: ['scramble'] }];
}

export function buildSchedulePayload(schedule: TournamentDaySchedule[]) {
  return {
    round_schedule: schedule,
    rounds_count: getTotalRounds(schedule),
  };
}
