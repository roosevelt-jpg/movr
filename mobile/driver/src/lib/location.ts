import { Linking, Platform } from 'react-native';
import { apiBase } from './api-base';
import { authHeaders, getAuthToken } from './token';

export const DRIVER_LOCATION_TASK = 'movr-driver-location';

export type GpsFix = { latitude: number; longitude: number; heading?: number | null; speed?: number | null };

let Location: any = null;
let TaskManager: any = null;
try {
  Location = require('expo-location');
} catch {
  Location = null;
}
try {
  TaskManager = require('expo-task-manager');
} catch {
  TaskManager = null;
}

export async function getCurrentGps(): Promise<GpsFix | null> {
  if (!Location?.requestForegroundPermissionsAsync) return null;
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return null;
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy?.High || 5,
    });
    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      heading: pos.coords.heading,
      speed: pos.coords.speed,
    };
  } catch {
    return null;
  }
}

export async function postDriverLocation(fix: GpsFix) {
  const token = getAuthToken();
  if (!token) return;
  await fetch(`${apiBase()}/driver/location`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      lat: fix.latitude,
      lng: fix.longitude,
      heading: fix.heading,
      speed: fix.speed,
      platform: Platform.OS,
    }),
  }).catch(() => undefined);
}

/** Foreground service while the driver is online (no ACCESS_BACKGROUND_LOCATION). */
export async function startOnlineLocationUpdates() {
  if (!Location?.startLocationUpdatesAsync || !TaskManager) return;
  const perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== 'granted') return;
  const started = await TaskManager.isTaskRegisteredAsync?.(DRIVER_LOCATION_TASK);
  if (started) return;
  await Location.startLocationUpdatesAsync(DRIVER_LOCATION_TASK, {
    accuracy: Location.Accuracy?.Balanced || 3,
    distanceInterval: 40,
    timeInterval: 12_000,
    pausesUpdatesAutomatically: false,
    foregroundService: {
      notificationTitle: 'Movr Driver',
      notificationBody: 'Sharing your location while you are online.',
      notificationColor: '#0F766E',
    },
  });
}

export async function stopOnlineLocationUpdates() {
  try {
    const started = await TaskManager?.isTaskRegisteredAsync?.(DRIVER_LOCATION_TASK);
    if (started) await Location.stopLocationUpdatesAsync(DRIVER_LOCATION_TASK);
  } catch {
    /* not running */
  }
}

const WEB = String(process.env.EXPO_PUBLIC_WEB_URL || 'https://mymovr.io').replace(/\/$/, '');

export function openLegal(path: 'privacy' | 'terms' | 'delete-account' | 'driver-terms' | 'support') {
  return Linking.openURL(`${WEB}/${path}`).catch(() => undefined);
}
