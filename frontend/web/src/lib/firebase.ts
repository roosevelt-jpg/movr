import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  Auth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  sendPasswordResetEmail,
  sendEmailVerification,
  signInWithCustomToken,
  applyActionCode,
  confirmPasswordReset,
  checkActionCode,
  ConfirmationResult,
} from 'firebase/auth';

type PublicConfig = {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  appId?: string;
  messagingSenderId?: string;
  recaptchaSiteKey?: string;
  configured?: boolean;
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let phoneConfirmation: ConfirmationResult | null = null;
let recaptcha: RecaptchaVerifier | null = null;

function apiBase() {
  return (process.env.REACT_APP_API_URL as string) || '/api/v1';
}

export async function loadFirebaseConfig(): Promise<PublicConfig | null> {
  try {
    const res = await fetch(`${apiBase()}/public/firebase-config`);
    const json = await res.json();
    const data = json?.data;
    if (!data?.apiKey) return null;
    return data as PublicConfig;
  } catch {
    return null;
  }
}

export async function getFirebaseAuth(): Promise<Auth | null> {
  if (auth) return auth;
  const config = await loadFirebaseConfig();
  if (!config?.apiKey) return null;
  if (!getApps().length) {
    app = initializeApp({
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      projectId: config.projectId,
      appId: config.appId,
      messagingSenderId: config.messagingSenderId,
    });
  } else {
    app = getApps()[0];
  }
  auth = getAuth(app);
  return auth;
}

function ensureRecaptchaContainer() {
  if (typeof document === 'undefined') return;
  let el = document.getElementById('firebase-recaptcha');
  if (!el) {
    el = document.createElement('div');
    el.id = 'firebase-recaptcha';
    el.style.position = 'fixed';
    el.style.bottom = '0';
    el.style.right = '0';
    el.style.zIndex = '40';
    document.body.appendChild(el);
  }
}

export async function startFirebasePhoneAuth(phone: string) {
  const a = await getFirebaseAuth();
  if (!a) return null;
  ensureRecaptchaContainer();
  if (recaptcha) {
    try {
      recaptcha.clear();
    } catch {
      /* ignore */
    }
  }
  recaptcha = new RecaptchaVerifier(a, 'firebase-recaptcha', { size: 'invisible' });
  phoneConfirmation = await signInWithPhoneNumber(a, phone, recaptcha);
  return phoneConfirmation;
}

export async function confirmFirebasePhoneCode(code: string) {
  if (!phoneConfirmation) throw new Error('No Firebase phone session');
  const cred = await phoneConfirmation.confirm(code);
  return cred.user.getIdToken();
}

export function hasFirebasePhoneSession() {
  return Boolean(phoneConfirmation);
}

export async function firebaseSendPasswordReset(email: string) {
  const a = await getFirebaseAuth();
  if (!a) return false;
  await sendPasswordResetEmail(a, email, {
    url: `${window.location.origin}/auth/action`,
    handleCodeInApp: true,
  });
  return true;
}

export async function firebaseSendEmailVerification(customToken?: string) {
  const a = await getFirebaseAuth();
  if (!a || !customToken) return false;
  await signInWithCustomToken(a, customToken);
  if (a.currentUser) await sendEmailVerification(a.currentUser, {
    url: `${window.location.origin}/auth/action`,
    handleCodeInApp: true,
  });
  return true;
}

export async function firebaseHandleOob(mode: string, oobCode: string, newPassword?: string) {
  const a = await getFirebaseAuth();
  if (!a) throw new Error('Firebase is not configured');
  if (mode === 'resetPassword' || mode === 'recoverEmail') {
    const info = await checkActionCode(a, oobCode);
    if (newPassword) await confirmPasswordReset(a, oobCode, newPassword);
    return info.data.email || '';
  }
  await applyActionCode(a, oobCode);
  return a.currentUser?.email || '';
}

export async function firebaseConfigured() {
  return Boolean(await getFirebaseAuth());
}
