const KEY = 'movr_token';

export function getAuthToken(): string | null {
  const mem = (globalThis as any).__MOVR_TOKEN__;
  if (mem) return String(mem);
  try {
    if (typeof localStorage !== 'undefined') return localStorage.getItem(KEY);
  } catch {
    /* native */
  }
  return null;
}

export function setAuthToken(token: string | null) {
  (globalThis as any).__MOVR_TOKEN__ = token || '';
  try {
    if (typeof localStorage === 'undefined') return;
    if (token) localStorage.setItem(KEY, token);
    else localStorage.removeItem(KEY);
  } catch {
    /* native */
  }
}

export async function persistAuthToken(token: string | null) {
  setAuthToken(token);
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    if (token) await AsyncStorage.setItem(KEY, token);
    else await AsyncStorage.removeItem(KEY);
  } catch {
    /* optional */
  }
}

export async function hydrateAuthToken(): Promise<string | null> {
  const existing = getAuthToken();
  if (existing) return existing;
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const stored = await AsyncStorage.getItem(KEY);
    if (stored) {
      setAuthToken(stored);
      return stored;
    }
  } catch {
    /* optional */
  }
  return null;
}

export function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
