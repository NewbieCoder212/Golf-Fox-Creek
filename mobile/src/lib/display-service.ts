import type { TournamentDisplayPayload } from '@/types';

const BACKEND_URL =
  process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL ?? 'http://localhost:3000';

const WEB_APP_URL =
  process.env.EXPO_PUBLIC_WEB_APP_URL?.replace(/\/$/, '') ??
  (typeof window !== 'undefined' ? window.location.origin : 'https://www.foxcreek.golf');

export function buildTournamentTvDisplayUrl(tournamentId: string, displayToken: string): string {
  const params = new URLSearchParams({ token: displayToken });
  return `${WEB_APP_URL}/display/tournament/${tournamentId}?${params.toString()}`;
}

export function buildTournamentMobileUrl(tournamentId: string): string {
  return `${WEB_APP_URL}/tournaments/${tournamentId}`;
}

export async function fetchTournamentDisplay(
  tournamentId: string,
  token: string
): Promise<TournamentDisplayPayload> {
  const params = new URLSearchParams({ token });
  const response = await fetch(
    `${BACKEND_URL}/api/display/tournament/${tournamentId}?${params.toString()}`
  );

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Display request failed (${response.status})`);
  }

  return response.json() as Promise<TournamentDisplayPayload>;
}

export function buildQrCodeUrl(targetUrl: string, size = 180): string {
  return `https://quickchart.io/qr?size=${size}&margin=1&text=${encodeURIComponent(targetUrl)}`;
}
