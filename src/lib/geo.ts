/**
 * Geofencing and GPS utilities for Fox Creek Golf Club
 *
 * Implements:
 * - Logic A (Check-In): Clubhouse geofence detection
 * - Logic B (Tee Time Alert): Practice Range + 5 min before tee time
 * - Logic C (The Turn): Hole 8 Green proximity for F&B prompt
 */

import type { GeofenceTrigger, GeofenceZone } from '@/types';
import { FOX_CREEK_DATA, getHoleByNumber } from './course-data';

// ============================================
// CONSTANTS
// ============================================

const METERS_PER_YARD = 0.9144;
const YARDS_PER_METER = 1.09361;

// The Turn hole (end of front 9)
const TURN_HOLE = 8;

// Minutes before tee time to trigger alert
const TEE_TIME_ALERT_MINUTES = 5;

// ============================================
// DISTANCE CALCULATIONS
// ============================================

/**
 * Calculate the distance between two GPS coordinates using the Haversine formula
 * @returns Distance in meters
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Calculate distance from user location to coordinates
 */
export function getDistanceFromUser(
  userLat: number,
  userLng: number,
  targetLat: number,
  targetLng: number
): number {
  return calculateDistance(userLat, userLng, targetLat, targetLng);
}

/**
 * Get distance to a specific hole's green in YARDS
 */
export function getDistanceToGreen(
  userLat: number,
  userLng: number,
  holeNumber: number
): number | null {
  const hole = getHoleByNumber(holeNumber);
  if (!hole) return null;

  // Check for placeholder coordinates
  if (hole.greenCoords.lat === 0 && hole.greenCoords.lng === 0) {
    console.log(`[Geo] Hole ${holeNumber} green coords not configured`);
    return null;
  }

  const distanceMeters = calculateDistance(
    userLat,
    userLng,
    hole.greenCoords.lat,
    hole.greenCoords.lng
  );

  return Math.round(distanceMeters * YARDS_PER_METER);
}

/**
 * Get distance to a specific hole's tee box in YARDS
 */
export function getDistanceToTee(
  userLat: number,
  userLng: number,
  holeNumber: number
): number | null {
  const hole = getHoleByNumber(holeNumber);
  if (!hole) return null;

  // Check for placeholder coordinates
  if (hole.teeBoxCoords.lat === 0 && hole.teeBoxCoords.lng === 0) {
    console.log(`[Geo] Hole ${holeNumber} tee coords not configured`);
    return null;
  }

  const distanceMeters = calculateDistance(
    userLat,
    userLng,
    hole.teeBoxCoords.lat,
    hole.teeBoxCoords.lng
  );

  return Math.round(distanceMeters * YARDS_PER_METER);
}

// ============================================
// GEOFENCE DETECTION
// ============================================

/**
 * Check if user is within a geofence zone
 */
export function isWithinGeofence(
  userLat: number,
  userLng: number,
  zone: { latitude: number; longitude: number; radius_meters: number }
): boolean {
  const distance = calculateDistance(userLat, userLng, zone.latitude, zone.longitude);
  return distance <= zone.radius_meters;
}

/**
 * Check if user is within a local geofence (from FOX_CREEK_DATA)
 */
export function isWithinLocalGeofence(
  userLat: number,
  userLng: number,
  geofenceName: string
): boolean {
  const geofence = FOX_CREEK_DATA.geofences.find(
    (g) => g.name.toLowerCase() === geofenceName.toLowerCase()
  );

  if (!geofence) return false;

  // Check for placeholder coordinates
  if (geofence.coords.lat === 0 && geofence.coords.lng === 0) {
    console.log(`[Geo] Geofence ${geofenceName} coords not configured`);
    return false;
  }

  const distance = calculateDistance(
    userLat,
    userLng,
    geofence.coords.lat,
    geofence.coords.lng
  );

  return distance <= geofence.radiusMeters;
}

/**
 * Check if user is within specified yards of a hole's green
 */
