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

  async testConnection(key: string) {
    const detail = await this.getIntegration(key);
    if (!detail) throw new Error(`Unknown integration: ${key}`);

    let status: 'connected' | 'configured' | 'error' | 'not_configured' = 'not_configured';
    let lastError: string | null = null;

    try {
      const hasCreds = (detail.credentials || []).length > 0;
      if (!hasCreds) {
        status = 'not_configured';
      } else if (key === 'paystack' || key === 'flutterwave' || key === 'google_maps') {
        // Lightweight: credentials present → configured; live ping deferred to avoid cost
        status = 'configured';
      } else {
        status = 'configured';
      }
    } catch (error: any) {
      status = 'error';
      lastError = error.message;
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
