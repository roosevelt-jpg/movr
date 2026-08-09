import { DatabaseService } from '../services/database.service';
import { DriverPerformanceService } from '../services/driver-performance.service';
import { SettlementService } from '../services/settlement.service';
import { PaymentService } from '../services/payment.service';
import { TripRecordingService } from '../services/trip-recording.service';
import { RankingService } from '../services/ranking.service';
import { TrustSettlementService } from '../services/trust-settlement.service';
import { MatchingEngineService } from '../services/matching-engine.service';
import { ReviewAutonomyService } from '../services/review-autonomy.service';
import { RideBookingService } from '../services/ride-booking.service';
import { AfricaMobilityRailsService } from '../services/africa-mobility-rails.service';
import getLogger from '../utils/logger';

/**
 * Scheduled jobs (Phase 13/18/28 + autonomous ride loop + Africa rails).
 */
export function startPlatformJobs() {
  const db = new DatabaseService();
  const payments = new PaymentService(db);
  const performance = new DriverPerformanceService(db);
  const settlement = new SettlementService(db, payments);
  const recordings = new TripRecordingService(db);
  const ranking = new RankingService(db);
  const trust = new TrustSettlementService(db);
  const reviews = new ReviewAutonomyService(db);
  const matching = new MatchingEngineService(db, null, {
    broadcastToDrivers: () => undefined,
    broadcastToRide: () => undefined,
  } as any);
  const booking = new RideBookingService(db, matching);
  const rails = new AfricaMobilityRailsService(db, matching, booking);
  const logger = getLogger('platform-jobs');

  const HOUR = 60 * 60 * 1000;
  const DAY = 24 * HOUR;
  const OFFER_TICK_MS = 15_000;

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

  // Autonomous ride loop — offer expiry / reassign + reliability credits
  setInterval(() => {
    matching
      .processExpiredOffers()
      .then((r) => {
        if (r.processed) logger.info('offer tick', r);
      })
      .catch((e) => logger.warn(`offer tick failed: ${e?.message || e}`));
  }, OFFER_TICK_MS);

  setInterval(() => {
    trust
      .processAutoNoShows()
      .then((r) => {
        if (r.credited) logger.info('auto no-show', r);
      })
      .catch((e) => logger.warn(`auto no-show failed: ${e?.message || e}`));
    trust
      .processUnmatchedSlaCredits()
      .then((r) => {
        if (r.credited) logger.info('unmatched SLA credits', r);
      })
      .catch((e) => logger.warn(`unmatched SLA failed: ${e?.message || e}`));
    trust
      .processAutoCloseEverything()
      .then((r) => {
        const n = r.disputes + r.sos + r.tickets + r.incidents + r.staleRides;
        if (n) logger.info('auto-close', r);
      })
      .catch((e) => logger.warn(`auto-close failed: ${e?.message || e}`));
  }, 60_000);

  // Autonomous reviews — prompt + silent default after AUTO_REVIEW_HOURS
  setInterval(() => {
    reviews
      .processAutoRatings()
      .then((r) => {
        if (r.prompted || r.autoRated) logger.info('auto reviews', r);
      })
      .catch((e) => logger.warn(`auto reviews failed: ${e?.message || e}`));
  }, HOUR);

  // Driver income guarantee settlement (Africa rails)
  setInterval(() => {
    rails
      .settleGuarantees()
      .then((r) => {
        if (r.toppedUp || r.fulfilled) logger.info('driver guarantees', r);
      })
      .catch((e) => logger.warn(`guarantees failed: ${e?.message || e}`));
  }, 5 * 60_000);

  setTimeout(() => {
    performance.recalculateAllActiveDrivers().catch(() => undefined);
    ranking.refreshAll().catch(() => undefined);
    settlement.rollupGmv().catch(() => undefined);
    recordings.purgeExpired().catch(() => undefined);
    matching.processExpiredOffers().catch(() => undefined);
    trust.processAutoNoShows().catch(() => undefined);
    trust.processUnmatchedSlaCredits().catch(() => undefined);
    trust.processAutoCloseEverything().catch(() => undefined);
    reviews.processAutoRatings().catch(() => undefined);
    rails.settleGuarantees().catch(() => undefined);
  }, 15_000);
}
