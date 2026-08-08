import winston from 'winston';
import { DatabaseService } from './database.service';
import { decrypt, encrypt, maskSecret } from '../utils/encryption.util';

export class IntegrationsService {
  private db: DatabaseService;
  private logger: winston.Logger;

  constructor(db: DatabaseService) {
    this.db = db;
    this.logger = winston.createLogger({
      defaultMeta: { service: 'integrations' },
      transports: [new winston.transports.Console()],
    });
  }

  async listIntegrations() {
    const result = await this.db.query(
      `SELECT id, key, display_name, category, status, is_required, is_enabled,
              last_checked_at, last_error, updated_at
       FROM integrations
       ORDER BY category, display_name`
    );
    return result.rows;
  }

  async getIntegration(key: string) {
    const integration = await this.db.query(
      `SELECT * FROM integrations WHERE key = $1`,
      [key]
    );
    if (!integration.rows[0]) return null;

    const creds = await this.db.query(
      `SELECT credential_key, encrypted_value, is_secret, updated_at
       FROM integration_credentials WHERE integration_id = $1`,
      [integration.rows[0].id]
    );

    const config = await this.db.query(
      `SELECT config_key, config_value FROM integration_config WHERE integration_id = $1`,
      [integration.rows[0].id]
    );

    return {
      ...integration.rows[0],
      credentials: creds.rows.map((c) => ({
        key: c.credential_key,
        isSecret: c.is_secret,
        preview: c.is_secret
          ? maskSecret(this.safeDecrypt(c.encrypted_value))
          : this.safeDecrypt(c.encrypted_value),
        updatedAt: c.updated_at,
      })),
      config: config.rows,
    };
  }

  async getCredential(integrationKey: string, credentialKey: string): Promise<string | null> {
    const result = await this.db.query(
      `SELECT ic.encrypted_value
       FROM integration_credentials ic
       JOIN integrations i ON i.id = ic.integration_id
       WHERE i.key = $1 AND ic.credential_key = $2`,
      [integrationKey, credentialKey]
    );
    if (!result.rows[0]) return null;
    return this.safeDecrypt(result.rows[0].encrypted_value);
  }

  async saveCredentials(
    key: string,
    credentials: Record<string, string>,
    adminId?: string
  ) {
    const integration = await this.db.query(`SELECT id FROM integrations WHERE key = $1`, [key]);
    if (!integration.rows[0]) throw new Error(`Unknown integration: ${key}`);
    const integrationId = integration.rows[0].id;

    for (const [credentialKey, value] of Object.entries(credentials)) {
      if (!value) continue;
      await this.db.query(
        `INSERT INTO integration_credentials
           (integration_id, credential_key, encrypted_value, is_secret, updated_by_admin_id, updated_at)
         VALUES ($1, $2, $3, TRUE, $4, NOW())
         ON CONFLICT (integration_id, credential_key) DO UPDATE SET
           encrypted_value = EXCLUDED.encrypted_value,
           updated_by_admin_id = EXCLUDED.updated_by_admin_id,
           updated_at = NOW()`,
        [integrationId, credentialKey, encrypt(value), adminId || null]
      );
    }

    await this.db.query(
      `UPDATE integrations SET status = 'configured', updated_at = NOW() WHERE id = $1`,
      [integrationId]
    );

    await this.db.query(
      `INSERT INTO audit_log (admin_id, action, resource_type, resource_id, metadata)
       VALUES ($1, 'integrations.credentials.update', 'integration', $2, $3::jsonb)`,
      [
        adminId || null,
        key,
        JSON.stringify({ fields: Object.keys(credentials) }),
      ]
    );

    return this.getIntegration(key);
  }

  /** Resolve hub credential with common aliases + env fallback. */
  async resolveSecret(key: string, aliases: string[], envKeys: string[] = []): Promise<string | null> {
    for (const a of aliases) {
      const v = await this.getCredential(key, a);
      if (v) return v;
    }
    for (const e of envKeys) {
      if (process.env[e]) return process.env[e] as string;
    }
    return null;
  }

