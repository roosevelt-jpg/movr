import { DatabaseService } from '../services/database.service';
import { DriverPerformanceService } from '../services/driver-performance.service';
import { SettlementService } from '../services/settlement.service';
import { PaymentService } from '../services/payment.service';
import { TripRecordingService } from '../services/trip-recording.service';

/**
 * Scheduled jobs (Phase 13/18/28). Call startPlatformJobs() from composition root.
 */
export function startPlatformJobs() {
  const db = new DatabaseService();
  const payments = new PaymentService(db);
  const performance = new DriverPerformanceService(db);
  const settlement = new SettlementService(db, payments);
  const recordings = new TripRecordingService(db);

  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;

  // Recalculate driver metrics hourly
  setInterval(() => {
    performance.recalculateAllActiveDrivers().catch(() => undefined);
  }, HOUR);

  // Nightly GMV rollup (~01:00 local drift is acceptable for MVP)
  setInterval(() => {
    settlement.rollupGmv().catch(() => undefined);
  }, DAY);

  // Purge expired trip recordings hourly (unless flagged for dispute)
  setInterval(() => {
    recordings.purgeExpired().catch(() => undefined);
  }, HOUR);

  // Kick once shortly after boot
  setTimeout(() => {
    performance.recalculateAllActiveDrivers().catch(() => undefined);
    settlement.rollupGmv().catch(() => undefined);
    recordings.purgeExpired().catch(() => undefined);
  }, 15_000);
}
