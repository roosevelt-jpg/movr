import winston from 'winston';
import { DatabaseService } from './database.service';
import { IntegrationsService } from './integrations.service';
import { ensureFirebaseAdmin, firebaseAdmin } from './firebase-admin.service';

export type FirebaseDeliverResult = {
  sent: boolean;
  provider: 'firebase';
  channel: 'email' | 'phone';
  delivery: 'oob_email' | 'client_phone_auth' | 'skipped';
  skipped?: string;
};

/**
 * Firebase Authentication — email verification / password-reset emails and
 * phone OTP (client SDK). Falls through when the project is not configured.
 */
export class FirebaseAuthService {
  private db: DatabaseService;
  private integrations: IntegrationsService;
  private logger = winston.createLogger({
    defaultMeta: { service: 'firebase-auth' },
    transports: [new winston.transports.Console()],
  });

  constructor(db?: DatabaseService) {
    this.db = db || new DatabaseService();
    this.integrations = new IntegrationsService(this.db);
  }

  async getPublicConfig() {
    const apiKey = await this.webApiKey();
    if (!apiKey) return null;
    const projectId =
      (await this.integrations
        .resolveSecret('firebase_auth', ['project_id'], ['FIREBASE_PROJECT_ID'])
        .catch(() => null)) ||
      process.env.FIREBASE_PROJECT_ID ||
      process.env.GCLOUD_PROJECT ||
      '';
    const authDomain =
      (await this.integrations
        .resolveSecret('firebase_auth', ['auth_domain'], ['FIREBASE_AUTH_DOMAIN'])
        .catch(() => null)) ||
      process.env.FIREBASE_AUTH_DOMAIN ||
      (projectId ? `${projectId}.firebaseapp.com` : '');
    const appId =
      (await this.integrations
        .resolveSecret('firebase_auth', ['app_id'], ['FIREBASE_APP_ID'])
        .catch(() => null)) ||
      process.env.FIREBASE_APP_ID ||
      '';
    const messagingSenderId =
      (await this.integrations
        .resolveSecret(
          'firebase_auth',
          ['messaging_sender_id', 'sender_id'],
          ['FIREBASE_MESSAGING_SENDER_ID']
        )
        .catch(() => null)) ||
      process.env.FIREBASE_MESSAGING_SENDER_ID ||
      '';
    const recaptchaSiteKey =
      (await this.integrations
        .resolveSecret(
          'firebase_auth',
          ['recaptcha_site_key'],
          ['FIREBASE_RECAPTCHA_SITE_KEY']
        )
        .catch(() => null)) ||
      process.env.FIREBASE_RECAPTCHA_SITE_KEY ||
      '';
    return {
      apiKey,
      authDomain,
      projectId,
      appId,
      messagingSenderId,
      recaptchaSiteKey,
    };
  }

  private async webApiKey(): Promise<string | null> {
    return (
      (await this.integrations
        .resolveSecret('firebase_auth', ['web_api_key', 'api_key'], ['FIREBASE_WEB_API_KEY'])
        .catch(() => null)) ||
      process.env.FIREBASE_WEB_API_KEY ||
      process.env.FIREBASE_API_KEY ||
      null
    );
  }

  private continueUrl() {
    const base = (process.env.PUBLIC_WEB_URL || 'https://mymovr.io').replace(/\/$/, '');
    return `${base}/auth/action`;
  }

  async isConfigured() {
    const key = await this.webApiKey();
    const adminReady = await ensureFirebaseAdmin(this.db);
    return Boolean(key || adminReady);
  }

  async deliverOtp(opts: {
    identifier: string;
    purpose: 'reset' | 'signup';
  }): Promise<FirebaseDeliverResult> {
    const id = String(opts.identifier || '').trim();
    if (!id) return { sent: false, provider: 'firebase', channel: 'email', delivery: 'skipped', skipped: 'empty' };

    if (id.includes('@')) {
      const sent = await this.sendEmailOob(id, opts.purpose);
      return {
        sent: sent.sent,
        provider: 'firebase',
        channel: 'email',
        delivery: sent.sent ? 'oob_email' : 'skipped',
        skipped: sent.skipped,
      };
    }

    const configured = await this.isConfigured();
    // Client SDKs send the SMS. Do not mark sent here or Twilio/WhatsApp is skipped
    // even when Recaptcha / native phone auth never started.
    return {
      sent: false,
      provider: 'firebase',
      channel: 'phone',
      delivery: configured ? 'client_phone_auth' : 'skipped',
      skipped: configured ? undefined : 'firebase_not_configured',
    };
  }

