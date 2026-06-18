/**
 * Team colors for Direct Result match play UI.
 * side_a = Diapers (Red), side_b = Depends (Blue)
 */

import type { TournamentMatchHoleWinner, TournamentTeamSide } from '@/types';

export const SIDE_A_COLOR = '#DC2626'; // Red — Diapers
export const SIDE_B_COLOR = '#2563EB'; // Blue — Depends
export const HALVED_COLOR = '#525252'; // Neutral gray
export const UNPLAYED_COLOR = 'transparent';
export const LOCKED_OPACITY = 0.35;

export const SIDE_A_BG = 'bg-red-600';
export const SIDE_B_BG = 'bg-blue-600';
export const HALVED_BG = 'bg-neutral-600';
export const UNPLAYED_BG = 'bg-neutral-900/40';

export type TeamSideTheme = {
  color: string;
  colorLight: string;
  panelBg: string;
  panelBorder: string;
  ringBorder: string;
  ringGlow: string;
};

const SIDE_A_THEME: TeamSideTheme = {
  color: SIDE_A_COLOR,
  colorLight: '#f87171',
  panelBg: 'rgba(127, 29, 29, 0.35)',
  panelBorder: 'rgba(220, 38, 38, 0.45)',
  ringBorder: 'rgba(248, 113, 113, 0.7)',
  ringGlow: 'rgba(220, 38, 38, 0.15)',
};

const SIDE_B_THEME: TeamSideTheme = {
  color: SIDE_B_COLOR,
  colorLight: '#60a5fa',
  panelBg: 'rgba(30, 58, 138, 0.35)',
  panelBorder: 'rgba(37, 99, 235, 0.45)',
  ringBorder: 'rgba(96, 165, 250, 0.7)',
  ringGlow: 'rgba(37, 99, 235, 0.15)',
};

export function getTeamSideTheme(side: TournamentTeamSide): TeamSideTheme {
  return side === 'side_a' ? SIDE_A_THEME : SIDE_B_THEME;
}

export function getOpponentSide(side: TournamentTeamSide): TournamentTeamSide {
  return side === 'side_a' ? 'side_b' : 'side_a';
}

export type MatchWinnerSide = TournamentTeamSide | 'tie' | null;

const HALVED_THEME: TeamSideTheme = {
  color: HALVED_COLOR,
  colorLight: '#a3a3a3',
  panelBg: 'rgba(38, 38, 38, 0.45)',
  panelBorder: 'rgba(115, 115, 115, 0.45)',
  ringBorder: 'rgba(163, 163, 163, 0.55)',
  ringGlow: 'rgba(82, 82, 82, 0.2)',
};

export function getMatchWinnerTheme(winner: MatchWinnerSide): TeamSideTheme {
  if (winner === 'side_a') return SIDE_A_THEME;
  if (winner === 'side_b') return SIDE_B_THEME;
  return HALVED_THEME;
}

export function getHoleWinnerColor(winner: TournamentMatchHoleWinner | null | undefined): string {
  if (!winner) return UNPLAYED_COLOR;
  if (winner === 'side_a') return SIDE_A_COLOR;
  if (winner === 'side_b') return SIDE_B_COLOR;
  return HALVED_COLOR;
}

export function getHoleWinnerBgClass(winner: TournamentMatchHoleWinner | null | undefined): string {
  if (!winner) return UNPLAYED_BG;
  if (winner === 'side_a') return SIDE_A_BG;
  if (winner === 'side_b') return SIDE_B_BG;
  return HALVED_BG;
}

export interface HoleCellStyle {
  backgroundColor: string;
  opacity: number;
}

export function getHoleCellStyle(
  winner: TournamentMatchHoleWinner | null | undefined,
  isLocked: boolean
): HoleCellStyle {
  return {
    backgroundColor: getHoleWinnerColor(winner),
    opacity: isLocked ? LOCKED_OPACITY : 1,
  };
}
