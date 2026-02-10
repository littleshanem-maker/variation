/**
 * Location Service
 *
 * Captures GPS coordinates for evidence tagging.
 * Designed for construction sites where GPS signal may be
 * degraded by buildings, tunnels, or remote locations.
 */

import * as Location from 'expo-location';

export interface LocationResult {
  latitude: number;
  longitude: number;
  accuracy: number; // metres
  timestamp: number;
}

let permissionGranted = false;

export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  permissionGranted = status === 'granted';
  return permissionGranted;
}

/**
 * Get current location with a timeout.
 * On construction sites, we'd rather have approximate location fast
 * than wait forever for high accuracy.
 */
export async function getCurrentLocation(
  timeoutMs: number = 5000,
): Promise<LocationResult | null> {
  if (!permissionGranted) {
    const granted = await requestLocationPermission();
    if (!granted) return null;
  }

  try {
    const location = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);

    if (!location) {
      // Timeout — try with lower accuracy
      const fallback = await Location.getLastKnownPositionAsync();
      if (fallback) {
        return {
          latitude: fallback.coords.latitude,
          longitude: fallback.coords.longitude,
          accuracy: fallback.coords.accuracy ?? 100,
          timestamp: fallback.timestamp,
        };
      }
      return null;
    }

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy ?? 10,
      timestamp: location.timestamp,
    };
  } catch (error) {
    console.error('[Location] Failed to get position:', error);
    return null;
  }
}

/**
 * Format coordinates for display: "-37.8136, 144.9631"
 */
export function formatCoordinates(lat: number, lng: number): string {
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}
