/**
 * Ad placement service — curated local sponsor banners from Supabase.
 */

import type { AdPlacement, AdDisplayPosition, AdPlacementType, AdImageLayout } from '@/types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isAdPlacementServiceConfigured = () =>
  Boolean(supabaseUrl && supabaseAnonKey);

function parseAdPlacementError(status: number, errorText: string): string {
  try {
    const parsed = JSON.parse(errorText) as { message?: string; code?: string };
    if (
      parsed.code === '42501' ||
      parsed.message?.includes('row-level security')
    ) {
      return 'Database permissions blocked this action. Run supabase/migrations/20260624000000_ad_placements_rls_fix.sql in the Supabase SQL editor, then try again.';
    }
    return parsed.message ?? `Request failed (${status})`;
  } catch {
    return errorText || `Request failed (${status})`;
  }
}

export type AdPlacementInsert = {
  sponsor_name: string;
  placement_type: AdPlacementType;
  hole_number?: number | null;
  image_url: string;
  banner_text: string;
  action_url?: string | null;
  display_position?: AdDisplayPosition | null;
  image_layout?: AdImageLayout;
  is_active?: boolean;
};

export type AdPlacementUpdate = Partial<AdPlacementInsert>;

type AdPlacementResult<T> = { data: T; error: null } | { data: null; error: string };

function normalizeActionUrl(url: string | null | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

async function publicRequest<T>(
  query: Record<string, string>,
  method: 'GET' = 'GET'
): Promise<T | null> {
  if (!isAdPlacementServiceConfigured()) return null;

  const url = new URL(`${supabaseUrl}/rest/v1/ad_placements`);
  Object.entries(query).forEach(([key, value]) => url.searchParams.append(key, value));

  try {
    const response = await fetch(url.toString(), {
      method,
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      console.log('[AdPlacement] Error', response.status, await response.text());
      return null;
    }

    return (await response.json()) as T;
  } catch (err) {
    console.log('[AdPlacement] Request failed:', err);
    return null;
  }
}

async function authRequest<T>(
  accessToken: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    query?: Record<string, string>;
    body?: Record<string, unknown>;
    single?: boolean;
  } = {}
): Promise<AdPlacementResult<T>> {
  if (!isAdPlacementServiceConfigured()) {
    return { data: null, error: 'Supabase is not configured' };
  }

  const { method = 'GET', query = {}, body, single = false } = options;
  const url = new URL(`${supabaseUrl}/rest/v1/ad_placements`);
  Object.entries(query).forEach(([key, value]) => url.searchParams.append(key, value));

  const headers: Record<string, string> = {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };

  if (single) {
    headers['Accept'] = 'application/vnd.pgrst.object+json';
  }

  try {
    const response = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log('[AdPlacement] Auth error', response.status, errorText);
      return { data: null, error: parseAdPlacementError(response.status, errorText) };
    }

    if (method === 'DELETE') {
      return { data: null as T, error: null };
    }

    const data = (await response.json()) as T;
    return { data, error: null };
  } catch (err) {
    console.log('[AdPlacement] Auth request failed:', err);
    return { data: null, error: 'Network error' };
  }
}

export async function getActiveAdPlacements(
  placementType: AdPlacementType | string,
  options?: { holeNumber?: number; displayPosition?: AdDisplayPosition; limit?: number }
): Promise<AdPlacement[]> {
  if (!isAdPlacementServiceConfigured()) {
    return [];
  }

  if (placementType === 'hole_sponsor' && options?.holeNumber == null) {
    return [];
  }

  const query: Record<string, string> = {
    placement_type: `eq.${placementType}`,
    is_active: 'eq.true',
    order: 'created_at.desc',
    limit: String(options?.limit ?? 10),
  };

  if (placementType === 'hole_sponsor' && options?.holeNumber != null) {
    query.hole_number = `eq.${options.holeNumber}`;
  }

  if (options?.displayPosition) {
    query.display_position = `eq.${options.displayPosition}`;
  }

  const data = await publicRequest<AdPlacement[]>(query);
  return data ?? [];
}

