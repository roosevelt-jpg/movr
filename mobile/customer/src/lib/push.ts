import { Platform } from 'react-native';
import { apiBase } from './api-base';
import { authHeaders, getAuthToken } from './token';

type AppKind = 'customer' | 'driver';

let lastToken: string | null = null;
let listenerAttached = false;

function notificationsModule(): any | null {
  try {
    return require('expo-notifications');
  } catch {
    return null;
  }
}

export async function registerPushForApp(app: AppKind) {
  if (!getAuthToken()) return;
  const Notifications = notificationsModule();
  if (!Notifications) return;

  try {
    if (!listenerAttached) {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
      listenerAttached = true;
    }

    const perm = await Notifications.requestPermissionsAsync();
    const granted = perm.granted || perm.status === 'granted' || perm.ios?.status === 2;
    if (!granted) return;

    const tokens: { token: string; provider: string }[] = [];

    try {
      const native = await Notifications.getDevicePushTokenAsync();
      if (native?.data && native.type !== 'ios') {
        tokens.push({
          token: String(native.data),
          provider: 'fcm',
        });
      }
    } catch {
      /* Expo Go / simulator */
    }

    try {
      const expo = await Notifications.getExpoPushTokenAsync();
      if (expo?.data) tokens.push({ token: String(expo.data), provider: 'expo' });
    } catch {
      /* projectId not set */
    }

    const API = apiBase();
    for (const item of tokens) {
      lastToken = item.token;
      await fetch(`${API}/devices/fcm`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          token: item.token,
          platform: Platform.OS,
          app,
          provider: item.provider,
        }),
      }).catch(() => undefined);
    }
  } catch {
    /* push is best-effort */
  }
}

export async function unregisterPush() {
  if (!lastToken && !getAuthToken()) return;
  try {
    await fetch(`${apiBase()}/devices/fcm`, {
      method: 'DELETE',
      headers: authHeaders(),
      body: JSON.stringify({ token: lastToken || undefined }),
    });
  } catch {
    /* ignore */
  }
  lastToken = null;
}
