/**
 * Resolve the Hono backend base URL for API calls.
 * In production web builds, localhost must not be used — callers should fall back to Supabase.
 */
export function getBackendUrl(): string {
  const configured =
    process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL ?? process.env.EXPO_PUBLIC_BACKEND_URL;
  if (configured) return configured.replace(/\/$/, '');
  return 'http://localhost:3000';
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
