import { DatabaseService } from './database.service';
import getLogger from '../utils/logger';

const TOXIC_PATTERNS = [
  /\b(kill|murder|rape|terrorist)\b/i,
  /\b(scam|fraud|thief|steal(ing)?)\b/i,
  /\b(nigg|faggot|retard)\b/i,
];

/**
 * Autonomous review loop: prompt both parties after complete,
 * moderate toxic comments, auto-submit neutral 5★ if no response.
 */
export class ReviewAutonomyService {
  private logger = getLogger('review-autonomy');

  constructor(private db: DatabaseService) {}

  moderateComment(text: string): { clean: string; flags: string[]; moderated: boolean } {
    const raw = String(text || '').trim();
    if (!raw) return { clean: '', flags: [], moderated: false };
    const flags: string[] = [];
    for (const p of TOXIC_PATTERNS) {
      if (p.test(raw)) flags.push(p.source);
    }
    if (!flags.length) return { clean: raw.slice(0, 1000), flags: [], moderated: false };
    return {
      clean: '[comment removed by Movr moderation]',
      flags,
      moderated: true,
    };
  }

  /** After trip complete — nudge rider + driver to rate. */
  async promptAfterComplete(rideId: string): Promise<void> {
    const ride = await this.db.query(
      `SELECT id, customer_id, driver_id, rating_prompted_at, status
       FROM rides WHERE id = $1`,
      [rideId]
    );
    const r = ride.rows[0];
    if (!r || r.status !== 'completed') return;
    if (r.rating_prompted_at) return;

    await this.db.query(
      `UPDATE rides SET rating_prompted_at = NOW() WHERE id = $1`,
      [rideId]
    );

    try {
      const { InboxService } = require('./inbox.service');
      const inbox = new InboxService(this.db);
      if (r.customer_id) {
        await inbox.sendInboxMessage(
          r.customer_id,
          'ride_update',
          'Rate your trip',
          'How was your ride? Tap to rate your driver — it takes 10 seconds.',
          `/ride/${rideId}/rate`
        );
      }
      if (r.driver_id) {
        await inbox.sendInboxMessage(
          r.driver_id,
          'ride_update',
          'Rate your rider',
          'Rate this rider to keep the network safe and reliable.',
          `/driver/ride/${rideId}/rate`
        );
      }
    } catch {
      /* inbox optional */
    }
  }

