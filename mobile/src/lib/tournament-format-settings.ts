import type {
  TournamentFormat,
  TournamentFormatDefinition,
  TournamentFormatsSettings,
  TournamentScoringMode,
} from '@/types';

export const DEFAULT_TOURNAMENT_FORMATS_SETTINGS: TournamentFormatsSettings = {
  active_format_ids: ['scramble', 'best_ball', 'singles'],
  formats: [
    {
      id: 'scramble',
      label: 'Scramble',
      scoring_hint: 'One team score per hole — lower net wins the hole',
      how_it_works:
        'Everyone in the group tees off. The team decides which tee shot is the best. The other players pick up their balls and bring them to that spot. Everyone plays their second shot from within one club-length of that chosen spot (no closer to the hole). Repeat for every shot—including putts—until the ball is holed out. Can be played with 2-, 3-, or 4-person teams.',
      the_score: 'The team records one team score per hole.',
      scoring_mode: 'team_single_score',
      enabled: true,
      default_players_per_match: 2,
      team_scorecard: true,
    },
    {
      id: 'best_ball',
      label: 'Best Ball (Four-Ball)',
      scoring_hint: 'Lowest partner net per side wins the hole',
      how_it_works:
        'You and your partner both play the hole normally from tee to cup. If you score a 5 and your partner scores a 4, your team score for that hole is 4. Throw out the worse score and only record the best ball. Most commonly played as a 2-person team event.',
      the_score: 'One team score per hole (the lowest individual score of the partners).',
      scoring_mode: 'team_best_ball',
      enabled: true,
      default_players_per_match: 2,
      team_scorecard: false,
    },
    {
      id: 'singles',
      label: 'Head-to-Head Singles (Match Play)',
      scoring_hint: '2 per side — paired 1v1 matches at each tee time (A1 vs B1, A2 vs B2)',
      how_it_works:
        'Same tee time: two players from each team. Slot 1 on one team plays slot 1 on the other head-to-head; slot 2 plays slot 2, and so on. Each pairing is its own 1v1 match — lowest score wins the hole (Up, Down, or All Square). Tied holes are halved.',
      the_score:
        'Each 1v1 pairing tracked as Up, Down, or All Square. Team match points sum wins across all pairings at that tee time.',
      scoring_mode: 'head_to_head_match_play',
      enabled: true,
      default_players_per_match: 2,
      team_scorecard: false,
    },
    {
      id: 'alternate_shot',
      label: 'Alternate Shot',
      scoring_hint: 'One team score per side — partners alternate shots',
      how_it_works:
        'Partners alternate shots until the ball is holed. One team score is recorded per hole.',
      the_score: 'One team score per hole.',
      scoring_mode: 'team_single_score',
      enabled: false,
      default_players_per_match: 2,
      team_scorecard: true,
    },
    {
      id: 'match_play',
      label: 'Match Play',
      scoring_hint: 'Hole-by-hole match play scoring',
      how_it_works: 'Same as head-to-head singles — lowest net wins each hole.',
      the_score: 'Tracked as Up, Down, or All Square.',
      scoring_mode: 'head_to_head_match_play',
      enabled: false,
      default_players_per_match: 1,
      team_scorecard: false,
    },
  ],
};

const LEGACY_SCORING_MODES: Record<string, TournamentScoringMode> = {
  scramble: 'team_single_score',
  best_ball: 'team_best_ball',
  alternate_shot: 'team_single_score',
  singles: 'head_to_head_match_play',
  match_play: 'head_to_head_match_play',
};

export function getDefaultTournamentFormatsSettings(): TournamentFormatsSettings {
  return {
    active_format_ids: [...DEFAULT_TOURNAMENT_FORMATS_SETTINGS.active_format_ids],
    formats: DEFAULT_TOURNAMENT_FORMATS_SETTINGS.formats.map((format) => ({ ...format })),
  };
}

export function mergeTournamentFormatsSettings(
  stored: Partial<TournamentFormatsSettings> | null | undefined
): TournamentFormatsSettings {
  const defaults = getDefaultTournamentFormatsSettings();
  if (!stored) return defaults;

  const storedById = new Map((stored.formats ?? []).map((format) => [format.id, format]));

  return {
    active_format_ids: stored.active_format_ids ?? defaults.active_format_ids,
    formats: defaults.formats.map((defaultFormat) => ({
      ...defaultFormat,
      ...storedById.get(defaultFormat.id),
      id: defaultFormat.id,
    })),
  };
}

export function resolveFormatDefinition(
  formatId: TournamentFormat,
  settings?: TournamentFormatsSettings | null
): TournamentFormatDefinition | undefined {
  const merged = mergeTournamentFormatsSettings(settings);
  return merged.formats.find((format) => format.id === formatId);
}

export function getScoringModeForFormat(
  formatId: TournamentFormat,
  settings?: TournamentFormatsSettings | null
): TournamentScoringMode {
  const definition = resolveFormatDefinition(formatId, settings);
  if (definition) return definition.scoring_mode;
  return LEGACY_SCORING_MODES[formatId] ?? 'team_single_score';
}

export function isHeadToHeadFormat(
  formatId: TournamentFormat,
  settings?: TournamentFormatsSettings | null
): boolean {
  return getScoringModeForFormat(formatId, settings) === 'head_to_head_match_play';
}

export function isTeamScorecardFormatFromSettings(
  formatId: TournamentFormat,
  settings?: TournamentFormatsSettings | null
): boolean {
  const definition = resolveFormatDefinition(formatId, settings);
  if (definition) return definition.team_scorecard;
  return formatId === 'scramble' || formatId === 'alternate_shot';
}

export function getActiveFormats(
  settings?: TournamentFormatsSettings | null
): TournamentFormatDefinition[] {
  const merged = mergeTournamentFormatsSettings(settings);
  const activeIds = new Set(merged.active_format_ids);
  return merged.formats.filter((format) => format.enabled && activeIds.has(format.id));
}

export function getActiveFormatIds(settings?: TournamentFormatsSettings | null): string[] {
  return getActiveFormats(settings).map((format) => format.id);
}

export function formatLabelFromSettings(
  formatId: TournamentFormat,
  settings?: TournamentFormatsSettings | null
): string {
  const definition = resolveFormatDefinition(formatId, settings);
  if (definition?.label) return definition.label;
  return formatId
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function formatScoringHintFromSettings(
  formatId: TournamentFormat,
  settings?: TournamentFormatsSettings | null
): string {
  const definition = resolveFormatDefinition(formatId, settings);
  return definition?.scoring_hint ?? 'Configure scoring rules for this format in admin settings.';
}

export function formatsShareScoringMode(
  formatA: TournamentFormat,
  formatB: TournamentFormat,
  settings?: TournamentFormatsSettings | null
): boolean {
  return getScoringModeForFormat(formatA, settings) === getScoringModeForFormat(formatB, settings);
}
