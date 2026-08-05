import AWS from 'aws-sdk';
import fs from 'fs';
import path from 'path';
import { DatabaseService } from './database.service';
import { IntegrationsService } from './integrations.service';
import getLogger from '../utils/logger';

const LOCAL_RECORDING_ROOT = path.resolve(__dirname, '../../uploads/trip-recordings');

/**
 * Phase 28 — local record + async upload (not live stream).
 * Enabled via TRIP_RECORDING_ENABLED / feature_flags.trip_recording.
 */
export class TripRecordingService {
  private logger = getLogger('trip-recording');
  private integrations: IntegrationsService;
  private retentionHoursDefault = 72;

  constructor(private db: DatabaseService) {
    this.integrations = new IntegrationsService(db);
    if (!fs.existsSync(LOCAL_RECORDING_ROOT)) {
      fs.mkdirSync(LOCAL_RECORDING_ROOT, { recursive: true });
    }
  }

  async isEnabled(): Promise<boolean> {
    if (process.env.TRIP_RECORDING_ENABLED === 'true') return true;
    try {
      const flag = await this.db.query(
        `SELECT enabled FROM feature_flags WHERE key = 'trip_recording' LIMIT 1`
      );
      return Boolean(flag.rows[0]?.enabled);
    } catch {
      return false;
    }
  }

  async getRetentionHours(): Promise<number> {
    try {
      const flag = await this.db.query(
        `SELECT metadata FROM feature_flags WHERE key = 'trip_recording' LIMIT 1`
      );
      const hours = Number(flag.rows[0]?.metadata?.retentionHours);
      if (hours > 0) return hours;
    } catch {
      /* ignore */
    }
    return Number(process.env.TRIP_RECORDING_RETENTION_HOURS) || this.retentionHoursDefault;
  }

  private async hasS3Credentials(): Promise<boolean> {
    const accessKeyId =
      (await this.integrations.getCredential('aws_s3', 'access_key_id').catch(() => null)) ||
      process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey =
      (await this.integrations.getCredential('aws_s3', 'secret_access_key').catch(() => null)) ||
      process.env.AWS_SECRET_ACCESS_KEY;
    return Boolean(accessKeyId && secretAccessKey);
  }

  private async s3Client() {
    const accessKeyId =
      (await this.integrations.getCredential('aws_s3', 'access_key_id')) ||
      process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey =
      (await this.integrations.getCredential('aws_s3', 'secret_access_key')) ||
      process.env.AWS_SECRET_ACCESS_KEY;
    const region =
      (await this.integrations.getCredential('aws_s3', 'region')) ||
      process.env.AWS_REGION ||
      'eu-west-1';
    return new AWS.S3({ accessKeyId, secretAccessKey, region });
  }

  private async bucketName() {
    return (
      (await this.integrations.getCredential('aws_s3', 'bucket')) ||
      process.env.AWS_S3_BUCKET ||
      'movr-documents'
    );
  }

  private apiPublicBase() {
    return (
      process.env.API_PUBLIC_URL ||
      process.env.PUBLIC_API_URL ||
      `http://localhost:${process.env.PORT || 3000}`
    ).replace(/\/$/, '');
  }

  async logRiderNotice(rideId: string) {
    const existing = await this.db.query(
      `SELECT id FROM recording_consent_log WHERE ride_id = $1`,
      [rideId]
    );
    if (existing.rows[0]) {
      return (
        await this.db.query(
          `UPDATE recording_consent_log SET rider_notified_at = NOW() WHERE ride_id = $1 RETURNING *`,
          [rideId]
        )
      ).rows[0];
    }
    return (
      await this.db.query(
        `INSERT INTO recording_consent_log (ride_id, rider_notified_at)
         VALUES ($1, NOW()) RETURNING *`,
        [rideId]
      )
    ).rows[0];
  }

  async logDriverConsent(rideId: string) {
    return (
      await this.db.query(
        `INSERT INTO recording_consent_log (ride_id, driver_consented_at)
         VALUES ($1, NOW())
         ON CONFLICT (ride_id) DO UPDATE SET driver_consented_at = NOW()
         RETURNING *`,
        [rideId]
      )
    ).rows[0];
  }

  async startLocalRecording(rideId: string, driverId: string) {
    if (!(await this.isEnabled())) {
      return { enabled: false, message: 'Trip recording is disabled' };
    }

    const row = await this.db.query(
      `INSERT INTO trip_recordings (ride_id, driver_id, status)
       VALUES ($1, $2, 'recording')
       ON CONFLICT (ride_id) DO UPDATE SET status = 'recording', driver_id = EXCLUDED.driver_id
       RETURNING *`,
      [rideId, driverId]
    );
    return { enabled: true, recording: row.rows[0] };
  }

