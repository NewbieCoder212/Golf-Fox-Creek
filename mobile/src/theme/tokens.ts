export const foxColors = {
  background: '#0a0a0a',
  surface: '#121212',
  surfaceElevated: '#1a1a1a',
  border: '#262626',
  borderAccent: 'rgba(163,230,53,0.35)',
  lime: '#a3e635',
  limeMuted: '#3f6212',
  gold: '#facc15',
  danger: '#ef4444',
} as const;

export const foxRadii = {
  card: 16,
  pill: 999,
} as const;

export type GreetingKey = 'goodMorning' | 'goodAfternoon' | 'goodEvening';

export function getGreetingKey(date = new Date()): GreetingKey {
  const hour = date.getHours();
  if (hour < 12) return 'goodMorning';
  if (hour < 17) return 'goodAfternoon';
  return 'goodEvening';
}

export function getFirstName(fullName: string | null | undefined): string | null {
  if (!fullName?.trim()) return null;
  return fullName.trim().split(/\s+/)[0] ?? null;
}
