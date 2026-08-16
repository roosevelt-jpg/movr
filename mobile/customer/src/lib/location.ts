import { Linking, Platform } from 'react-native';
import { apiBase } from './api-base';
import { authHeaders } from './token';

export type GpsFix = { latitude: number; longitude: number; accuracy?: number | null };

let Location: any = null;
try {
  Location = require('expo-location');
} catch {
  Location = null;
}

function webFix(): Promise<GpsFix | null> {
  return new Promise((resolve) => {
    const geo = (globalThis as any).navigator?.geolocation;
    if (!geo?.getCurrentPosition) {
      resolve(null);
      return;
    }
    geo.getCurrentPosition(
      (pos: any) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      () => resolve(null),
      { maximumAge: 60_000, timeout: 8_000, enableHighAccuracy: true }
    );
  });
}

/** Foreground GPS. Requests Android/iOS when-in-use permission on native. */
export async function getCurrentGps(): Promise<GpsFix | null> {
  if (Location?.requestForegroundPermissionsAsync) {
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') return webFix();
      const last = await Location.getLastKnownPositionAsync?.();
      if (last?.coords) {
        return {
          latitude: last.coords.latitude,
          longitude: last.coords.longitude,
          accuracy: last.coords.accuracy,
        };
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy?.Balanced || 3,
      });
      return {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      };
    } catch {
      return webFix();
    }
  }
  return webFix();
}

export async function reverseLabel(fix: GpsFix): Promise<string | null> {
  try {
    const res = await fetch(
      `${apiBase()}/public/maps/reverse?lat=${encodeURIComponent(String(fix.latitude))}&lng=${encodeURIComponent(String(fix.longitude))}`
    );
    const j = await res.json();
    return j?.data?.label || j?.data?.formattedAddress || j?.data?.city || null;
  } catch {
    return null;
  }
}

export async function persistCustomerLocation(fix: GpsFix, label?: string | null) {
  await fetch(`${apiBase()}/me/location`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({
      lat: fix.latitude,
      lng: fix.longitude,
      label: label || undefined,
      platform: Platform.OS,
    }),
  }).catch(() => undefined);
}

const WEB = String(process.env.EXPO_PUBLIC_WEB_URL || 'https://mymovr.io').replace(/\/$/, '');

export function legalUrl(path: 'privacy' | 'terms' | 'delete-account' | 'support' | 'driver-terms') {
  return `${WEB}/${path}`;
}

export function openLegal(path: Parameters<typeof legalUrl>[0]) {
  return Linking.openURL(legalUrl(path)).catch(() => undefined);
}
