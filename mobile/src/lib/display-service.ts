import type { TournamentDisplayPayload } from '@/types';
import { getBackendUrl } from '@/lib/backend-url';

const WEB_APP_URL =
  process.env.EXPO_PUBLIC_WEB_APP_URL?.replace(/\/$/, '') ??
  (typeof window !== 'undefined' ? window.location.origin : 'https://www.foxcreek.golf');

export function buildTournamentTvDisplayUrl(tournamentId: string, displayToken: string): string {
  const params = new URLSearchParams({ token: displayToken });
  return `${WEB_APP_URL}/display/tournament/${tournamentId}?${params.toString()}`;
}

/** Short clubhouse TV URL, e.g. foxcreek.golf/tv/generation-cup */
export function buildTournamentTvShortUrl(displaySlug: string): string {
  const slug = displaySlug.trim().toLowerCase();
  return `${WEB_APP_URL}/tv/${slug}`;
}

/** Lounge TV layout — large type for wall-mounted displays */
export function buildTournamentTvLoungeUrl(displaySlug: string): string {
  const slug = displaySlug.trim().toLowerCase();
  return `${WEB_APP_URL}/tv/${slug}/lounge`;
}

export function getPreferredTournamentTvDisplayUrl(
  tournamentId: string,
  displayToken: string,
  displaySlug?: string | null
): string {
  if (displaySlug?.trim()) {
    return buildTournamentTvShortUrl(displaySlug);
  }
  return buildTournamentTvDisplayUrl(tournamentId, displayToken);
}

export function formatTvShortUrlForTyping(displaySlug: string, lounge = false): string {
  const host =
    typeof window !== 'undefined'
      ? window.location.host.replace(/^www\./, '')
      : 'foxcreek.golf';
  const slug = displaySlug.trim().toLowerCase();
  return lounge ? `${host}/tv/${slug}/lounge` : `${host}/tv/${slug}`;
}

async function parseDisplayResponse(response: Response): Promise<TournamentDisplayPayload> {
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Display request failed (${response.status})`);
  }
  return response.json() as Promise<TournamentDisplayPayload>;
}

export async function fetchTournamentDisplay(
  tournamentId: string,
  token: string
): Promise<TournamentDisplayPayload> {
  const params = new URLSearchParams({ token });
  const response = await fetch(
    `${getBackendUrl()}/api/display/tournament/${tournamentId}?${params.toString()}`
  );
  return parseDisplayResponse(response);
}

export async function fetchTournamentDisplayBySlug(
  slug: string
): Promise<TournamentDisplayPayload> {
  const normalized = slug.trim().toLowerCase();
  const response = await fetch(
    `${getBackendUrl()}/api/display/tournament/by-slug/${encodeURIComponent(normalized)}`
  );
  return parseDisplayResponse(response);
}
