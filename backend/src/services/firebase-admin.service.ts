import { IntegrationsService } from './integrations.service';
import { DatabaseService } from './database.service';
import winston from 'winston';

const logger = winston.createLogger({
  defaultMeta: { service: 'firebase-admin' },
  transports: [new winston.transports.Console()],
});

let ready: Promise<boolean> | null = null;

/**
 * Shared Firebase Admin init (FCM + Auth). Safe to call from any service.
 */
export function ensureFirebaseAdmin(db?: DatabaseService): Promise<boolean> {
  if (ready) return ready;
  ready = init(db);
  return ready;
}

async function init(db?: DatabaseService): Promise<boolean> {
  try {
    const admin = require('firebase-admin');
    if (admin.apps?.length) return true;

    const integrations = new IntegrationsService(db || new DatabaseService());
    const jsonStr =
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
      (await integrations
        .resolveSecret(
          'firebase_auth',
          ['service_account_json', 'service_account'],
          []
        )
        .catch(() => null)) ||
      (await integrations
        .resolveSecret('firebase_fcm', ['service_account_json', 'service_account'], [])
        .catch(() => null));

    if (jsonStr) {
      const parsed = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
      if (parsed?.private_key) {
        parsed.private_key = String(parsed.private_key).replace(/\\n/g, '\n');
      }
      admin.initializeApp({ credential: admin.credential.cert(parsed) });
      logger.info('Firebase Admin initialized from service account');
      return true;
    }

    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      admin.initializeApp({ credential: admin.credential.applicationDefault() });
      logger.info('Firebase Admin initialized from application default credentials');
      return true;
    }

    logger.warn('Firebase Admin not configured');
    return false;
  } catch (e: any) {
    logger.warn(`Firebase Admin init skipped: ${e.message}`);
    return false;
  }
}

export function firebaseAdmin() {
  return require('firebase-admin');
}
