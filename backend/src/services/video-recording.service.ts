/**
 * @deprecated Phase 28 — use `TripRecordingService` instead.
 * Legacy live-stream / blockchain video path is intentionally retired:
 * recordings are local-first + async S3 upload (not realtime streaming).
 * Kept as a thin facade so unmounted `security-routes.ts` still typechecks.
 */
import { DatabaseService } from './database.service';
import { TripRecordingService } from './trip-recording.service';
import getLogger from '../utils/logger';

const logger = getLogger('video-recording-legacy');
const db = new DatabaseService();
const trip = new TripRecordingService(db);

class VideoRecordingService {
  async startRecording(
    rideId: string,
    driverId: string,
    _customerId?: string,
    _pickup?: { lat: number; lng: number }
  ) {
    logger.info('delegating startRecording to TripRecordingService', { rideId });
    await trip.logDriverConsent(rideId);
    return trip.startLocalRecording(rideId, driverId);
  }

  async stopRecording(rideId: string, _driverId?: string, _dropoff?: { lat: number; lng: number }) {
    logger.info('delegating stopRecording → upload URL request', { rideId });
    return trip.requestUploadUrl(rideId);
  }

  async uploadVideoToBlockchain(rideId: string, _buffer?: Buffer, _meta?: any) {
    logger.warn('blockchain video storage removed in Phase 28; completing S3 upload metadata only', {
      rideId,
    });
    return trip.completeUpload(rideId);
  }

  async getVideoEvidence(rideId: string) {
    return trip.getRecordingMeta(rideId);
  }
}

export default new VideoRecordingService();
