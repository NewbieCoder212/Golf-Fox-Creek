import type { TournamentMatchGroup } from '@/types';

export interface ScheduleTeeTimeSlot {
  id: string;
  teeTime: string;
  startingHole: number;
  groupNumber: number;
  sideAPlayerIds: string[];
  sideBPlayerIds: string[];
}

function sortGroupsForSchedule(groups: TournamentMatchGroup[]): TournamentMatchGroup[] {
  return [...groups].sort(
    (a, b) =>
      new Date(a.tee_time).getTime() - new Date(b.tee_time).getTime() ||
      a.group_number - b.group_number
  );
}

function groupToSlot(group: TournamentMatchGroup): ScheduleTeeTimeSlot {
  return {
    id: group.id,
    teeTime: group.tee_time,
    startingHole: group.starting_hole,
    groupNumber: group.group_number,
    sideAPlayerIds: [...group.side_a_player_ids],
    sideBPlayerIds: [...group.side_b_player_ids],
  };
}

/** Merge DB rows that share a tee time into one foursome card (singles: A1 vs B1, A2 vs B2). */
export function buildScheduleTeeTimeSlots(
  groups: TournamentMatchGroup[],
  options: { mergeSinglesFoursomes: boolean }
): ScheduleTeeTimeSlot[] {
  const sorted = sortGroupsForSchedule(groups);

  if (!options.mergeSinglesFoursomes) {
    return sorted.map(groupToSlot);
  }

  const slots = new Map<string, ScheduleTeeTimeSlot>();

  for (const group of sorted) {
    const key = `${group.tee_time}|${group.starting_hole}`;
    const existing = slots.get(key);

    if (!existing) {
      slots.set(key, groupToSlot(group));
      continue;
    }

    existing.sideAPlayerIds.push(...group.side_a_player_ids);
    existing.sideBPlayerIds.push(...group.side_b_player_ids);
    existing.groupNumber = Math.min(existing.groupNumber, group.group_number);
  }

  return Array.from(slots.values()).sort(
    (a, b) =>
      new Date(a.teeTime).getTime() - new Date(b.teeTime).getTime() ||
      a.groupNumber - b.groupNumber
  );
}
