const PRODUCTION_FALLBACK_BACKEND_URL = 'https://golf-fox-creek-9yt1.vercel.app';

function normalizeBackendUrl(url: string): string {
  const trimmed = url.trim().replace(/\/$/, '');
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/**
 * Resolve the Hono backend base URL for API calls.
 */
export function getBackendUrl(): string {
  const configured =
    process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL ?? process.env.EXPO_PUBLIC_BACKEND_URL;

  if (typeof window !== 'undefined' && isLocalWebHost(window.location.hostname)) {
    if (
      process.env.EXPO_PUBLIC_USE_REMOTE_BACKEND === 'true' &&
      configured &&
      !isLocalhostBackendUrl(configured)
    ) {
      return normalizeBackendUrl(configured);
    }
    return 'http://localhost:3000';
  }

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

function isLocalWebHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

/**
 * True when the web app is served from a deployed host (not local dev).
 * Includes foxcreek.golf, Vercel previews, and LAN IPs used for device testing.
 */
export function isProductionWebHost(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  if (isLocalWebHost(host)) return false;
  return (
    host === 'foxcreek.golf' ||
    host === 'www.foxcreek.golf' ||
    host.endsWith('.foxcreek.golf') ||
    host.endsWith('.vercel.app') ||
    /^192\.168\.\d+\.\d+$/.test(host) ||
    /^10\.\d+\.\d+\.\d+$/.test(host)
  );
}

export function isLocalhostBackendUrl(url: string = getBackendUrl()): boolean {
  return /localhost|127\.0\.0\.1/.test(url);
}

/** True when the app can reach a real deployed backend (not dev localhost on prod web). */
export function isBackendReachableInBrowser(): boolean {
  if (!isProductionWebHost()) return true;
  return !isLocalhostBackendUrl();
}

/**
 * Tournament invite emails run on the same foxcreek.golf /api routes in production
 * (fast, fixed path). Other admin calls may still use the Hono backend URL.
 */
export function getInviteBackendUrl(): string {
  if (typeof window !== 'undefined' && isProductionWebHost()) {
    return window.location.origin;
  }
  return getBackendUrl();
}
