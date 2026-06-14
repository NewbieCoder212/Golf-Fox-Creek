/**
 * useGeofencing Hook
 *
 * Manages location tracking and geofence detection for Fox Creek Golf Club.
 * Respects admin toggle settings from Supabase.
 *
 * Battery-efficient approach:
 * - Uses balanced accuracy by default
 * - Increases to high accuracy when on course
 * - Only tracks when feature is enabled
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { useQuery } from '@tanstack/react-query';

import type { GeofenceSettings, GeofenceTrigger, GeofenceZone } from '@/types';
import { checkGeofence, getDistanceToGreen } from './geo';
import {
  getDefaultGeofenceSettings,
  getGeofenceSettings,
  getGeofenceZones,
  isSupabaseConfigured,
} from './supabase';
import { useScorecardStore } from './scorecard-store';
import { useTeeTimeAlertStore } from './tee-time-alert-store';

// ============================================
// TYPES
// ============================================

interface LocationState {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
}

interface UseGeofencingResult {
  // Location state
  location: LocationState | null;
  isTracking: boolean;
  permissionStatus: Location.PermissionStatus | null;

  // Geofence state
  currentTrigger: GeofenceTrigger;
  distanceToGreen: number | null;

  // Settings
  settings: GeofenceSettings;
  isSettingsLoading: boolean;

  // Actions
  requestPermission: () => Promise<boolean>;
  startTracking: () => Promise<void>;
  stopTracking: () => void;
  refreshSettings: () => void;
}

// ============================================
// NOTIFICATION SETUP
// ============================================

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function sendTeeTimeNotification(minutesUntil: number): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Tee Time Reminder',
        body: `Your tee time is in ${minutesUntil} minute${minutesUntil === 1 ? '' : 's'}! Head to the first tee.`,
        sound: true,
      },
      trigger: null, // Immediate
    });
  } catch (error) {
    console.log('[Geofencing] Failed to send notification:', error);
  }
}

// ============================================
// HOOK IMPLEMENTATION
// ============================================

export function useGeofencing(): UseGeofencingResult {
  // State
  const [location, setLocation] = useState<LocationState | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus | null>(null);
  const [currentTrigger, setCurrentTrigger] = useState<GeofenceTrigger>({ type: 'none' });

  // Refs
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const hasTriggeredTeeAlert = useRef(false);
  const hasTriggeredFnbPrompt = useRef(false);

  // Scorecard store
  const isCheckedIn = useScorecardStore((s) => s.isCheckedIn);
  const currentHole = useScorecardStore((s) => s.currentHole);
  const isRoundInProgress = useScorecardStore((s) => s.isTracking);
  const setCheckedIn = useScorecardStore((s) => s.setCheckedIn);
  const setShowFnbPrompt = useScorecardStore((s) => s.setShowFnbPrompt);
  const autoStartRound = useScorecardStore((s) => s.autoStartRound);

  // Tee time store
  const teeTime = useTeeTimeAlertStore((s) => s.teeTime);
  const triggerTeeAlert = useTeeTimeAlertStore((s) => s.triggerAlert);

  // Fetch settings from Supabase
  const {
    data: settings = getDefaultGeofenceSettings(),
    isLoading: isSettingsLoading,
    refetch: refreshSettings,
  } = useQuery({
    queryKey: ['geofenceSettings'],
    queryFn: getGeofenceSettings,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: true,
  });

  // Fetch geofence zones from Supabase
  const { data: zones = [] } = useQuery({
    queryKey: ['geofenceZones'],
    queryFn: getGeofenceZones,
    staleTime: 1000 * 60 * 10, // 10 minutes
    enabled: isSupabaseConfigured(),
  });

  // Calculate distance to current green
  const distanceToGreen =
    location && currentHole
      ? getDistanceToGreen(location.latitude, location.longitude, currentHole)
      : null;

  // Request location permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermissionStatus(status);

      if (status === Location.PermissionStatus.GRANTED) {
        // Also request notification permission for tee time alerts
        await Notifications.requestPermissionsAsync();
        return true;
      }

      return false;
    } catch (error) {
      console.log('[Geofencing] Permission request failed:', error);
      return false;
    }
  }, []);

  // Process location update
  const processLocation = useCallback(
    (coords: Location.LocationObjectCoords) => {
      const newLocation: LocationState = {
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        timestamp: Date.now(),
      };
      setLocation(newLocation);

      // Check geofences
      const trigger = checkGeofence({
        userLat: coords.latitude,
        userLng: coords.longitude,
        teeTime,
        isCheckedIn,
        isRoundInProgress,
        currentHole,
        hasShownFnbPrompt: hasTriggeredFnbPrompt.current,
        zones,
        settings,
      });

      setCurrentTrigger(trigger);

      // Handle triggers
      switch (trigger.type) {
        case 'check_in':
          if (!isCheckedIn) {
            setCheckedIn(true);
            console.log('[Geofencing] Auto check-in triggered at clubhouse');
          }
          break;

        case 'auto_start':
          if (!isRoundInProgress) {
            autoStartRound();
            console.log('[Geofencing] Auto-start round triggered at Hole 1 Tee');
          }
          break;

        case 'tee_alert':
          if (!hasTriggeredTeeAlert.current) {
            hasTriggeredTeeAlert.current = true;
            triggerTeeAlert();
            sendTeeTimeNotification(trigger.minutesUntilTeeTime);
            console.log('[Geofencing] Tee time alert triggered');
          }
          break;

        case 'fnb_prompt':
          if (!hasTriggeredFnbPrompt.current) {
            hasTriggeredFnbPrompt.current = true;
            setShowFnbPrompt(true);
            console.log('[Geofencing] F&B prompt triggered at The Turn');
          }
          break;
      }
    },
    [
      teeTime,
      isCheckedIn,
      isRoundInProgress,
      currentHole,
      zones,
      settings,
      setCheckedIn,
      setShowFnbPrompt,
      autoStartRound,
      triggerTeeAlert,
    ]
  );

  // Start location tracking
  const startTracking = useCallback(async (): Promise<void> => {
    // Check if feature is enabled
    if (!settings.enabled) {
      console.log('[Geofencing] Feature disabled by admin');
      return;
    }

    // Check permission
    if (permissionStatus !== Location.PermissionStatus.GRANTED) {
      const granted = await requestPermission();
      if (!granted) {
        console.log('[Geofencing] Permission not granted');
        return;
      }
    }

    // Stop existing subscription
    if (locationSubscription.current) {
      locationSubscription.current.remove();
    }

    try {
      // Determine accuracy based on context
      // Use balanced accuracy for battery efficiency, high when on course
      const accuracy = isCheckedIn
        ? Location.Accuracy.High
        : Location.Accuracy.Balanced;

      // Distance interval: 10m when on course, 50m otherwise
      const distanceInterval = isCheckedIn ? 10 : 50;

      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy,
          distanceInterval,
          timeInterval: isCheckedIn ? 5000 : 15000, // 5s on course, 15s otherwise
        },
        (locationUpdate) => {
          processLocation(locationUpdate.coords);
        }
      );

      setIsTracking(true);
      console.log('[Geofencing] Started tracking with accuracy:', accuracy);
    } catch (error) {
      console.log('[Geofencing] Failed to start tracking:', error);
    }
  }, [settings.enabled, permissionStatus, requestPermission, isCheckedIn, processLocation]);

  // Stop location tracking
  const stopTracking = useCallback((): void => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
    setIsTracking(false);
    console.log('[Geofencing] Stopped tracking');
  }, []);

  // Auto-stop if settings disabled
  useEffect(() => {
    if (!settings.enabled && isTracking) {
      stopTracking();
    }
  }, [settings.enabled, isTracking, stopTracking]);

  // Reset alert flags when tee time changes
  useEffect(() => {
    hasTriggeredTeeAlert.current = false;
  }, [teeTime]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
    };
  }, []);

  // Check initial permission status
  useEffect(() => {
    Location.getForegroundPermissionsAsync().then(({ status }) => {
      setPermissionStatus(status);
    });
  }, []);

  return {
    location,
    isTracking,
    permissionStatus,
    currentTrigger,
    distanceToGreen,
    settings,
    isSettingsLoading,
    requestPermission,
    startTracking,
    stopTracking,
    refreshSettings,
  };
}

// Re-export for convenience
export { Location };
