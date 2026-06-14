import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UserProfile } from '@/types';

const MEMBER_AUTH_STORAGE_KEY = '@foxcreek_member_auth';

interface MemberAuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  user: { id: string; email: string } | null;
  profile: UserProfile | null;

  // Actions
  setAuth: (data: {
    accessToken: string;
    refreshToken: string;
    user: { id: string; email: string };
    profile: UserProfile;
  }) => Promise<void>;
  clearAuth: () => Promise<void>;
  loadStoredAuth: () => Promise<boolean>;
  setLoading: (loading: boolean) => void;
}

export const useMemberAuthStore = create<MemberAuthState>((set, get) => ({
  isAuthenticated: false,
  isLoading: true, // Start as loading to check stored auth
  accessToken: null,
  refreshToken: null,
  user: null,
  profile: null,

  setAuth: async (data) => {
    set({
      isAuthenticated: true,
      isLoading: false,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: data.user,
      profile: data.profile,
    });

    // Persist to storage
    try {
      await AsyncStorage.setItem(
        MEMBER_AUTH_STORAGE_KEY,
        JSON.stringify({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          user: data.user,
          profile: data.profile,
        })
      );
    } catch (err) {
      console.log('[MemberAuth] Failed to persist auth:', err);
    }
  },

  clearAuth: async () => {
    set({
      isAuthenticated: false,
      isLoading: false,
      accessToken: null,
      refreshToken: null,
      user: null,
      profile: null,
    });

    try {
      await AsyncStorage.removeItem(MEMBER_AUTH_STORAGE_KEY);
    } catch (err) {
      console.log('[MemberAuth] Failed to clear auth:', err);
    }
  },

  loadStoredAuth: async () => {
    set({ isLoading: true });

    try {
      const stored = await AsyncStorage.getItem(MEMBER_AUTH_STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        set({
          isAuthenticated: true,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          user: data.user,
          profile: data.profile,
          isLoading: false,
        });
        return true;
      }
    } catch (err) {
      console.log('[MemberAuth] Failed to load stored auth:', err);
    }

    set({ isLoading: false });
    return false;
  },

  setLoading: (loading) => {
    set({ isLoading: loading });
  },
}));
