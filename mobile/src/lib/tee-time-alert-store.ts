import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@foxcreek_tee_time_alert';

// Practice Range coordinates - Fox Creek Golf Club
const PRACTICE_RANGE = {
  lat: 46.0691,
  lng: -64.7319,
  radius: 50, // meters - detection radius for being "at the range"
};

interface TeeTimeAlertState {
  teeTime: Date | null;
  isAtRange: boolean;
  hasAlerted: boolean;
  isAlertVisible: boolean;

  // Actions
  setTeeTime: (time: Date | null) => void;
  setIsAtRange: (atRange: boolean) => void;
  triggerAlert: () => void;
  dismissAlert: () => void;
  clearTeeTime: () => void;
  loadSavedTeeTime: () => Promise<void>;
  getMinutesUntilTeeTime: () => number | null;
  shouldTriggerAlert: () => boolean;
}

export const PRACTICE_RANGE_COORDS = PRACTICE_RANGE;

export const useTeeTimeAlertStore = create<TeeTimeAlertState>((set, get) => ({
  teeTime: null,
  isAtRange: false,
  hasAlerted: false,
  isAlertVisible: false,

  setTeeTime: async (time) => {
    set({ teeTime: time, hasAlerted: false });
    if (time) {
      await AsyncStorage.setItem(STORAGE_KEY, time.toISOString());
    } else {
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
  },

  setIsAtRange: (atRange) => {
    set({ isAtRange: atRange });
  },

  triggerAlert: () => {
    set({ hasAlerted: true, isAlertVisible: true });
  },

  dismissAlert: () => {
    set({ isAlertVisible: false });
  },

  clearTeeTime: async () => {
    set({ teeTime: null, hasAlerted: false, isAlertVisible: false });
    await AsyncStorage.removeItem(STORAGE_KEY);
  },

  loadSavedTeeTime: async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        const savedDate = new Date(saved);
        // Only restore if tee time is still in the future
        if (savedDate > new Date()) {
          set({ teeTime: savedDate, hasAlerted: false });
        } else {
          // Clear expired tee time
          await AsyncStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch (error) {
      console.log('Error loading saved tee time:', error);
    }
  },

  getMinutesUntilTeeTime: () => {
    const { teeTime } = get();
    if (!teeTime) return null;

    const now = new Date();
    const diff = teeTime.getTime() - now.getTime();
    return Math.floor(diff / (1000 * 60));
  },

  shouldTriggerAlert: () => {
    const { teeTime, isAtRange, hasAlerted } = get();
    if (!teeTime || !isAtRange || hasAlerted) return false;

    const minutesUntil = get().getMinutesUntilTeeTime();
    if (minutesUntil === null) return false;

    // Trigger alert when 10 minutes or less until tee time
    return minutesUntil <= 10 && minutesUntil > 0;
  },
}));
