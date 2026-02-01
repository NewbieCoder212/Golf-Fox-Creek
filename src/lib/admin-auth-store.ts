import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UserProfile, UserRole } from '@/types';

const AUTH_STORAGE_KEY = '@foxcreek_admin_auth';

interface AdminAuthState {
  isAuthenticated: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  user: { id: string; email: string } | null;
  profile: UserProfile | null;
  isLoading: boolean;

  // Actions
  setAuth: (data: {
    accessToken: string;
    refreshToken: string;
    user: { id: string; email: string };
    profile: UserProfile;
  }) => Promise<void>;
  clearAuth: () => Promise<void>;
  loadStoredAuth: () => Promise<boolean>;
  isManager: () => boolean;
  isSuperAdmin: () => boolean;
  canAccessAdmin: () => boolean;
}

export const useAdminAuthStore = create<AdminAuthState>((set, get) => ({
  isAuthenticated: false,
  accessToken: null,
  refreshToken: null,
  user: null,
  profile: null,
  isLoading: false,

  setAuth: async (data) => {
    set({
      isAuthenticated: true,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: data.user,
      profile: data.profile,
    });

    // Persist to storage
    try {
      await AsyncStorage.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          user: data.user,
          profile: data.profile,
        })
      );
    } catch (err) {
      console.log('[AdminAuth] Failed to persist auth:', err);
    }
  },

  clearAuth: async () => {
    set({
      isAuthenticated: false,
      accessToken: null,
      refreshToken: null,
      user: null,
      profile: null,
    });

    try {
      await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
    } catch (err) {
      console.log('[AdminAuth] Failed to clear auth:', err);
    }
  },

  loadStoredAuth: async () => {
    set({ isLoading: true });

    try {
      const stored = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
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
      console.log('[AdminAuth] Failed to load stored auth:', err);
    }

    set({ isLoading: false });
    return false;
  },

  isManager: () => {
    const { profile } = get();
    return profile?.role === 'manager' || profile?.role === 'super_admin';
  },

  isSuperAdmin: () => {
    const { profile } = get();
    return profile?.role === 'super_admin';
  },

  canAccessAdmin: () => {
    const { profile } = get();
    return profile?.role === 'manager' || profile?.role === 'super_admin';
  },
}));
