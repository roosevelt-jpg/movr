import AWS from 'aws-sdk';
import { DatabaseService } from './database.service';
import { IntegrationsService } from './integrations.service';
import getLogger from '../utils/logger';

/**
 * Phase 28 — local record + async upload (not live stream).
 * Feature should stay off for real users until privacy/legal review.
 */
export class TripRecordingService {
  private logger = getLogger('trip-recording');
  private integrations: IntegrationsService;
  private retentionHoursDefault = 72;

  constructor(private db: DatabaseService) {
    this.integrations = new IntegrationsService(db);
  }

  private s3Client() {
    return new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'eu-west-1',
    });
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
    const enabled = process.env.TRIP_RECORDING_ENABLED === 'true';
    if (!enabled) {
      return { enabled: false, message: 'Trip recording disabled pending privacy review' };
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

    const bucket =
      (await this.integrations.getCredential('aws_s3', 'bucket')) ||
      process.env.AWS_S3_BUCKET ||
      'movr-documents';
    const key = `trip-recordings/${rideId}/${rec.rows[0].id}.mp4`;

    const s3 = this.s3Client();
    const uploadUrl = s3.getSignedUrl('putObject', {
      Bucket: bucket,
      Key: key,
      ContentType: 'video/mp4',
      Expires: 3600,
    });

    await this.db.query(
      `UPDATE trip_recordings SET status = 'uploading', cloud_storage_key = $1 WHERE id = $2`,
      [key, rec.rows[0].id]
    );

    return { uploadUrl, key, recordingId: rec.rows[0].id, expiresInSeconds: 3600 };
  }

  async completeUpload(rideId: string, localDurationSeconds?: number) {
    const hours = Number(process.env.TRIP_RECORDING_RETENTION_HOURS) || this.retentionHoursDefault;
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
         retention_expires_at = GREATEST(retention_expires_at, NOW() + INTERVAL '30 days')
       WHERE ride_id = $2
       RETURNING *`,
      [adminId, rideId]
    );
    await this.db.query(
      `INSERT INTO audit_log (admin_id, action, resource_type, resource_id, reason, metadata)
       VALUES ($1, 'flag_recording_dispute', 'ride', $2, $3, '{}'::jsonb)`,
      [adminId, rideId, reason]
    );
    return row.rows[0];
  }

  async getPlaybackUrl(rideId: string, adminId: string, incidentRef: string, role?: string) {
    if (role && role !== 'trust_and_safety' && role !== 'admin') {
      throw new Error('trust-and-safety role required');
    }
    if (!incidentRef) throw new Error('incident reference required');

    const rec = await this.db.query(
      `SELECT * FROM trip_recordings
       WHERE ride_id = $1 AND flagged_for_dispute = TRUE AND status = 'uploaded'
       ORDER BY created_at DESC LIMIT 1`,
      [rideId]
    );
    if (!rec.rows[0]?.cloud_storage_key) {
      throw new Error('No flagged uploaded recording for this ride');
    }

    const bucket =
      (await this.integrations.getCredential('aws_s3', 'bucket')) ||
      process.env.AWS_S3_BUCKET ||
      'movr-documents';
    const s3 = this.s3Client();
    const url = s3.getSignedUrl('getObject', {
      Bucket: bucket,
      Key: rec.rows[0].cloud_storage_key,
      Expires: 300,
    });

    await this.db.query(
      `INSERT INTO audit_log (admin_id, action, resource_type, resource_id, reason, metadata)
       VALUES ($1, 'view_recording', 'ride', $2, $3, $4::jsonb)`,
      [
        adminId,
        rideId,
        incidentRef,
        JSON.stringify({ recordingId: rec.rows[0].id }),
      ]
    );

    return { playbackUrl: url, expiresInSeconds: 300, downloadable: false };
  }

  async purgeExpired() {
    const due = await this.db.query(
      `SELECT * FROM trip_recordings
       WHERE status = 'uploaded'
         AND flagged_for_dispute = FALSE
         AND retention_expires_at IS NOT NULL
         AND retention_expires_at < NOW()`
    );

    const bucket =
      (await this.integrations.getCredential('aws_s3', 'bucket')) ||
      process.env.AWS_S3_BUCKET ||
      'movr-documents';
    const s3 = this.s3Client();

    for (const row of due.rows) {
      try {
        if (row.cloud_storage_key) {
          await s3
            .deleteObject({ Bucket: bucket, Key: row.cloud_storage_key })
            .promise()
            .catch(() => undefined);
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
