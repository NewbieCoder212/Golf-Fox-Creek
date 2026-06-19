import { Platform } from 'react-native';

const A2HS_DISMISS_STORAGE_KEY = '@foxcreek_a2hs_dismissed';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function isWebPlatform(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined';
}

/** True when the app is already opened from a home-screen icon. */
export function isStandalonePwa(): boolean {
  if (!isWebPlatform()) return true;

  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    nav.standalone === true
  );
}

export function isMobileWebBrowser(): boolean {
  if (!isWebPlatform()) return false;
  return /iPhone|iPad|iPod|Android/i.test(window.navigator.userAgent);
}

export function isIosWeb(): boolean {
  if (!isWebPlatform()) return false;
  return /iPhone|iPad|iPod/i.test(window.navigator.userAgent);
}

export function isAndroidWeb(): boolean {
  if (!isWebPlatform()) return false;
  return /Android/i.test(window.navigator.userAgent);
}

export function shouldOfferAddToHomeScreen(): boolean {
  return isWebPlatform() && isMobileWebBrowser() && !isStandalonePwa();
}

export function getA2hsDismissStorageKey(): string {
  return A2HS_DISMISS_STORAGE_KEY;
}