export async function getActiveAdPlacement(
  placementType: AdPlacementType | string,
  holeNumber?: number
): Promise<AdPlacement | null> {
  const rows = await getActiveAdPlacements(placementType, { holeNumber, limit: 1 });
  return rows[0] ?? null;
}

export async function getAllAdPlacements(): Promise<AdPlacement[]> {
  const data = await publicRequest<AdPlacement[]>({
    order: 'created_at.desc',
    limit: '100',
  });
  return data ?? [];
}

export async function createAdPlacementAuth(
  accessToken: string,
  payload: AdPlacementInsert
): Promise<AdPlacementResult<AdPlacement[]>> {
  const body: Record<string, unknown> = {
    sponsor_name: payload.sponsor_name.trim(),
    placement_type: payload.placement_type,
    image_url: payload.image_url.trim(),
    banner_text: payload.banner_text.trim(),
    is_active: payload.is_active ?? true,
    hole_number:
      payload.placement_type === 'hole_sponsor' ? payload.hole_number : null,
    action_url: normalizeActionUrl(payload.action_url),
    display_position:
      payload.placement_type === 'leaderboard' ? payload.display_position ?? 'sidebar' : null,
    image_layout: payload.image_layout ?? 'banner',
  };

  return authRequest<AdPlacement[]>(accessToken, {
    method: 'POST',
    body,
  });
}

export async function updateAdPlacementAuth(
  accessToken: string,
  id: string,
  payload: AdPlacementUpdate
): Promise<AdPlacementResult<AdPlacement[]>> {
  const body: Record<string, unknown> = {};

  if (payload.sponsor_name !== undefined) body.sponsor_name = payload.sponsor_name.trim();
  if (payload.placement_type !== undefined) body.placement_type = payload.placement_type;
  if (payload.image_url !== undefined) body.image_url = payload.image_url.trim();
  if (payload.banner_text !== undefined) body.banner_text = payload.banner_text.trim();
  if (payload.action_url !== undefined) body.action_url = normalizeActionUrl(payload.action_url);
  if (payload.is_active !== undefined) body.is_active = payload.is_active;
  if (payload.image_layout !== undefined) body.image_layout = payload.image_layout;

  if (payload.placement_type !== undefined) {
    body.placement_type = payload.placement_type;
    body.hole_number =
      payload.placement_type === 'hole_sponsor' ? payload.hole_number ?? null : null;
    body.display_position =
      payload.placement_type === 'leaderboard' ? payload.display_position ?? null : null;
  } else if (payload.hole_number !== undefined) {
    body.hole_number = payload.hole_number;
  }

  if (payload.display_position !== undefined && payload.placement_type === undefined) {
    body.display_position = payload.display_position;
  }

  return authRequest<AdPlacement[]>(accessToken, {
    method: 'PATCH',
    query: { id: `eq.${id}` },
    body,
  });
}

export async function deleteAdPlacementAuth(
  accessToken: string,
  id: string
): Promise<AdPlacementResult<null>> {
  return authRequest<null>(accessToken, {
    method: 'DELETE',
    query: { id: `eq.${id}` },
  });
}

export const PLACEMENT_TYPE_LABELS: Record<AdPlacementType, string> = {
  scorecard_header: 'Tournament Scorecard Header',
  hole_sponsor: 'Hole Sponsor (casual scorecard)',
  the_turn: 'The Turn (mid-round F&B)',
  leaderboard: 'Leaderboard / TV Display',
  member_hub: 'Member Hub (home screen)',
};

export const DISPLAY_POSITION_LABELS: Record<AdDisplayPosition, string> = {
  header_left: 'Header (left)',
  sidebar: 'Sidebar / carousel',
  footer: 'Footer strip',
};

export const IMAGE_LAYOUT_LABELS: Record<AdImageLayout, string> = {
  banner: 'Banner (wide)',
  portrait: 'Portrait (flyer)',
  square: 'Square',
};

export function getAdImageLayout(ad: Pick<AdPlacement, 'image_layout'>): AdImageLayout {
  return ad.image_layout ?? 'banner';
}

export function isBannerLayout(ad: Pick<AdPlacement, 'image_layout'>): boolean {
  return getAdImageLayout(ad) === 'banner';
}
