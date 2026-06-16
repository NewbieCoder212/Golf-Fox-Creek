/**
 * Fox Creek Golf Club — all member-facing dates and times use Moncton (ADT/AST).
 */

export const CLUB_TIMEZONE = 'America/Moncton';

interface ClubDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function getClubDateParts(iso: string | Date): ClubDateParts {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CLUB_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

/** Format an instant for display in Moncton. */
export function formatInClubTimezone(
  iso: string | Date,
  options: Intl.DateTimeFormatOptions
): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  return new Intl.DateTimeFormat('en-CA', {
    ...options,
    timeZone: CLUB_TIMEZONE,
  }).format(date);
}

export function formatClubDate(
  iso: string,
  style: 'short' | 'input' | 'long' = 'short'
): string {
  if (style === 'input') {
    return clubDateInputValue(iso);
  }

  if (style === 'long') {
    return formatInClubTimezone(iso, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  return formatInClubTimezone(iso, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatClubTime(iso: string, withZone = false): string {
  return formatInClubTimezone(iso, {
    hour: 'numeric',
    minute: '2-digit',
    ...(withZone ? { timeZoneName: 'short' } : {}),
  });
}

export function formatTournamentDateRange(start: string, end: string): string {
  const startParts = getClubDateParts(start);
  const endParts = getClubDateParts(end);
  const sameDay =
    startParts.year === endParts.year &&
    startParts.month === endParts.month &&
    startParts.day === endParts.day;

  if (sameDay) return formatClubDate(start);
  return `${formatClubDate(start)} – ${formatClubDate(end)}`;
}

/** YYYY-MM-DD on the Moncton calendar. */
export function clubDateInputValue(iso: string): string {
  const parts = getClubDateParts(iso);
  const month = String(parts.month).padStart(2, '0');
  const day = String(parts.day).padStart(2, '0');
  return `${parts.year}-${month}-${day}`;
}

/** HH:MM on the Moncton clock (24h). */
export function clubTimeInputValue(iso: string): string {
  const parts = getClubDateParts(iso);
  const hour = String(parts.hour).padStart(2, '0');
  const minute = String(parts.minute).padStart(2, '0');
  return `${hour}:${minute}`;
}

/**
 * Interpret YYYY-MM-DD (+ optional HH:MM) as Moncton civil time → UTC ISO for storage.
 */
export function clubDateTimeToIso(dateStr: string, timeHm = '12:00'): string {
  const dateMatch = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateMatch) return new Date(dateStr).toISOString();

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);

  const timeMatch = timeHm.trim().match(/^(\d{1,2}):(\d{2})$/);
  const hour = timeMatch ? Number(timeMatch[1]) : 12;
  const minute = timeMatch ? Number(timeMatch[2]) : 0;

  let utcMs = Date.UTC(year, month - 1, day, hour, minute, 0);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const shown = getClubDateParts(new Date(utcMs));
    const diffMinutes =
      (year - shown.year) * 525600 +
      (month - shown.month) * 43200 +
      (day - shown.day) * 1440 +
      (hour - shown.hour) * 60 +
      (minute - shown.minute);

    if (diffMinutes === 0) break;
    utcMs += diffMinutes * 60 * 1000;
  }

  return new Date(utcMs).toISOString();
}

/** Store a Moncton calendar day at noon (avoids DST midnight edge cases). */
export function clubDateInputToIso(dateStr: string): string {
  return clubDateTimeToIso(dateStr, '12:00');
}

export function addClubCalendarDays(dateIso: string, days: number): string {
  const anchor = clubDateInputToIso(clubDateInputValue(dateIso));
  const shifted = new Date(new Date(anchor).getTime() + days * 86_400_000);
  return clubDateInputValue(shifted.toISOString());
}

/** Tee time on a tournament day (day 1 = tournament start date in Moncton). */
export function buildClubTeeTimeIso(
  tournamentStartDate: string,
  dayNumber: number,
  timeHm: string
): string {
  const dateStr = addClubCalendarDays(tournamentStartDate, dayNumber - 1);
  const timeMatch = timeHm.trim().match(/^(\d{1,2}):(\d{2})$/);
  const time = timeMatch ? timeHm.trim() : '08:00';
  return clubDateTimeToIso(dateStr, time);
}

/** Current time as ISO (UTC storage — display always via club formatters). */
export function clubNowIso(): string {
  return new Date().toISOString();
}
