import winston from 'winston';
import { DatabaseService } from './database.service';
import { IntegrationsService } from './integrations.service';

export type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
  deepLink?: string;
};

type StoredToken = {
  token: string;
  platform: string;
  app: string;
  provider: string;
};

/**
 * FCM + Expo push. No-ops if Firebase / Expo are not configured so SOS and
 * inbox still work without a project.
 */
export class PushService {
  private db: DatabaseService;
  private integrations: IntegrationsService;
  private logger = winston.createLogger({
    defaultMeta: { service: 'push' },
    transports: [new winston.transports.Console()],
  });
  private firebaseReady: Promise<boolean> | null = null;

  constructor(db?: DatabaseService) {
    this.db = db || new DatabaseService();
    this.integrations = new IntegrationsService(this.db);
  }

  async ensureFirebase(): Promise<boolean> {
    const { ensureFirebaseAdmin } = require('./firebase-admin.service');
    if (this.firebaseReady) return this.firebaseReady;
    this.firebaseReady = ensureFirebaseAdmin(this.db);
    return this.firebaseReady;
  }

  async registerToken(opts: {
    userId: string;
    token: string;
    platform?: string;
    app?: string;
    provider?: string;
  }) {
    const token = String(opts.token || '').trim();
    if (!token) throw new Error('Push token is required');
    const platform = String(opts.platform || 'android').toLowerCase();
    const app = String(opts.app || 'customer').toLowerCase();
    const provider = String(
      opts.provider || (token.startsWith('ExponentPushToken') ? 'expo' : 'fcm')
    ).toLowerCase();

    await this.db.query(
      `INSERT INTO user_push_tokens (user_id, token, platform, app, provider, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (token) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         platform = EXCLUDED.platform,
         app = EXCLUDED.app,
         provider = EXCLUDED.provider,
         updated_at = NOW()`,
      [opts.userId, token, platform.slice(0, 16), app.slice(0, 24), provider.slice(0, 16)]
    );
  }

  async unregisterToken(userId: string, token?: string) {
    if (token) {
      await this.db.query(`DELETE FROM user_push_tokens WHERE user_id = $1 AND token = $2`, [
        userId,
        token,
      ]);
      return;
    }
    await this.db.query(`DELETE FROM user_push_tokens WHERE user_id = $1`, [userId]);
  }

  async sendToUser(userId: string, payload: PushPayload) {
    const rows = await this.db
      .query(`SELECT token, platform, app, provider FROM user_push_tokens WHERE user_id = $1`, [
        userId,
      ])
      .catch(() => ({ rows: [] as StoredToken[] }));

    if (!rows.rows.length) return { sent: 0, skipped: 'no_tokens' };

    const results = await Promise.all(
      rows.rows.map((row) => this.sendToToken(row, payload).catch((e: any) => ({ ok: false, error: e.message })))
    );
    const sent = results.filter((r: any) => r && r.ok !== false).length;
    return { sent, total: rows.rows.length };
  }

  async sendToToken(row: StoredToken | string, payload: PushPayload) {
    const token = typeof row === 'string' ? row : row.token;
    const provider =
      typeof row === 'string'
        ? token.startsWith('ExponentPushToken')
          ? 'expo'
          : 'fcm'
        : row.provider;

    const data: Record<string, string> = {};
    Object.entries(payload.data || {}).forEach(([k, v]) => {
      if (v != null) data[k] = String(v);
    });
    if (payload.deepLink) data.deepLink = payload.deepLink;

    if (provider === 'expo' || token.startsWith('ExponentPushToken')) {
      return this.sendExpo(token, payload, data);
    }
    return this.sendFcm(token, payload, data);
  }

  private async sendExpo(
    token: string,
    payload: PushPayload,
    data: Record<string, string>
  ) {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        to: token,
        title: payload.title,
        body: payload.body,
        sound: 'default',
        data,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.warn(`Expo push failed: ${res.status} ${text}`);
      return { ok: false };
    }
    return { ok: true };
  }

  private async sendFcm(
    token: string,
    payload: PushPayload,
    data: Record<string, string>
  ) {
    const ready = await this.ensureFirebase();
    if (!ready) return { ok: false, skipped: 'firebase_not_configured' };

    const admin = require('firebase-admin');
    try {
      await admin.messaging().send({
        token,
        notification: { title: payload.title, body: payload.body },
        data,
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default' } } },
      });
      return { ok: true };
    } catch (e: any) {
      const code = e?.code || e?.errorInfo?.code || '';
      if (
        String(code).includes('registration-token-not-registered') ||
        String(code).includes('invalid-registration-token')
      ) {
        await this.db
          .query(`DELETE FROM user_push_tokens WHERE token = $1`, [token])
          .catch(() => undefined);
      }
      this.logger.warn(`FCM send failed: ${e.message}`);
      return { ok: false, error: e.message };
    }
  }
}

let singleton: PushService | null = null;
export function getPushService(db?: DatabaseService) {
  if (!singleton) singleton = new PushService(db);
  return singleton;
}
