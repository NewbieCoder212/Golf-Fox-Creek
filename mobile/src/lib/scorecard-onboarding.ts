const SCORECARD_ONBOARDING_STORAGE_KEY = '@foxcreek_scorecard_onboarding_seen';

export function getScorecardOnboardingStorageKey(userId: string | null | undefined): string {
  if (userId) {
    return `${SCORECARD_ONBOARDING_STORAGE_KEY}:${userId}`;
  }
  return SCORECARD_ONBOARDING_STORAGE_KEY;
}
