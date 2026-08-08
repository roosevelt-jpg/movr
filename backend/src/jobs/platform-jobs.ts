import { DatabaseService } from '../services/database.service';
import { DriverPerformanceService } from '../services/driver-performance.service';
import { SettlementService } from '../services/settlement.service';
import { PaymentService } from '../services/payment.service';
import { TripRecordingService } from '../services/trip-recording.service';
import { RankingService } from '../services/ranking.service';

/**
 * Scheduled jobs (Phase 13/18/28). Call startPlatformJobs() from composition root.
 */
export function startPlatformJobs() {
  const db = new DatabaseService();
  const payments = new PaymentService(db);
  const performance = new DriverPerformanceService(db);
  const settlement = new SettlementService(db, payments);
  const recordings = new TripRecordingService(db);
  const ranking = new RankingService(db);

  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;

  setInterval(() => {
    performance.recalculateAllActiveDrivers().catch(() => undefined);
  }, HOUR);

  setInterval(() => {
    ranking.refreshAll().catch(() => undefined);
  }, 6 * HOUR);

  setInterval(() => {
    settlement.rollupGmv().catch(() => undefined);
  }, DAY);

  setInterval(() => {
    recordings.purgeExpired().catch(() => undefined);
  }, HOUR);

  setTimeout(() => {
    performance.recalculateAllActiveDrivers().catch(() => undefined);
    ranking.refreshAll().catch(() => undefined);
    settlement.rollupGmv().catch(() => undefined);
    recordings.purgeExpired().catch(() => undefined);
  }, 15_000);
}
