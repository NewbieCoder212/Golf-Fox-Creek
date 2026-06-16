import type {
  Tournament,
  TournamentFormat,
  TournamentMatchGroup,
  TournamentTeam,
} from '@/types';
import { buildClubTeeTimeIso } from './club-timezone';
import { formatTeeAssignmentTime } from './tournament-tee-service';
import {
  deleteTournamentMatchGroup,
  saveTournamentMatchGroup,
} from './tournament-match-service';

export type PairingRowDraft = {
  clientKey: string;
  groupId?: string;
  groupNumber: number;
  teeTime: string;
  startingHole: string;
  sideAPlayerIds: string[];
  sideBPlayerIds: string[];
};

function getClubHmFromIso(iso: string): string {
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Moncton',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '08';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00';
  return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
}

export function incrementTeeTimeHm(time: string, minutes: number): string {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return '08:00';
  let hours = Number(match[1]);
  let mins = Number(match[2]) + minutes;
  hours += Math.floor(mins / 60);
  mins %= 60;
  hours %= 24;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export function createEmptyPairingRow(groupNumber: number, teeTime = '08:00'): PairingRowDraft {
  return {
    clientKey: `draft-${groupNumber}-${Date.now()}`,
    groupNumber,
    teeTime,
    startingHole: '1',
    sideAPlayerIds: [],
    sideBPlayerIds: [],
  };
}

export function matchGroupsToPairingRows(groups: TournamentMatchGroup[]): PairingRowDraft[] {
  return groups.map((group) => ({
    clientKey: group.id,
    groupId: group.id,
    groupNumber: group.group_number,
    teeTime: getClubHmFromIso(group.tee_time),
    startingHole: String(group.starting_hole),
    sideAPlayerIds: [...group.side_a_player_ids],
    sideBPlayerIds: [...group.side_b_player_ids],
  }));
}

export function getAssignedPlayerIdsInDraftRows(
  rows: PairingRowDraft[],
  excludeRowKey?: string
): Set<string> {
  const assigned = new Set<string>();
  for (const row of rows) {
    if (excludeRowKey && row.clientKey === excludeRowKey) continue;
    row.sideAPlayerIds.forEach((id) => {
      if (id) assigned.add(id);
    });
    row.sideBPlayerIds.forEach((id) => {
      if (id) assigned.add(id);
    });
  }
  return assigned;
}

export function formatPairingRowTeeLabel(teeTime: string): string {
  if (/^\d{1,2}:\d{2}$/.test(teeTime.trim())) {
    const [hour, minute] = teeTime.split(':');
    const date = new Date();
    date.setHours(Number(hour), Number(minute), 0, 0);
    return formatTeeAssignmentTime(date.toISOString());
  }
  return teeTime;
}

export async function savePairingRowsBatch(params: {
  tournament: Tournament;
  roundNumber: number;
  roundFormat: TournamentFormat;
  sideATeam: TournamentTeam;
  sideBTeam: TournamentTeam;
  rows: PairingRowDraft[];
  dayNumber: number;
  playersPerMatch: number;
}): Promise<void> {
  const seenGroupNumbers = new Set<number>();

  for (const row of params.rows) {
    if (seenGroupNumbers.has(row.groupNumber)) {
      throw new Error(`Duplicate group number ${row.groupNumber}`);
    }
    seenGroupNumbers.add(row.groupNumber);

    const filledA = row.sideAPlayerIds.filter(Boolean).length;
    const filledB = row.sideBPlayerIds.filter(Boolean).length;
    const isEmpty = filledA === 0 && filledB === 0;

    if (isEmpty) {
      if (row.groupId) {
        const deleted = await deleteTournamentMatchGroup(row.groupId);
        if (!deleted) {
          throw new Error(`Could not delete empty pairing row ${row.groupNumber}`);
        }
      }
      continue;
    }

    if (
      filledA !== params.playersPerMatch ||
      filledB !== params.playersPerMatch
    ) {
      throw new Error(
        `Group ${row.groupNumber} needs ${params.playersPerMatch} players per side before saving.`
      );
    }

    const assignedElsewhere = getAssignedPlayerIdsInDraftRows(params.rows, row.clientKey);
    const duplicate = [...row.sideAPlayerIds, ...row.sideBPlayerIds]
      .filter(Boolean)
      .find((id) => assignedElsewhere.has(id));
    if (duplicate) {
      throw new Error('A player appears in more than one pairing row.');
    }

    const saved = await saveTournamentMatchGroup({
      tournament_id: params.tournament.id,
      round_number: params.roundNumber,
      format: params.roundFormat,
      side_a_team_id: params.sideATeam.id,
      side_b_team_id: params.sideBTeam.id,
      side_a_player_ids: row.sideAPlayerIds.filter(Boolean),
      side_b_player_ids: row.sideBPlayerIds.filter(Boolean),
      tee_time: buildClubTeeTimeIso(params.tournament.start_date, params.dayNumber, row.teeTime),
      starting_hole: Math.min(18, Math.max(1, Number(row.startingHole) || 1)),
      group_number: row.groupNumber,
    });

    if (!saved) {
      throw new Error(`Could not save pairing row ${row.groupNumber}`);
    }
  }
}
