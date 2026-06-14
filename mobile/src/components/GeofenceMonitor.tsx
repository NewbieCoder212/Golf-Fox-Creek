import { useEffect } from 'react';

import { useGeofencing } from '@/lib/useGeofencing';

/**
 * Mounts geofencing on the home screen so check-in, auto-start,
 * F&B prompts, and Supabase zone triggers can run in the background.
 */
export function GeofenceMonitor() {
  const { settings, startTracking } = useGeofencing();

  useEffect(() => {
    if (settings.enabled) {
      startTracking();
    }
  }, [settings.enabled, startTracking]);

  return null;
}
