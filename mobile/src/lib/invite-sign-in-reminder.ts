import AsyncStorage from '@react-native-async-storage/async-storage';

const INVITE_SIGN_IN_REMINDER_KEY = 'fox-creek-invite-sign-in-reminder-v1';

export async function hasSeenInviteSignInReminder(): Promise<boolean> {
  try {
    const seen = await AsyncStorage.getItem(INVITE_SIGN_IN_REMINDER_KEY);
    return seen === '1';
  } catch {
    return false;
  }
}

export async function markInviteSignInReminderSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(INVITE_SIGN_IN_REMINDER_KEY, '1');
  } catch {
    // Non-fatal — reminder may show again on next invite completion.
  }
}

export const INVITE_SIGN_IN_REMINDER_COPY = {
  title: 'Use Member Sign In next time',
  body:
    'Your password is set. When you come back later, open foxcreek.golf and tap Member Sign In with your email and password. The invite email link is only for setup — it will not keep you signed in.',
  confirmLabel: 'Got it',
};