  async submitRating(input: {
    rideId: string;
    raterId: string;
    raterRole: 'customer' | 'driver';
    rating: number;
    comment?: string;
    tags?: string[];
    autoSubmitted?: boolean;
  }) {
    const score = Number(input.rating);
    if (!score || score < 1 || score > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    const ride = await this.db.query(`SELECT * FROM rides WHERE id = $1`, [input.rideId]);
    const r = ride.rows[0];
    if (!r) throw new Error('Ride not found');

    const { clean, flags, moderated } = this.moderateComment(input.comment || '');
    const tagList = Array.isArray(input.tags) ? input.tags.map(String) : [];

    const ratedUserId =
      input.raterRole === 'customer' ? r.driver_id : r.customer_id;

    await this.db.query(
      `INSERT INTO ride_ratings (
         ride_id, customer_id, driver_id, rating, comment, tags,
         rater_role, rater_id, moderated, moderation_flags, auto_submitted
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (ride_id, rater_role) DO UPDATE SET
         rating = EXCLUDED.rating,
         comment = EXCLUDED.comment,
         tags = EXCLUDED.tags,
         moderated = EXCLUDED.moderated,
         moderation_flags = EXCLUDED.moderation_flags,
         auto_submitted = EXCLUDED.auto_submitted`,
      [
        input.rideId,
        r.customer_id,
        r.driver_id,
        score,
        clean || null,
        tagList,
        input.raterRole,
        input.raterId,
        moderated,
        flags,
        Boolean(input.autoSubmitted),
      ]
    );

    if (input.raterRole === 'customer') {
      await this.db
        .query(
          `UPDATE rides SET rating = $1, review = $2, rating_tags = $3, updated_at = NOW()
           WHERE id = $4`,
          [score, clean || null, tagList, input.rideId]
        )
        .catch(async () => {
          await this.db.query(
            `UPDATE rides SET rating = $1, updated_at = NOW() WHERE id = $2`,
            [score, input.rideId]
          );
        });

      if (r.driver_id) {
        await this.db
          .query(
            `UPDATE drivers SET rating = (
               SELECT ROUND(AVG(rr.rating)::numeric, 2)
               FROM ride_ratings rr
               WHERE rr.driver_id = $1 AND rr.rater_role = 'customer'
             ) WHERE user_id = $1`,
            [r.driver_id]
          )
          .catch(() => undefined);
      }
    } else {
      await this.db
        .query(
          `UPDATE rides SET rider_rating = $1, rider_review = $2, updated_at = NOW()
           WHERE id = $3`,
          [score, clean || null, input.rideId]
        )
        .catch(() => undefined);

      if (r.customer_id) {
        await this.db
          .query(
            `UPDATE customers SET rating = (
               SELECT ROUND(AVG(rr.rating)::numeric, 2)
               FROM ride_ratings rr
               WHERE rr.customer_id = $1 AND rr.rater_role = 'driver'
             ) WHERE user_id = $1`,
            [r.customer_id]
          )
          .catch(() => undefined);
      }
    }

    return {
      rideId: input.rideId,
      rating: score,
      raterRole: input.raterRole,
      ratedUserId,
      moderated,
      autoSubmitted: Boolean(input.autoSubmitted),
    };
  }

  /**
   * Cron: completed rides past wait without a rating get a silent 5★ default.
   */
  async processAutoRatings(): Promise<{ prompted: number; autoRated: number }> {
    const waitHours = Math.max(
      1,
      parseInt(process.env.AUTO_REVIEW_HOURS || '24', 10) || 24
    );

    // Re-prompt recently completed without rating_prompted_at
    const needPrompt = await this.db.query(
      `SELECT id FROM rides
       WHERE status = 'completed'
         AND completed_at IS NOT NULL
         AND rating_prompted_at IS NULL
         AND completed_at > NOW() - INTERVAL '7 days'
       ORDER BY completed_at DESC
       LIMIT 40`
    );
    let prompted = 0;
    for (const row of needPrompt.rows) {
      try {
        await this.promptAfterComplete(row.id);
        prompted += 1;
      } catch {
        /* continue */
      }
    }

    const stale = await this.db.query(
      `SELECT id, customer_id, driver_id
       FROM rides
       WHERE status = 'completed'
         AND completed_at IS NOT NULL
         AND completed_at < NOW() - ($1 || ' hours')::interval
         AND auto_rated_at IS NULL
         AND completed_at > NOW() - INTERVAL '14 days'
       ORDER BY completed_at ASC
       LIMIT 40`,
      [String(waitHours)]
    );

    let autoRated = 0;
    for (const r of stale.rows) {
      try {
        const existing = await this.db.query(
          `SELECT rater_role FROM ride_ratings WHERE ride_id = $1`,
          [r.id]
        );
        const roles = new Set(existing.rows.map((x: any) => x.rater_role));

        if (r.customer_id && !roles.has('customer')) {
          await this.submitRating({
            rideId: r.id,
            raterId: r.customer_id,
            raterRole: 'customer',
            rating: 5,
            comment: '',
            autoSubmitted: true,
          });
        }
        if (r.driver_id && !roles.has('driver')) {
          await this.submitRating({
            rideId: r.id,
            raterId: r.driver_id,
            raterRole: 'driver',
            rating: 5,
            comment: '',
            autoSubmitted: true,
          });
        }

        await this.db.query(
          `UPDATE rides SET auto_rated_at = NOW() WHERE id = $1`,
          [r.id]
        );
        autoRated += 1;
      } catch (e: any) {
        this.logger.warn(`auto-rate failed ${r.id}: ${e?.message || e}`);
      }
    }

    return { prompted, autoRated };
  }
}
