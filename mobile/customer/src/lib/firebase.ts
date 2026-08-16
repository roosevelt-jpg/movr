import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  sendPasswordResetEmail,
  signInWithCustomToken,
  sendEmailVerification,
} from 'firebase/auth';
import { apiBase } from './api-base';

let auth: any = null;
let nativeConfirm: { confirm: (code: string) => Promise<any> } | null = null;

async function loadConfig() {
  try {
    const res = await fetch(`${apiBase()}/public/firebase-config`);
    const json = await res.json();
    return json?.data?.apiKey ? json.data : null;
  } catch {
    return null;
  }
}

function continueUrl() {
  const web = String(process.env.EXPO_PUBLIC_WEB_URL || 'https://mymovr.io').replace(/\/$/, '');
  return `${web}/auth/action`;
}

export async function getMobileFirebaseAuth() {
  if (auth) return auth;
  const config = await loadConfig();
  if (!config) return null;
  const app = getApps().length
    ? getApps()[0]
    : initializeApp({
        apiKey: config.apiKey,
        authDomain: config.authDomain,
        projectId: config.projectId,
        appId: config.appId,
        messagingSenderId: config.messagingSenderId,
      });
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const { initializeAuth, getReactNativePersistence } = require('firebase/auth');
    try {
      auth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
      });
    } catch {
      auth = getAuth(app);
    }
  } catch {
    auth = getAuth(app);
  }
  return auth;
}

export async function firebaseSendPasswordReset(email: string) {
  const a = await getMobileFirebaseAuth();
  if (!a) return false;
  await sendPasswordResetEmail(a, email, {
    url: continueUrl(),
    handleCodeInApp: false,
  });
  return true;
}

export async function firebaseSendEmailVerification(customToken?: string) {
  const a = await getMobileFirebaseAuth();
  if (!a || !customToken) return false;
  await signInWithCustomToken(a, customToken);
  if (a.currentUser) {
    await sendEmailVerification(a.currentUser, {
      url: continueUrl(),
      handleCodeInApp: false,
    });
  }
  return true;
}

export async function startFirebasePhoneAuth(phone: string) {
  nativeConfirm = null;
  try {
    const rnAuth = require('@react-native-firebase/auth').default;
    nativeConfirm = await rnAuth().signInWithPhoneNumber(phone);
    return Boolean(nativeConfirm);
  } catch {
    return false;
  }
}

export async function confirmFirebasePhoneCode(code: string): Promise<string | null> {
  if (!nativeConfirm) return null;
  const cred = await nativeConfirm.confirm(code);
  return cred?.user?.getIdToken?.() || null;
}

export function hasFirebasePhoneSession() {
  return Boolean(nativeConfirm);
}