  async requestUploadUrl(rideId: string) {
    const rec = await this.db.query(
      `SELECT * FROM trip_recordings WHERE ride_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [rideId]
    );
    if (!rec.rows[0]) throw new Error('No recording for ride');

    const key = `trip-recordings/${rideId}/${rec.rows[0].id}.mp4`;

    await this.db.query(
      `UPDATE trip_recordings SET status = 'uploading', cloud_storage_key = $1 WHERE id = $2`,
      [key, rec.rows[0].id]
    );

    if (!(await this.hasS3Credentials())) {
      return {
        uploadUrl: `${this.apiPublicBase()}/api/v1/rides/${rideId}/recording/upload-body`,
        key,
        recordingId: rec.rows[0].id,
        expiresInSeconds: 3600,
        chunked: false,
        local: true,
        resumeHint: 'PUT raw video body to upload-body (local storage fallback when S3 unset)',
      };
    }

    const bucket = await this.bucketName();
    const s3 = await this.s3Client();
    const uploadUrl = s3.getSignedUrl('putObject', {
      Bucket: bucket,
      Key: key,
      ContentType: 'video/mp4',
      Expires: 3600,
    });

    return {
      uploadUrl,
      key,
      recordingId: rec.rows[0].id,
      expiresInSeconds: 3600,
      chunked: true,
      local: false,
      resumeHint: 'Use HTTP PUT; retry failed ranges; prefer Wi-Fi',
    };
  }

  /** Persist recording bytes when S3 is not configured (dev / local). */
  async saveLocalUploadBody(rideId: string, buffer: Buffer) {
    const rec = await this.db.query(
      `SELECT * FROM trip_recordings WHERE ride_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [rideId]
    );
    if (!rec.rows[0]) throw new Error('No recording for ride');
    const filename = `${rec.rows[0].id}.mp4`;
    const full = path.join(LOCAL_RECORDING_ROOT, filename);
    fs.writeFileSync(full, buffer);
    const key = `local:${filename}`;
    await this.db.query(
      `UPDATE trip_recordings SET cloud_storage_key = $1, status = 'uploading' WHERE id = $2`,
      [key, rec.rows[0].id]
    );
    return { key, bytes: buffer.length, path: `/uploads/trip-recordings/${filename}` };
  }

  async completeUpload(rideId: string, localDurationSeconds?: number) {
    const hours = await this.getRetentionHours();
    const expires = new Date(Date.now() + hours * 3600 * 1000);
    return (
      await this.db.query(
        `UPDATE trip_recordings SET
           status = 'uploaded',
           uploaded_at = NOW(),
           retention_expires_at = $1,
           local_duration_seconds = COALESCE($2, local_duration_seconds)
         WHERE ride_id = $3
         RETURNING *`,
        [expires, localDurationSeconds ?? null, rideId]
      )
    ).rows[0];
  }

  async flagRecordingForDispute(rideId: string, adminId: string, reason: string) {
    const row = await this.db.query(
      `UPDATE trip_recordings SET
         flagged_for_dispute = TRUE,
         flagged_at = NOW(),
         flagged_by_admin_id = $1,
         retention_expires_at = GREATEST(COALESCE(retention_expires_at, NOW()), NOW() + INTERVAL '30 days')
       WHERE ride_id = $2
       RETURNING *`,
      [adminId, rideId]
    );
    if (!row.rows[0]) {
      const inserted = await this.db.query(
        `INSERT INTO trip_recordings (ride_id, driver_id, status, flagged_for_dispute, flagged_at, flagged_by_admin_id, retention_expires_at)
         SELECT $1, COALESCE(r.driver_id, $2), 'recording', TRUE, NOW(), $2, NOW() + INTERVAL '30 days'
         FROM rides r WHERE r.id = $1
         ON CONFLICT (ride_id) DO UPDATE SET
           flagged_for_dispute = TRUE,
           flagged_at = NOW(),
           flagged_by_admin_id = EXCLUDED.flagged_by_admin_id,
           retention_expires_at = GREATEST(COALESCE(trip_recordings.retention_expires_at, NOW()), NOW() + INTERVAL '30 days')
         RETURNING *`,
        [rideId, adminId]
      );
      await this.db.query(
        `INSERT INTO audit_log (admin_id, action, resource_type, resource_id, reason, metadata)
         VALUES ($1, 'flag_recording_dispute', 'ride', $2, $3, '{}'::jsonb)`,
        [adminId, rideId, reason]
      );
      return inserted.rows[0];
    }
    await this.db.query(
      `INSERT INTO audit_log (admin_id, action, resource_type, resource_id, reason, metadata)
       VALUES ($1, 'flag_recording_dispute', 'ride', $2, $3, '{}'::jsonb)`,
      [adminId, rideId, reason]
    );
    return row.rows[0];
  }

  async assertIncidentRef(rideId: string, incidentRef: string) {
    if (!incidentRef || !String(incidentRef).trim()) {
      throw new Error('incident reference required');
    }
    const ref = String(incidentRef).trim();
    if (/^DISPUTE[-_]/i.test(ref) || /^FARE[-_]/i.test(ref)) return true;

    const sos = await this.db.query(
      `SELECT id FROM sos_emergencies WHERE ride_id = $1 AND (id::text = $2 OR id::text LIKE $3)
       LIMIT 1`,
      [rideId, ref, `${ref}%`]
    );
    if (sos.rows[0]) return true;

    const flagged = await this.db.query(
      `SELECT 1 FROM trip_recordings WHERE ride_id = $1 AND flagged_for_dispute = TRUE LIMIT 1`,
      [rideId]
    );
    if (flagged.rows[0] && ref.length >= 6) return true;

    throw new Error('incident reference must match an SOS/dispute for this ride');
  }