  async testConnection(key: string) {
    const detail = await this.getIntegration(key);
    if (!detail) throw new Error(`Unknown integration: ${key}`);

    let status: 'connected' | 'configured' | 'error' | 'not_configured' = 'not_configured';
    let lastError: string | null = null;
    const axios = require('axios');

    try {
      if (key === 'openai') {
        const { resolveOpenAiApiKey, resolveOpenAiModel, clearOpenAiCredentialCache } = require('../utils/openai-credentials');
        clearOpenAiCredentialCache();
        const apiKey = await resolveOpenAiApiKey(this.db);
        if (!apiKey) {
          status = 'not_configured';
          lastError = 'No OpenAI API key in hub or OPENAI_API_KEY env';
        } else {
          const model = await resolveOpenAiModel(this.db);
          await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
              model,
              messages: [{ role: 'user', content: 'ping' }],
              max_tokens: 5,
            },
            { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 10000 }
          );
          status = 'connected';
        }
      } else if (key === 'paystack') {
        const secret = await this.resolveSecret(
          'paystack',
          ['secret_key', 'api_key'],
          ['PAYSTACK_SECRET_KEY', 'PAYSTACK_SECRET']
        );
        if (!secret) {
          status = 'not_configured';
          lastError = 'Missing Paystack secret_key';
        } else {
          await axios.get('https://api.paystack.co/bank?currency=NGN', {
            headers: { Authorization: `Bearer ${secret}` },
            timeout: 10000,
          });
          status = 'connected';
        }
      } else if (key === 'flutterwave') {
        const secret = await this.resolveSecret(
          'flutterwave',
          ['secret_key', 'api_key'],
          ['FLUTTERWAVE_SECRET_KEY', 'FLW_SECRET_KEY']
        );
        if (!secret) {
          status = 'not_configured';
          lastError = 'Missing Flutterwave secret_key';
        } else {
          await axios.get('https://api.flutterwave.com/v3/banks/NG', {
            headers: { Authorization: `Bearer ${secret}` },
            timeout: 10000,
          });
          status = 'connected';
        }
      } else if (key === 'stripe') {
        const secret = await this.resolveSecret(
          'stripe',
          ['secret_key', 'api_key'],
          ['STRIPE_SECRET_KEY']
        );
        if (!secret) {
          status = 'not_configured';
          lastError = 'Missing Stripe secret_key';
        } else {
          await axios.get('https://api.stripe.com/v1/balance', {
            headers: { Authorization: `Bearer ${secret}` },
            timeout: 10000,
          });
          status = 'connected';
        }
      } else if (key === 'google_maps') {
        const apiKey = await this.resolveSecret(
          'google_maps',
          ['api_key', 'secret_key'],
          ['GOOGLE_MAPS_API_KEY', 'GOOGLE_PLACES_API_KEY']
        );
        if (!apiKey) {
          status = 'not_configured';
          lastError = 'Missing Google Maps api_key';
        } else {
          await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
            params: { address: 'Accra', key: apiKey },
            timeout: 10000,
          });
          status = 'connected';
        }
      } else if (key === 'mapbox') {
        const token = await this.resolveSecret(
          'mapbox',
          ['access_token', 'api_key', 'secret_key'],
          ['MAPBOX_ACCESS_TOKEN', 'MAPBOX_TOKEN']
        );
        if (!token) {
          status = 'not_configured';
          lastError = 'Missing Mapbox access_token';
        } else {
          await axios.get(`https://api.mapbox.com/tokens/v2?access_token=${encodeURIComponent(token)}`, {
            timeout: 10000,
          });
          status = 'connected';
        }
      } else if (key === 'twilio' || key === 'whatsapp') {
        const sid = await this.resolveSecret(
          key === 'whatsapp' ? 'whatsapp' : 'twilio',
          ['account_sid', 'sid'],
          ['TWILIO_ACCOUNT_SID']
        );
        const token = await this.resolveSecret(
          key === 'whatsapp' ? 'whatsapp' : 'twilio',
          ['auth_token', 'secret_key', 'api_key'],
          ['TWILIO_AUTH_TOKEN']
        );
        // Also try twilio hub when testing whatsapp
        const sidFinal =
          sid ||
          (key === 'whatsapp'
            ? await this.resolveSecret('twilio', ['account_sid', 'sid'], ['TWILIO_ACCOUNT_SID'])
            : null);
        const tokenFinal =
          token ||
          (key === 'whatsapp'
            ? await this.resolveSecret('twilio', ['auth_token', 'secret_key'], ['TWILIO_AUTH_TOKEN'])
            : null);
        if (!sidFinal || !tokenFinal) {
          status = 'not_configured';
          lastError = 'Missing Twilio account_sid / auth_token';
        } else {
          await axios.get(`https://api.twilio.com/2010-04-01/Accounts/${sidFinal}.json`, {
            auth: { username: sidFinal, password: tokenFinal },
            timeout: 10000,
          });
          status = 'connected';
        }
      } else if (key === 'telegram_bot') {
        const token = await this.resolveSecret(
          'telegram_bot',
          ['bot_token', 'api_key', 'secret_key'],
          ['TELEGRAM_BOT_TOKEN']
        );
        if (!token) {
          status = 'not_configured';
          lastError = 'Missing Telegram bot_token';
        } else {
          await axios.get(`https://api.telegram.org/bot${token}/getMe`, { timeout: 10000 });
          status = 'connected';
        }
      } else if (key === 'sendgrid') {
        const apiKey = await this.resolveSecret(
          'sendgrid',
          ['api_key', 'secret_key'],
          ['SENDGRID_API_KEY']
        );
        if (!apiKey) {
          status = 'not_configured';
          lastError = 'Missing SendGrid api_key';
        } else {
          await axios.get('https://api.sendgrid.com/v3/user/account', {
            headers: { Authorization: `Bearer ${apiKey}` },
            timeout: 10000,
          });
          status = 'connected';
        }
      } else if (key === 'openweathermap') {
        const apiKey = await this.resolveSecret(
          'openweathermap',
          ['api_key', 'secret_key'],
          ['OPENWEATHERMAP_API_KEY', 'OPENWEATHER_API_KEY']
        );
        if (!apiKey) {
          status = 'not_configured';
          lastError = 'Missing OpenWeatherMap api_key';
        } else {
          await axios.get('https://api.openweathermap.org/data/2.5/weather', {
            params: { q: 'Accra', appid: apiKey },
            timeout: 10000,
          });
          status = 'connected';
        }
      } else {
        const hasCreds = (detail.credentials || []).length > 0;
        status = hasCreds ? 'configured' : 'not_configured';
        if (!hasCreds) lastError = 'Save credentials, then test again';
      }
    } catch (error: any) {
      status = 'error';
      lastError =
        error?.response?.data?.message ||
        error?.response?.data?.error?.message ||
        error?.response?.data?.status?.message ||
        error.message;
    }

    await this.db.query(
      `UPDATE integrations
       SET status = $1, last_checked_at = NOW(), last_error = $2, updated_at = NOW()
       WHERE key = $3`,
      [status, lastError, key]
    );

    return { key, status, lastError };
  }

  async setEnabled(key: string, enabled: boolean, adminId?: string) {
    await this.db.query(
      `UPDATE integrations SET is_enabled = $1, updated_at = NOW() WHERE key = $2`,
      [enabled, key]
    );
    await this.db.query(
      `INSERT INTO audit_log (admin_id, action, resource_type, resource_id, metadata)
       VALUES ($1, $2, 'integration', $3, '{}'::jsonb)`,
      [
        adminId || null,
        enabled ? 'integrations.enable' : 'integrations.disable',
        key,
      ]
    );
    return this.getIntegration(key);
  }

  async warnRequiredOnBoot(): Promise<void> {
    const result = await this.db.query(
      `SELECT key, display_name FROM integrations
       WHERE is_required = TRUE AND status = 'not_configured'`
    );
    for (const row of result.rows) {
      this.logger.warn(
        `Required integration not configured: ${row.display_name} (${row.key})`
      );
    }
  }

  private safeDecrypt(value: string): string {
    try {
      return decrypt(value);
    } catch {
      return value;
    }
  }
}