export function isNearGreen(
  userLat: number,
  userLng: number,
  holeNumber: number,
  thresholdYards: number
): boolean {
  const distanceYards = getDistanceToGreen(userLat, userLng, holeNumber);
  if (distanceYards === null) return false;
  return distanceYards <= thresholdYards;
}

// ============================================
// MAIN GEOFENCE CHECK FUNCTION
// ============================================

export interface GeofenceCheckParams {
  userLat: number;
  userLng: number;
  teeTime: Date | null;
  isCheckedIn: boolean;
  isRoundInProgress: boolean;
  currentHole: number;
  hasShownFnbPrompt: boolean;
  zones: GeofenceZone[];
  settings: {
    enabled: boolean;
    check_in_enabled: boolean;
    tee_time_alerts: boolean;
    turn_prompt_enabled: boolean;
  };
}

/**
 * Main geofence check function
 * Returns the appropriate trigger based on user location and context
 */
export function checkGeofence(params: GeofenceCheckParams): GeofenceTrigger {
  const {
    userLat,
    userLng,
    teeTime,
    isCheckedIn,
    isRoundInProgress,
    currentHole,
    hasShownFnbPrompt,
    zones,
    settings,
  } = params;

  // Master kill switch
  if (!settings.enabled) {
    return { type: 'none' };
  }

  // Logic D: Auto-Start Round at Hole 1 Tee (check first, highest priority when checked in)
  if (isCheckedIn && !isRoundInProgress) {
    const hole1TeeZone = zones.find(
      (z) => z.zone_type === 'hole_tee' && z.hole_number === 1
    );
    if (hole1TeeZone && isWithinGeofence(userLat, userLng, hole1TeeZone)) {
      return { type: 'auto_start', zone: hole1TeeZone };
    }
  }

  // Logic A: Check-In at Clubhouse
  if (settings.check_in_enabled && !isCheckedIn) {
    const clubhouseZone = zones.find((z) => z.zone_type === 'clubhouse');
    if (clubhouseZone && isWithinGeofence(userLat, userLng, clubhouseZone)) {
      return { type: 'check_in', zone: clubhouseZone };
    }

    // Fallback to local data if no Supabase zones
    if (zones.length === 0 && isWithinLocalGeofence(userLat, userLng, 'Clubhouse')) {
      const localClubhouse = FOX_CREEK_DATA.geofences.find((g) => g.name === 'Clubhouse');
      if (localClubhouse) {
        return {
          type: 'check_in',
          zone: {
            id: 'local-clubhouse',
            zone_name: localClubhouse.name,
            zone_type: 'clubhouse',
            hole_number: null,
            latitude: localClubhouse.coords.lat,
            longitude: localClubhouse.coords.lng,
            radius_meters: localClubhouse.radiusMeters,
            trigger_action: 'check_in',
            is_active: true,
            created_at: '',
            updated_at: '',
          },
        };
      }
    }
  }

  // Logic B: Tee Time Alert at Practice Range
  if (settings.tee_time_alerts && teeTime) {
    const now = new Date();
    const minutesUntilTeeTime = Math.floor(
      (teeTime.getTime() - now.getTime()) / (1000 * 60)
    );

    // Check if within alert window (5 minutes or less, but still positive)
    if (minutesUntilTeeTime <= TEE_TIME_ALERT_MINUTES && minutesUntilTeeTime > 0) {
      const rangeZone = zones.find((z) => z.zone_type === 'range');
      if (rangeZone && isWithinGeofence(userLat, userLng, rangeZone)) {
        return {
          type: 'tee_alert',
          zone: rangeZone,
          minutesUntilTeeTime,
        };
      }

      // Fallback to local data
      if (zones.length === 0 && isWithinLocalGeofence(userLat, userLng, 'Practice Range')) {
        const localRange = FOX_CREEK_DATA.geofences.find((g) => g.name === 'Practice Range');
        if (localRange) {
          return {
            type: 'tee_alert',
            zone: {
              id: 'local-range',
              zone_name: localRange.name,
              zone_type: 'range',
              hole_number: null,
              latitude: localRange.coords.lat,
              longitude: localRange.coords.lng,
              radius_meters: localRange.radiusMeters,
              trigger_action: 'tee_alert',
              is_active: true,
              created_at: '',
              updated_at: '',
            },
            minutesUntilTeeTime,
          };
        }
      }
    }
  }

  // Logic C: The Turn - F&B Prompt at Hole 8 Green
  if (settings.turn_prompt_enabled && !hasShownFnbPrompt) {
    // Only trigger when player is on or approaching hole 8
    if (currentHole >= TURN_HOLE - 1 && currentHole <= TURN_HOLE) {
      const hole8GreenZone = zones.find(
        (z) => z.zone_type === 'hole_green' && z.hole_number === TURN_HOLE
      );

      if (hole8GreenZone && isWithinGeofence(userLat, userLng, hole8GreenZone)) {
        return {
          type: 'fnb_prompt',
          zone: hole8GreenZone,
          holeNumber: TURN_HOLE,
        };
      }

      // Fallback: Check using local hole data (30 yards threshold)
      if (zones.length === 0 && isNearGreen(userLat, userLng, TURN_HOLE, 30)) {
        const hole = getHoleByNumber(TURN_HOLE);
        if (hole) {
          return {
            type: 'fnb_prompt',
            zone: {
              id: 'local-hole8-green',
              zone_name: `Hole ${TURN_HOLE} Green`,
              zone_type: 'hole_green',
              hole_number: TURN_HOLE,
              latitude: hole.greenCoords.lat,
              longitude: hole.greenCoords.lng,
              radius_meters: 27, // ~30 yards
              trigger_action: 'fnb_prompt',
              is_active: true,
              created_at: '',
              updated_at: '',
            },
            holeNumber: TURN_HOLE,
          };
        }
      }
    }
  }

  return { type: 'none' };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Convert meters to yards
 */
export function metersToYards(meters: number): number {
  return Math.round(meters * YARDS_PER_METER);
}

/**
 * Convert yards to meters
 */
export function yardsToMeters(yards: number): number {
  return yards * METERS_PER_YARD;
}

/**
 * Get the name of the zone the user is currently in
 */
export function getCurrentZoneName(
  userLat: number,
  userLng: number,
  zones: GeofenceZone[]
): string | null {
  for (const zone of zones) {
    if (isWithinGeofence(userLat, userLng, zone)) {
      return zone.zone_name;
    }
  }

  // Check local geofences as fallback
  for (const geofence of FOX_CREEK_DATA.geofences) {
    if (geofence.coords.lat === 0 && geofence.coords.lng === 0) continue;

    const distance = calculateDistance(
      userLat,
      userLng,
      geofence.coords.lat,
      geofence.coords.lng
    );

    if (distance <= geofence.radiusMeters) {
      return geofence.name;
    }
  }

  return null;
}

/**
 * Get all distances to course features for debugging/display
 */
export function getCourseDistances(
  userLat: number,
  userLng: number
): {
  toClubhouse: number | null;
  toRange: number | null;
  toCanteen: number | null;
  toCurrentGreen: (holeNumber: number) => number | null;
} {
  const clubhouse = FOX_CREEK_DATA.geofences.find((g) => g.name === 'Clubhouse');
  const range = FOX_CREEK_DATA.geofences.find((g) => g.name === 'Practice Range');
  const canteen = FOX_CREEK_DATA.geofences.find((g) => g.name === 'Canteen');

  const getDistance = (geofence: typeof clubhouse): number | null => {
    if (!geofence || (geofence.coords.lat === 0 && geofence.coords.lng === 0)) {
      return null;
    }
    return metersToYards(
      calculateDistance(userLat, userLng, geofence.coords.lat, geofence.coords.lng)
    );
  };

  return {
    toClubhouse: getDistance(clubhouse),
    toRange: getDistance(range),
    toCanteen: getDistance(canteen),
    toCurrentGreen: (holeNumber: number) => getDistanceToGreen(userLat, userLng, holeNumber),
  };
}