  async getRecordingMeta(rideId: string) {
    const rec = await this.db.query(
      `SELECT id, status, flagged_for_dispute, flagged_at, retention_expires_at, uploaded_at,
              local_duration_seconds, cloud_storage_key IS NOT NULL AS has_file
       FROM trip_recordings WHERE ride_id = $1`,
      [rideId]
    );
    const consent = await this.db.query(
      `SELECT rider_notified_at, driver_consented_at FROM recording_consent_log WHERE ride_id = $1`,
      [rideId]
    );
    const sos = await this.db.query(
      `SELECT id, status, created_at FROM sos_emergencies WHERE ride_id = $1 ORDER BY created_at DESC LIMIT 3`,
      [rideId]
    );
    return {
      recording: rec.rows[0] || null,
      consent: consent.rows[0] || null,
      incidents: sos.rows,
      viewable: Boolean(rec.rows[0]?.flagged_for_dispute && rec.rows[0]?.status === 'uploaded'),
    };
  }

  async getPlaybackUrl(
    rideId: string,
    adminId: string,
    incidentRef: string,
    roles: string[] = []
  ) {
    const allowed = roles.some((r) => r === 'trust_and_safety');
    if (!allowed) {
      throw new Error('trust-and-safety role required');
    }
    await this.assertIncidentRef(rideId, incidentRef);

    const rec = await this.db.query(
      `SELECT * FROM trip_recordings
       WHERE ride_id = $1 AND flagged_for_dispute = TRUE AND status = 'uploaded'
       ORDER BY created_at DESC LIMIT 1`,
      [rideId]
    );
    if (!rec.rows[0]?.cloud_storage_key) {
      throw new Error('No flagged uploaded recording for this ride');
    }

    const key = String(rec.rows[0].cloud_storage_key);
    let url: string;

    if (key.startsWith('local:')) {
      const filename = key.slice('local:'.length);
      url = `${this.apiPublicBase()}/uploads/trip-recordings/${filename}`;
    } else if (!(await this.hasS3Credentials())) {
      const basename = path.basename(key);
      const localFile = path.join(LOCAL_RECORDING_ROOT, basename);
      if (fs.existsSync(localFile)) {
        url = `${this.apiPublicBase()}/uploads/trip-recordings/${basename}`;
      } else {
        throw new Error('Local recording file missing');
      }
    } else {
      const bucket = await this.bucketName();
      const s3 = await this.s3Client();
      url = s3.getSignedUrl('getObject', {
        Bucket: bucket,
        Key: key,
        Expires: 300,
        ResponseContentDisposition: 'inline',
        ResponseContentType: 'video/mp4',
      });
    }

    await this.db.query(
      `INSERT INTO audit_log (admin_id, action, resource_type, resource_id, reason, metadata)
       VALUES ($1, 'view_recording', 'ride', $2, $3, $4::jsonb)`,
      [
        adminId,
        rideId,
        incidentRef,
        JSON.stringify({ recordingId: rec.rows[0].id, downloadable: false }),
      ]
    );

    return {
      playbackUrl: url,
      expiresInSeconds: 300,
      downloadable: false,
      mode: 'secure_playback',
    };
  }

  async purgeExpired() {
    const due = await this.db.query(
      `SELECT * FROM trip_recordings
       WHERE status = 'uploaded'
         AND flagged_for_dispute = FALSE
         AND retention_expires_at IS NOT NULL
         AND retention_expires_at < NOW()`
    );

    const useS3 = await this.hasS3Credentials();
    const bucket = useS3 ? await this.bucketName() : null;
    const s3 = useS3 ? await this.s3Client() : null;

    for (const row of due.rows) {
      try {
        if (row.cloud_storage_key) {
          const key = String(row.cloud_storage_key);
          if (key.startsWith('local:')) {
            const full = path.join(LOCAL_RECORDING_ROOT, key.slice('local:'.length));
            if (fs.existsSync(full)) fs.unlinkSync(full);
          } else if (s3 && bucket) {
            await s3
              .deleteObject({ Bucket: bucket, Key: key })
              .promise()
              .catch(() => undefined);
          } else {
            const full = path.join(LOCAL_RECORDING_ROOT, path.basename(key));
            if (fs.existsSync(full)) fs.unlinkSync(full);
          }
        }
        await this.db.query(
          `UPDATE trip_recordings SET status = 'deleted', cloud_storage_key = NULL WHERE id = $1`,
          [row.id]
        );
      } catch (err: any) {
        this.logger.warn('purge failed', { id: row.id, error: err.message });
      }
    }
    return due.rows.length;
  }
}
