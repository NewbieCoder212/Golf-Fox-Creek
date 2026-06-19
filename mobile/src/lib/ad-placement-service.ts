/**
 * Ad placement service — curated local sponsor banners from Supabase.
 */

import type { AdPlacement, AdDisplayPosition, AdPlacementType, AdImageLayout } from '@/types';

export type { AdPlacementType, AdImageLayout, AdDisplayPosition };
import {
  ensureManagerAccessToken,
  isAuthTokenExpiredError,
  refreshStoredAuthSession,
} from './admin-auth-bridge';

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
    if (parsed.code === 'PGRST301' || parsed.message?.includes('JWT')) {
      return parsed.message ?? 'Session expired';
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

  const sendRequest = async (token: string) =>
    fetch(url.toString(), {
      method,
      headers: {
        ...headers,
        Authorization: `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

  try {
    const activeToken = (await ensureManagerAccessToken(accessToken)) ?? accessToken;
    let response = await sendRequest(activeToken);

    if (!response.ok) {
      const errorText = await response.text();
      const errorMessage = parseAdPlacementError(response.status, errorText);

      if (isAuthTokenExpiredError(errorMessage)) {
        const freshToken = await refreshStoredAuthSession();
        if (freshToken) {
          response = await sendRequest(freshToken);
          if (response.ok) {
            if (method === 'DELETE') {
              return { data: null as T, error: null };
            }
            const data = (await response.json()) as T;
            return { data, error: null };
          }
          const retryErrorText = await response.text();
          console.log('[AdPlacement] Auth error after refresh', response.status, retryErrorText);
          return {
            data: null,
            error: 'Session expired. Log out and log back in, then try again.',
          };
        }
        return {
          data: null,
          error: 'Session expired. Log out and log back in, then try again.',
        };
      }

      console.log('[AdPlacement] Auth error', response.status, errorText);
      return { data: null, error: errorMessage };
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

  if (isHoleSponsorPlacement(placementType) && options?.holeNumber == null) {
    return [];
  }

  const query: Record<string, string> = {
    placement_type: `eq.${placementType}`,
    is_active: 'eq.true',
    order: 'created_at.desc',
    limit: String(options?.limit ?? 10),
  };

  if (isHoleSponsorPlacement(placementType) && options?.holeNumber != null) {
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
    hole_number: isHoleSponsorPlacement(payload.placement_type) ? payload.hole_number : null,
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
    body.hole_number = isHoleSponsorPlacement(payload.placement_type)
      ? payload.hole_number ?? null
      : null;
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
  scorecard_header: 'Scorecard Header (banner or square)',
  hole_sponsor: 'Match Hole Ad #1 (score entry)',
  hole_sponsor_secondary: 'Match Hole Ad #2 (score entry)',
  the_turn: 'The Turn (mid-round F&B)',
  leaderboard: 'Leaderboard / TV Display',
  member_hub: 'Member Hub (home screen)',
  tournament_detail: 'Event Header (all tabs)',
  tournament_tab_standings: 'Event · Standings tab',
  tournament_tab_schedule: 'Event · Schedule tab',
  tournament_tab_match: 'Event · Match tab',
  tournament_tab_teams: 'Event · Teams tab',
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

function scorecardHeaderPreviewConfig(imageLayout: AdImageLayout): AdPreviewConfig {
  if (isBannerLayout({ image_layout: imageLayout })) {
    return {
      screenLabel: 'Scorecard tab',
      locationHint: 'Compact strip at the top of the scorecard',
      variant: 'strip',
    };
  }

  return {
    screenLabel: 'Scorecard tab',
    locationHint: 'Square sponsor card at the top of the scorecard',
    variant: 'square',
  };
}

/** Scorecard header: banner → strip, square → centered square card; never mix layouts in one rotator. */
export function pickScorecardHeaderAds(ads: AdPlacement[]): {
  ads: AdPlacement[];
  variant: 'strip' | 'square';
} {
  const bannerAds = ads.filter(isBannerLayout);
  if (bannerAds.length > 0) {
    return { ads: bannerAds, variant: 'strip' };
  }

  const squareAds = ads.filter((ad) => getAdImageLayout(ad) === 'square');
  if (squareAds.length > 0) {
    return { ads: squareAds, variant: 'square' };
  }

  const cardAds = ads.filter((ad) => !isBannerLayout(ad));
  if (cardAds.length > 0) {
    return { ads: cardAds, variant: 'square' };
  }

  return { ads: [], variant: 'strip' };
}

/** Event header/tab ads: banner → strip, square/portrait → mini-card; never mix layouts in one rotator. */
export function pickTournamentEventHeaderAds(ads: AdPlacement[]): {
  ads: AdPlacement[];
  variant: 'strip' | 'mini-card';
} {
  const bannerAds = ads.filter(isBannerLayout);
  if (bannerAds.length > 0) {
    return { ads: bannerAds, variant: 'strip' };
  }

  const cardAds = ads.filter((ad) => !isBannerLayout(ad));
  if (cardAds.length > 0) {
    return { ads: cardAds, variant: 'mini-card' };
  }

  return { ads: [], variant: 'strip' };
}

export function isHoleSponsorPlacement(placementType: AdPlacementType | string): boolean {
  return placementType === 'hole_sponsor' || placementType === 'hole_sponsor_secondary';
}

export type TournamentEventTabKey = 'standings' | 'schedule' | 'match' | 'teams';

export const EVENT_TAB_PLACEMENTS: Record<TournamentEventTabKey, AdPlacementType> = {
  standings: 'tournament_tab_standings',
  schedule: 'tournament_tab_schedule',
  match: 'tournament_tab_match',
  teams: 'tournament_tab_teams',
};

export const EVENT_TAB_LABELS: Record<TournamentEventTabKey, string> = {
  standings: 'Standings',
  schedule: 'Schedule',
  match: 'Match',
  teams: 'Teams',
};

export const EVENT_TAB_KEYS: TournamentEventTabKey[] = ['standings', 'schedule', 'match', 'teams'];

export function eventTabKeyFromPlacement(
  placementType: AdPlacementType
): TournamentEventTabKey | null {
  const entry = Object.entries(EVENT_TAB_PLACEMENTS).find(([, type]) => type === placementType);
  return entry ? (entry[0] as TournamentEventTabKey) : null;
}

export function isEventTabPlacement(placementType: AdPlacementType | string): boolean {
  return (
    placementType === 'tournament_tab_standings' ||
    placementType === 'tournament_tab_schedule' ||
    placementType === 'tournament_tab_match' ||
    placementType === 'tournament_tab_teams'
  );
}

export function isTournamentTabPlacement(placementType: AdPlacementType | string): boolean {
  return isEventTabPlacement(placementType);
}

function tournamentEventPreviewConfig(
  placementType: AdPlacementType,
  imageLayout: AdImageLayout,
  tabLabel: string
): AdPreviewConfig {
  return isBannerLayout({ image_layout: imageLayout })
    ? {
        screenLabel: `Event · ${tabLabel}`,
        locationHint: `Compact sponsor strip at the top of the ${tabLabel} tab`,
        variant: 'strip',
      }
    : {
        screenLabel: `Event · ${tabLabel}`,
        locationHint: `Sponsor mini-card at the top of the ${tabLabel} tab`,
        variant: 'mini-card',
      };
}

export type AdPreviewVariant = 'default' | 'footer' | 'card' | 'strip' | 'mini-card' | 'square';

export type AdPreviewConfig = {
  screenLabel: string;
  locationHint: string;
  variant: AdPreviewVariant;
  compact?: boolean;
};

export function getAdPreviewConfig(
  placementType: AdPlacementType,
  imageLayout: AdImageLayout = 'banner',
  displayPosition: AdDisplayPosition | null = 'sidebar'
): AdPreviewConfig {
  if (placementType === 'member_hub') {
    return isBannerLayout({ image_layout: imageLayout })
      ? {
          screenLabel: 'Home tab',
          locationHint: 'Sticky banner at the bottom of the home screen (compact height)',
          variant: 'footer',
          compact: true,
        }
      : {
          screenLabel: 'Home tab',
          locationHint: 'Sponsored card in the home feed (scrolls with content)',
          variant: 'card',
        };
  }

  if (placementType === 'tournament_detail') {
    return tournamentEventPreviewConfig(placementType, imageLayout, 'all tabs (header)');
  }

  if (placementType === 'tournament_tab_standings') {
    return tournamentEventPreviewConfig(placementType, imageLayout, 'Standings');
  }

  if (placementType === 'tournament_tab_schedule') {
    return tournamentEventPreviewConfig(placementType, imageLayout, 'Schedule');
  }

  if (placementType === 'tournament_tab_match') {
    return tournamentEventPreviewConfig(placementType, imageLayout, 'Match');
  }

  if (placementType === 'tournament_tab_teams') {
    return tournamentEventPreviewConfig(placementType, imageLayout, 'Teams');
  }

  if (placementType === 'scorecard_header') {
    return scorecardHeaderPreviewConfig(imageLayout);
  }

  if (placementType === 'hole_sponsor' || placementType === 'hole_sponsor_secondary') {
    return {
      screenLabel: 'Score entry',
      locationHint:
        placementType === 'hole_sponsor_secondary'
          ? 'Second sponsor slot while entering scores — changes per hole (1–18)'
          : 'Primary sponsor slot while entering scores — changes per hole (1–18)',
      variant: 'default',
      compact: true,
    };
  }

  if (placementType === 'the_turn') {
    return {
      screenLabel: 'Scorecard tab',
      locationHint: 'Full banner on the mid-round “Turn” break screen',
      variant: 'default',
    };
  }

  const position = displayPosition ?? 'sidebar';
  if (position === 'footer') {
    return {
      screenLabel: 'Clubhouse TV',
      locationHint: 'Footer strip on the live leaderboard display',
      variant: 'default',
      compact: true,
    };
  }

  return {
    screenLabel: 'Clubhouse TV',
    locationHint:
      position === 'header_left'
        ? 'Header area on the live leaderboard display'
        : 'Sidebar carousel on the live leaderboard display',
    variant: 'default',
  };
}

export function draftToPreviewAd(
  form: AdPlacementInsert,
  id = 'preview-draft'
): AdPlacement {
  return {
    id,
    sponsor_name: form.sponsor_name.trim() || 'Sponsor Name',
    placement_type: form.placement_type,
    hole_number: form.hole_number ?? null,
    image_url: form.image_url.trim(),
    banner_text: form.banner_text.trim() || 'Your message to members appears here.',
    action_url: form.action_url?.trim() || null,
    display_position:
      form.placement_type === 'leaderboard' ? form.display_position ?? 'sidebar' : null,
    image_layout: form.image_layout ?? 'banner',
    is_active: true,
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  };
}

export type AdPlacementGuide = {
  summary: string;
  tips: string[];
  recommendedLayout: AdImageLayout;
  imageSizeHint: string;
};

export const AD_PLACEMENT_GUIDES: Record<AdPlacementType, AdPlacementGuide> = {
  member_hub: {
    summary: 'Home screen — highest daily visibility for all members.',
    tips: [
      'Banner = sticky banner pinned to the bottom of Home (compact height).',
      'Portrait or Square = “Sponsored” card in the home feed (best for flyers).',
      'Keep banner text short — members glance at this between tabs.',
    ],
    recommendedLayout: 'banner',
    imageSizeHint: 'Banner: wide logo ~800×200px. Portrait flyer: ~800×1100px.',
  },
  tournament_detail: {
    summary: 'Optional — one sponsor above the tabs on every event tab (Schedule, Match, Teams).',
    tips: [
      'Shows under the tournament name, before tab buttons.',
      'Use tab-specific placements instead if you want a different ad on Schedule vs Match vs Teams.',
      'Banner = strip; Portrait/Square = mini-card.',
    ],
    recommendedLayout: 'banner',
    imageSizeHint: 'Banner: ~800×200px. Portrait mini-card: ~800×1100px.',
  },
  tournament_tab_standings: {
    summary: 'Sponsor at the top of the Standings tab only.',
    tips: [
      'Members see this when viewing live team standings.',
      'Use a different ad than Schedule, Match, or Teams for tab-specific sponsors.',
      'Banner = strip; Portrait/Square = mini-card.',
    ],
    recommendedLayout: 'banner',
    imageSizeHint: 'Banner: ~800×200px. Portrait mini-card: ~800×1100px.',
  },
  tournament_tab_schedule: {
    summary: 'Sponsor at the top of the Schedule tab only.',
    tips: [
      'Members see this when viewing tee times and pairings.',
      'Use a different ad than Match or Teams for tab-specific sponsors.',
      'Banner = strip; Portrait/Square = mini-card.',
    ],
    recommendedLayout: 'banner',
    imageSizeHint: 'Banner: ~800×200px. Portrait mini-card: ~800×1100px.',
  },
  tournament_tab_match: {
    summary: 'Sponsor at the top of the Match tab only.',
    tips: [
      'Members see this on their personal match / pairing view.',
      'Good for match-day partners or format sponsors.',
      'Banner = strip; Portrait/Square = mini-card.',
    ],
    recommendedLayout: 'banner',
    imageSizeHint: 'Banner: ~800×200px. Portrait mini-card: ~800×1100px.',
  },
  tournament_tab_teams: {
    summary: 'Sponsor at the top of the Teams tab only.',
    tips: [
      'Members see this when viewing team rosters.',
      'Banner = strip; Portrait/Square = mini-card.',
    ],
    recommendedLayout: 'banner',
    imageSizeHint: 'Banner: ~800×200px. Portrait mini-card: ~800×1100px.',
  },
  scorecard_header: {
    summary: 'Top of the Scorecard tab while members are scoring.',
    tips: [
      'Banner = compact strip; Square = centered sponsor card (~320px).',
      'Only one layout type rotates at a time — do not mix Banner and Square ads.',
      'Square works well for logos and promos that do not fit a wide banner.',
    ],
    recommendedLayout: 'square',
    imageSizeHint: 'Banner: wide logo ~800×200px. Square: ~800×800px social-style graphic.',
  },
  hole_sponsor: {
    summary: 'Shown while entering match scores — one ad per hole (pick hole 1–18).',
    tips: [
      'Primary slot — appears directly in the hole-by-hole score entry panel.',
      'Changes automatically when members move to the next hole.',
      'Banner layout works best; portrait shows as a compact card.',
    ],
    recommendedLayout: 'banner',
    imageSizeHint: 'Wide banner ~800×200px.',
  },
  hole_sponsor_secondary: {
    summary: 'Second ad slot in the score entry panel — also one ad per hole.',
    tips: [
      'Stacks below Match Hole Ad #1 on the same hole.',
      'Use for a second sponsor on key holes (e.g. 1, 9, 18) or rotate partners.',
      'Leave inactive on holes with no second sponsor.',
    ],
    recommendedLayout: 'banner',
    imageSizeHint: 'Wide banner ~800×200px.',
  },
  the_turn: {
    summary: 'Mid-round break screen after hole 9.',
    tips: [
      'Full-width banner — great for restaurant, bar, or halfway house promos.',
      'Members see this during the built-in Turn countdown.',
    ],
    recommendedLayout: 'banner',
    imageSizeHint: 'Wide banner ~800×200px or ~1200×400px.',
  },
  leaderboard: {
    summary: 'Clubhouse TV live leaderboard (not the mobile app home).',
    tips: [
      'Pick TV position: sidebar carousel, header, or footer strip.',
      'Use Banner layout for logos; test on a TV before event day.',
    ],
    recommendedLayout: 'banner',
    imageSizeHint: 'Wide banner ~1200×300px for TV readability.',
  },
};

export type AdLayoutRecommendation = {
  ok: boolean;
  message: string;
  suggestLayout?: AdImageLayout;
};

export function getAdLayoutRecommendation(
  placementType: AdPlacementType,
  imageLayout: AdImageLayout = 'banner'
): AdLayoutRecommendation {
  const guide = AD_PLACEMENT_GUIDES[placementType];

  if (isHoleSponsorPlacement(placementType) && imageLayout !== 'banner') {
    return {
      ok: false,
      message:
        'This placement uses a compact strip or banner. Portrait flyers will look small — use Banner layout, or choose Member Hub / Event for flyers.',
      suggestLayout: 'banner',
    };
  }

  if (placementType === 'scorecard_header' && imageLayout === 'portrait') {
    return {
      ok: false,
      message:
        'Portrait flyers are cramped in the scorecard header — use Square or Banner layout instead.',
      suggestLayout: 'square',
    };
  }

  if (placementType === 'the_turn' && imageLayout !== 'banner') {
    return {
      ok: false,
      message: 'The Turn uses a full-width banner. Portrait/Square will still show as a card — Banner is recommended.',
      suggestLayout: 'banner',
    };
  }

  if (imageLayout === guide.recommendedLayout) {
    return {
      ok: true,
      message: `Good match — ${IMAGE_LAYOUT_LABELS[imageLayout]} is ideal for this placement.`,
    };
  }

  return {
    ok: true,
    message: `Tip: ${IMAGE_LAYOUT_LABELS[guide.recommendedLayout]} is the usual choice here. ${IMAGE_LAYOUT_LABELS[imageLayout]} can still work — check the preview.`,
  };
}

export type MemberPreviewScreen =
  | 'selected'
  | 'member_hub'
  | 'tournament_detail'
  | 'tournament_tab_standings'
  | 'tournament_tab_schedule'
  | 'tournament_tab_match'
  | 'tournament_tab_teams'
  | 'scorecard_header'
  | 'hole_sponsor'
  | 'the_turn';

export const MEMBER_PREVIEW_SCREENS: { id: MemberPreviewScreen; label: string }[] = [
  { id: 'selected', label: 'Your pick' },
  { id: 'member_hub', label: 'Home' },
  { id: 'tournament_detail', label: 'Event header' },
  { id: 'tournament_tab_standings', label: 'Standings' },
  { id: 'tournament_tab_schedule', label: 'Schedule' },
  { id: 'tournament_tab_match', label: 'Match' },
  { id: 'tournament_tab_teams', label: 'Teams' },
  { id: 'scorecard_header', label: 'Scorecard' },
  { id: 'hole_sponsor', label: 'Hole' },
  { id: 'the_turn', label: 'Turn' },
];

export function resolvePreviewPlacement(
  screen: MemberPreviewScreen,
  formPlacement: AdPlacementType
): AdPlacementType {
  return screen === 'selected' ? formPlacement : screen;
}

const VARIANT_MIN_HEIGHT: Record<AdPreviewVariant, number> = {
  strip: 96,
  'mini-card': 340,
  square: 360,
  footer: 176,
  card: 400,
  default: 160,
};

const COMPACT_FOOTER_MIN_HEIGHT = 118;

export function resolveAdDisplayVariant(
  placementType: AdPlacementType,
  ad: Pick<AdPlacement, 'image_layout'>,
  displayPosition: AdDisplayPosition | null = 'sidebar'
): Pick<AdPreviewConfig, 'variant' | 'compact'> {
  const config = getAdPreviewConfig(placementType, getAdImageLayout(ad), displayPosition);
  return { variant: config.variant, compact: config.compact };
}

export function getRotationMinHeight(
  placementType: AdPlacementType,
  ads: Pick<AdPlacement, 'image_layout'>[],
  displayPosition: AdDisplayPosition | null = 'sidebar'
): number {
  if (ads.length === 0) return 0;

  return Math.max(
    ...ads.map((ad) => {
      const { variant, compact } = resolveAdDisplayVariant(placementType, ad, displayPosition);
      if (variant === 'card') {
        const layout = getAdImageLayout(ad);
        if (layout === 'square') return 300;
        if (layout === 'portrait') return 440;
      }
      const base = VARIANT_MIN_HEIGHT[variant] ?? 160;
      if (variant === 'footer' && compact) return COMPACT_FOOTER_MIN_HEIGHT;
      return compact && variant === 'default' ? 120 : base;
    })
  );
}

/** Member Hub uses two display streams — banners footer vs portrait/square feed cards. */
export function usesSplitMemberHubRotation(placementType: AdPlacementType): boolean {
  return placementType === 'member_hub';
}
