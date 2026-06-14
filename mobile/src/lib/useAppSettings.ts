/**
 * useAppSettings Hook
 *
 * Provides access to app-wide settings with admin toggle controls.
 * Used in manager/admin dashboards to enable/disable features.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { GeofenceSettings } from '@/types';
import {
  getDefaultGeofenceSettings,
  getGeofenceSettings,
  isSupabaseConfigured,
  updateGeofenceSettings,
} from './supabase';

// ============================================
// TYPES
// ============================================

interface UseAppSettingsResult {
  // Settings state
  settings: GeofenceSettings;
  isLoading: boolean;
  isError: boolean;

  // Supabase status
  isConfigured: boolean;

  // Mutations
  updateSettings: (newSettings: Partial<GeofenceSettings>) => Promise<void>;
  isUpdating: boolean;

  // Convenience toggles
  toggleGeofencing: () => Promise<void>;
  toggleCheckIn: () => Promise<void>;
  toggleTeeTimeAlerts: () => Promise<void>;
  toggleTurnPrompt: () => Promise<void>;

  // Refresh
  refresh: () => void;
}

// ============================================
// HOOK IMPLEMENTATION
// ============================================

export function useAppSettings(): UseAppSettingsResult {
  const queryClient = useQueryClient();

  // Check if Supabase is configured
  const isConfigured = isSupabaseConfigured();

  // Fetch settings
  const {
    data: settings = getDefaultGeofenceSettings(),
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['geofenceSettings'],
    queryFn: getGeofenceSettings,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (newSettings: Partial<GeofenceSettings>) => {
      const success = await updateGeofenceSettings(newSettings);
      if (!success) {
        throw new Error('Failed to update settings');
      }
      return newSettings;
    },
    onMutate: async (newSettings) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['geofenceSettings'] });

      // Snapshot current value
      const previousSettings = queryClient.getQueryData<GeofenceSettings>(['geofenceSettings']);

      // Optimistically update
      queryClient.setQueryData<GeofenceSettings>(['geofenceSettings'], (old) => ({
        ...getDefaultGeofenceSettings(),
        ...old,
        ...newSettings,
      }));

      return { previousSettings };
    },
    onError: (_err, _newSettings, context) => {
      // Rollback on error
      if (context?.previousSettings) {
        queryClient.setQueryData(['geofenceSettings'], context.previousSettings);
      }
    },
    onSettled: () => {
      // Refetch to ensure sync
      queryClient.invalidateQueries({ queryKey: ['geofenceSettings'] });
    },
  });

  // Update settings
  const updateSettings = async (newSettings: Partial<GeofenceSettings>): Promise<void> => {
    await updateMutation.mutateAsync(newSettings);
  };

  // Convenience toggles
  const toggleGeofencing = async (): Promise<void> => {
    await updateSettings({ enabled: !settings.enabled });
  };

  const toggleCheckIn = async (): Promise<void> => {
    await updateSettings({ check_in_enabled: !settings.check_in_enabled });
  };

  const toggleTeeTimeAlerts = async (): Promise<void> => {
    await updateSettings({ tee_time_alerts: !settings.tee_time_alerts });
  };

  const toggleTurnPrompt = async (): Promise<void> => {
    await updateSettings({ turn_prompt_enabled: !settings.turn_prompt_enabled });
  };

  return {
    settings,
    isLoading,
    isError,
    isConfigured,
    updateSettings,
    isUpdating: updateMutation.isPending,
    toggleGeofencing,
    toggleCheckIn,
    toggleTeeTimeAlerts,
    toggleTurnPrompt,
    refresh: refetch,
  };
}