  async sendEmailOob(email: string, purpose: 'reset' | 'signup') {
    const apiKey = await this.webApiKey();
    if (!apiKey) {
      // Admin SDK can still mint a verification/reset link when the web API key is absent
      const ready = await ensureFirebaseAdmin(this.db);
      if (!ready) return { sent: false, skipped: 'firebase_not_configured' };
      try {
        const auth = firebaseAdmin().auth();
        const settings = { url: this.continueUrl(), handleCodeInApp: true };
        if (purpose === 'reset') {
          await auth.generatePasswordResetLink(email, settings);
        } else {
          await auth.generateEmailVerificationLink(email, settings);
        }
        // Link generated — without API key Firebase will not send the email itself.
        this.logger.warn('Firebase web API key missing; generated Auth link only (email not auto-sent)');
        return { sent: false, skipped: 'missing_web_api_key' };
      } catch (e: any) {
        this.logger.warn(`Firebase Auth link failed: ${e.message}`);
        return { sent: false, skipped: e.message };
      }
    }

    const requestType = purpose === 'reset' ? 'PASSWORD_RESET' : 'EMAIL_SIGNIN';
    try {
      const res = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestType: purpose === 'reset' ? 'PASSWORD_RESET' : 'VERIFY_EMAIL',
            email,
            continueUrl: this.continueUrl(),
            canHandleCodeInApp: true,
          }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = body?.error?.message || `http_${res.status}`;
        // VERIFY_EMAIL needs an existing Firebase user + often an idToken.
        // Fall back to PASSWORD_RESET / EMAIL_SIGNIN so signup still gets an email.
        if (purpose === 'signup' && String(msg).includes('INVALID')) {
          const retry = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${encodeURIComponent(apiKey)}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                requestType,
                email,
                continueUrl: this.continueUrl(),
                canHandleCodeInApp: true,
              }),
            }
          );
          if (retry.ok) return { sent: true };
        }
        this.logger.warn(`Firebase sendOobCode failed: ${msg}`);
        return { sent: false, skipped: msg };
      }
      return { sent: true };
    } catch (e: any) {
      this.logger.warn(`Firebase email OOB failed: ${e.message}`);
      return { sent: false, skipped: e.message };
    }
  }

  async ensureUser(opts: {
    uid: string;
    email?: string | null;
    phone?: string | null;
    password?: string | null;
    displayName?: string | null;
  }) {
    const ready = await ensureFirebaseAdmin(this.db);
    if (!ready) return { created: false, skipped: 'firebase_not_configured' };
    const auth = firebaseAdmin().auth();
    const email = opts.email && String(opts.email).includes('@') ? String(opts.email).toLowerCase() : undefined;
    const phone = opts.phone ? String(opts.phone).replace(/[\s\-()]/g, '') : undefined;
    try {
      try {
        await auth.getUser(opts.uid);
        const patch: any = {};
        if (email) patch.email = email;
        if (phone && phone.startsWith('+')) patch.phoneNumber = phone;
        if (opts.displayName) patch.displayName = opts.displayName;
        if (opts.password) patch.password = opts.password;
        if (Object.keys(patch).length) await auth.updateUser(opts.uid, patch);
        return { created: false };
      } catch (e: any) {
        if (e?.code !== 'auth/user-not-found') throw e;
      }
      await auth.createUser({
        uid: opts.uid,
        email,
        emailVerified: false,
        phoneNumber: phone && phone.startsWith('+') ? phone : undefined,
        password: opts.password || undefined,
        displayName: opts.displayName || undefined,
        disabled: false,
      });
      return { created: true };
    } catch (e: any) {
      this.logger.warn(`ensure Firebase user failed: ${e.message}`);
      return { created: false, skipped: e.message };
    }
  }

  async createCustomToken(uid: string) {
    const ready = await ensureFirebaseAdmin(this.db);
    if (!ready) return null;
    try {
      return await firebaseAdmin().auth().createCustomToken(uid);
    } catch (e: any) {
      this.logger.warn(`custom token failed: ${e.message}`);
      return null;
    }
  }

  async verifyIdToken(idToken: string) {
    const ready = await ensureFirebaseAdmin(this.db);
    if (!ready) throw new Error('Firebase is not configured');
    return firebaseAdmin().auth().verifyIdToken(idToken);
  }

  async confirmPasswordReset(oobCode: string, newPassword: string) {
    const apiKey = await this.webApiKey();
    if (!apiKey) throw new Error('Firebase web API key is not configured');
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oobCode, newPassword }),
      }
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body?.error?.message || 'Firebase password reset failed');
    }
    return body as { email?: string };
  }

  async applyOobCode(oobCode: string) {
    const apiKey = await this.webApiKey();
    if (!apiKey) throw new Error('Firebase web API key is not configured');
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oobCode }),
      }
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body?.error?.message || 'Firebase email verification failed');
    }
    return body as { email?: string; emailVerified?: boolean };
  }
}

let singleton: FirebaseAuthService | null = null;
export function getFirebaseAuthService(db?: DatabaseService) {
  if (!singleton) singleton = new FirebaseAuthService(db);
  return singleton;
}
