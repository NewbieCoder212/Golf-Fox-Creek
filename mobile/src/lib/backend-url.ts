const PRODUCTION_FALLBACK_BACKEND_URL = 'https://golf-fox-creek-9yt1.vercel.app';

function normalizeBackendUrl(url: string): string {
  const trimmed = url.trim().replace(/\/$/, '');
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/**
 * Resolve the Hono backend base URL for API calls.
 * In production web builds, localhost must not be used — callers should fall back to Supabase.
 */
export function getBackendUrl(): string {
  const configured =
    process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL ?? process.env.EXPO_PUBLIC_BACKEND_URL;

  if (isProductionWebHost()) {
    if (configured && /^https:\/\//i.test(configured) && !isLocalhostBackendUrl(configured)) {
      return normalizeBackendUrl(configured);
    }
    return PRODUCTION_FALLBACK_BACKEND_URL;
  }

  if (configured && !isLocalhostBackendUrl(configured)) {
    return normalizeBackendUrl(configured);
  }

  return normalizeBackendUrl(configured ?? 'http://localhost:3000');
}

export function isProductionWebHost(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'foxcreek.golf' || host === 'www.foxcreek.golf' || host.endsWith('.foxcreek.golf');
}

export function isLocalhostBackendUrl(url: string = getBackendUrl()): boolean {
  return /localhost|127\.0\.0\.1/.test(url);
}

/** True when the app can reach a real deployed backend (not dev localhost on prod web). */
export function isBackendReachableInBrowser(): boolean {
  if (!isProductionWebHost()) return true;
  return !isLocalhostBackendUrl();
}
