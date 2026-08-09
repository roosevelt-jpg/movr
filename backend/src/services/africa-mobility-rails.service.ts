import crypto from 'crypto';
import { DatabaseService } from './database.service';
import { MatchingEngineService } from './matching-engine.service';
import { RideBookingService } from './ride-booking.service';
import { TrustSettlementService } from './trust-settlement.service';
import { PricingEngineService } from './pricing-engine.service';
import { WalletTransferService } from './wallet-transfer.service';
import getLogger from '../utils/logger';

/**
 * Africa mobility rails — facade composing wallet credit, channels, guarantees,
 * dual pricing, trust scores, family share, remittance gifts, and city corridors.
 */
export class AfricaMobilityRailsService {
  private logger = getLogger('africa-mobility-rails');
  private trust: TrustSettlementService;
  private pricing: PricingEngineService;
  private transfers: WalletTransferService;

  constructor(
    private db: DatabaseService,
    private matching: MatchingEngineService,
    private booking: RideBookingService
  ) {
    this.trust = new TrustSettlementService(db);
    this.pricing = new PricingEngineService(db);
    this.transfers = new WalletTransferService(db);
  }

  async isEnabled(): Promise<boolean> {
    try {
      const r = await this.db.query(
        `SELECT value FROM platform_settings WHERE key = 'africa_mobility_rails' LIMIT 1`
      );
      const v = r.rows[0]?.value;
      if (v && typeof v === 'object') return v.enabled !== false;
      if (typeof v === 'string') {
        const parsed = JSON.parse(v);
        return parsed.enabled !== false;
      }
    } catch {
      /* default on */
    }
    return true;
  }

  async getCatalog(countryCode = 'GH') {
    const vehicles = await this.db.query(
      `SELECT id, code, name, category, passenger_capacity, sort_order
       FROM vehicle_types
       WHERE is_active = TRUE
         AND code IN ('okada','keke','shared','economy','motorcycle','tricycle','standard','xl','express','premium')
       ORDER BY sort_order, name`
    );
    const modes = await this.pricing.listFareModes();
    const corridors = await this.db
      .query(
        `SELECT id, name, city, country_code, max_rider_fare, driver_min_payout,
                municipal_code, vehicle_codes, radius_km
         FROM mobility_corridors
         WHERE is_active = TRUE AND (country_code = $1 OR $1 IS NULL)
         ORDER BY city, name`,
        [countryCode]
      )
      .catch(() => ({ rows: [] as any[] }));

    const agents = await this.trust.listCashAgents({ countryCode });
    let promise: any = null;
    try {
      promise = await this.trust.getPromise(countryCode);
    } catch {
      promise = null;
    }

    return {
      vehicles: vehicles.rows.map((v: any) => ({
        ...v,
        africaLabel:
          v.code === 'motorcycle'
            ? 'Okada'
            : v.code === 'tricycle'
              ? 'Keke'
              : v.code === 'standard'
                ? 'Economy'
                : v.name,
      })),
      fareModes: modes,
      corridors: corridors.rows,
      cashAgents: Array.isArray(agents) ? agents : agents?.rows || [],
      channels: ['app', 'whatsapp', 'telegram', 'sms', 'ussd', 'ivr'],
      rails: [
        'mobility_credit',
        'driver_guarantees',
        'family_share',
        'corridors',
        'destination_prefs',
        'trust_scores',
        'remittance_gifts',
        'channel_first',
      ],
      promise,
      dualPricing: true,
      zeroTakeRate: true,
    };
  }

  /** Credit ring-fenced mobility balance (and main wallet for spend compatibility). */
  async topUpMobilityCredit(input: {
    userId: string;
    amount: number;
    currency?: string;
    source: string;
    reference?: string;
    meta?: any;
  }) {
    const amount = Number(input.amount);
    if (!amount || amount <= 0) throw new Error('Invalid amount');
    const currency = input.currency || 'GHS';
    const ref = input.reference || `MC-${crypto.randomBytes(6).toString('hex')}`;

    await this.db.query(
      `INSERT INTO wallets (user_id, balance_fiat, mobility_credit, currency)
       VALUES ($1, $2, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET
         mobility_credit = COALESCE(wallets.mobility_credit, 0) + $2,
         balance_fiat = wallets.balance_fiat + $2,
         last_updated = NOW()`,
      [input.userId, amount, currency]
    ).catch(async () => {
      await this.db.query(
        `UPDATE wallets SET balance_fiat = balance_fiat + $2, last_updated = NOW()
         WHERE user_id = $1`,
        [input.userId, amount]
      );
    });

    await this.db
      .query(
        `INSERT INTO mobility_credit_ledger (user_id, amount, currency, source, reference, meta)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
        [
          input.userId,
          amount,
          currency,
          input.source,
          ref,
          JSON.stringify(input.meta || {}),
        ]
      )
      .catch(() => undefined);

    await this.db
      .query(
        `INSERT INTO wallet_transactions (user_id, amount, type, description, reference)
         VALUES ($1,$2,'credit',$3,$4)`,
        [input.userId, amount, `Mobility credit · ${input.source}`, ref]
      )
      .catch(() => undefined);

    return this.getMobilityBalance(input.userId);
  }

  async getMobilityBalance(userId: string) {
    const w = await this.db.query(
      `SELECT balance_fiat, mobility_credit, currency FROM wallets WHERE user_id = $1`,
      [userId]
    );
    const row = w.rows[0] || { balance_fiat: 0, mobility_credit: 0, currency: 'GHS' };
    return {
      walletBalance: Number(row.balance_fiat || 0),
      mobilityCredit: Number(row.mobility_credit || 0),
      currency: row.currency || 'GHS',
    };
  }

  async spendMobilityCredit(userId: string, amount: number, reference: string) {
    const bal = await this.getMobilityBalance(userId);
    if (bal.mobilityCredit + bal.walletBalance < amount) {
      throw new Error('Insufficient mobility credit');
    }
    const fromCredit = Math.min(bal.mobilityCredit, amount);
    const fromWallet = amount - fromCredit;
    await this.db.query(
      `UPDATE wallets SET
         mobility_credit = GREATEST(0, COALESCE(mobility_credit,0) - $2),
         balance_fiat = balance_fiat - $3,
         last_updated = NOW()
       WHERE user_id = $1`,
      [userId, fromCredit, fromWallet]
    );
    await this.db
      .query(
        `INSERT INTO mobility_credit_ledger (user_id, amount, currency, source, reference)
         VALUES ($1,$2,$3,'ride_spend',$4)`,
        [userId, -amount, bal.currency, reference]
      )
      .catch(() => undefined);
    return { spent: amount, fromCredit, fromWallet };
  }

  /** Multi-modal quote: vehicles + fare modes + corridor caps. */
  async quote(input: {
    pickupLat: number;
    pickupLng: number;
    dropoffLat: number;
    dropoffLng: number;
    countryCode?: string;
    fareMode?: string;
    vehicleCode?: string;
  }) {
    const country = input.countryCode || 'GH';
    const estimate = await this.booking.estimateFares(
      input.pickupLat,
      input.pickupLng,
      input.dropoffLat,
      input.dropoffLng,
      country
    );

    const corridor = await this.findCorridor(
      input.pickupLat,
      input.pickupLng,
      input.dropoffLat,
      input.dropoffLng,
      country
    );

    const options = (estimate.options || []).map((o: any) => {
      let riderFare = Number(o.riderFare ?? o.price);
      let driverPayout = Number(o.driverPayout ?? riderFare);
      let corridorApplied = false;
      if (corridor && (!corridor.vehicle_codes?.length || corridor.vehicle_codes.includes(o.code))) {
        if (riderFare > Number(corridor.max_rider_fare)) {
          riderFare = Number(corridor.max_rider_fare);
          corridorApplied = true;
        }
        if (driverPayout < Number(corridor.driver_min_payout)) {
          driverPayout = Number(corridor.driver_min_payout);
          corridorApplied = true;
        }
      }
      return {
        ...o,
        riderFare,
        driverPayout,
        platformSubsidy: Math.max(0, driverPayout - riderFare),
        price: riderFare,
        corridorApplied,
        corridorId: corridorApplied ? corridor.id : null,
        corridorName: corridorApplied ? corridor.name : null,
      };
    });

    return {
      ...estimate,
      options,
      corridor: corridor
        ? {
            id: corridor.id,
            name: corridor.name,
            maxRiderFare: Number(corridor.max_rider_fare),
            driverMinPayout: Number(corridor.driver_min_payout),
            municipalCode: corridor.municipal_code,
          }
        : null,
      africaRails: true,
    };
  }

  async findCorridor(
    pickupLat: number,
    pickupLng: number,
    dropoffLat: number,
    dropoffLng: number,
    countryCode: string
  ) {
    const rows = await this.db
      .query(
        `SELECT * FROM mobility_corridors
         WHERE is_active = TRUE AND country_code = $1`,
        [countryCode]
      )
      .catch(() => ({ rows: [] as any[] }));

    let best: any = null;
    let bestScore = Infinity;
    for (const c of rows.rows) {
      if (c.origin_lat == null || c.dest_lat == null) continue;
      const oDist =
        Math.sqrt(
          Math.pow(pickupLat - Number(c.origin_lat), 2) +
            Math.pow(pickupLng - Number(c.origin_lng), 2)
        ) * 111;
      const dDist =
        Math.sqrt(
          Math.pow(dropoffLat - Number(c.dest_lat), 2) +
            Math.pow(dropoffLng - Number(c.dest_lng), 2)
        ) * 111;
      const r = Number(c.radius_km || 2.5);
      if (oDist <= r && dDist <= r) {
        const score = oDist + dDist;
        if (score < bestScore) {
          best = c;
          bestScore = score;
        }
      }
    }
    return best;
  }

  async book(input: {
    userId: string;
    pickupLat: number;
    pickupLng: number;
    dropoffLat: number;
    dropoffLng: number;
    pickupAddress?: string;
    dropoffAddress?: string;
    vehicleTypeCode?: string;
    fareMode?: string;
    sourceChannel?: string;
    countryCode?: string;
    payWithMobilityCredit?: boolean;
  }) {
    const quote = await this.quote({
      pickupLat: input.pickupLat,
      pickupLng: input.pickupLng,
      dropoffLat: input.dropoffLat,
      dropoffLng: input.dropoffLng,
      countryCode: input.countryCode,
      fareMode: input.fareMode,
      vehicleCode: input.vehicleTypeCode,
    });

    const result = await this.booking.createRideRequest({
      userId: input.userId,
      pickupLat: input.pickupLat,
      pickupLng: input.pickupLng,
      dropoffLat: input.dropoffLat,
      dropoffLng: input.dropoffLng,
      pickupAddress: input.pickupAddress,
      dropoffAddress: input.dropoffAddress,
      vehicleTypeCode: input.vehicleTypeCode,
      rideType: input.vehicleTypeCode,
      fareMode: input.fareMode || 'now',
      sourceChannel: (input.sourceChannel as any) || 'app',
      countryCode: input.countryCode,
    });

    // Apply corridor caps post-create if needed
    const opt = (quote.options || []).find(
      (o: any) => o.code === (input.vehicleTypeCode || o.code)
    ) || quote.options?.[0];
    if (opt?.corridorApplied && result.rideId) {
      await this.db
        .query(
          `UPDATE rides SET
             estimated_fare = $2,
             driver_earnings = $3,
             platform_subsidy = $4,
             pricing_meta = COALESCE(pricing_meta, '{}'::jsonb) || $5::jsonb
           WHERE id = $1`,
          [
            result.rideId,
            opt.riderFare,
            opt.driverPayout,
            opt.platformSubsidy,
            JSON.stringify({
              corridorId: opt.corridorId,
              corridorName: opt.corridorName,
              cityCoop: true,
            }),
          ]
        )
        .catch(() => undefined);
    }

    if (input.payWithMobilityCredit && result.rideId) {
      const fare = Number(opt?.riderFare ?? result.estimatedFare ?? 0);
      try {
        await this.spendMobilityCredit(input.userId, fare, `RIDE-${result.rideId}`);
      } catch (e: any) {
        this.logger.warn(`mobility credit pay skipped: ${e?.message}`);
      }
    }

    await this.logChannelEvent({
      channel: input.sourceChannel || 'app',
      userId: input.userId,
      rideId: result.rideId,
      eventType: 'booked',
      payload: { fareMode: input.fareMode, vehicle: input.vehicleTypeCode },
    });

    await this.recomputeTrustScore(input.userId).catch(() => undefined);

    return { ...result, quote, corridor: quote.corridor };
  }

  async logChannelEvent(input: {
    channel: string;
    sessionKey?: string;
    userId?: string;
    rideId?: string;
    eventType: string;
    payload?: any;
  }) {
    await this.db
      .query(
        `INSERT INTO channel_booking_events (channel, session_key, user_id, ride_id, event_type, payload)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
        [
          input.channel,
          input.sessionKey || null,
          input.userId || null,
          input.rideId || null,
          input.eventType,
          JSON.stringify(input.payload || {}),
        ]
      )
      .catch(() => undefined);
  }

  // --- Family share / diaspora gifts ---

  async createFamilyCircle(ownerId: string, name?: string, currency = 'GHS') {
    const row = await this.db.query(
      `INSERT INTO wallet_share_circles (owner_id, name, currency)
       VALUES ($1,$2,$3) RETURNING *`,
      [ownerId, name || 'Family rides', currency]
    );
    return row.rows[0];
  }

  async addFamilyMember(circleId: string, ownerId: string, memberId: string, dailyLimit = 50) {
    const circle = await this.db.query(
      `SELECT * FROM wallet_share_circles WHERE id = $1 AND owner_id = $2`,
      [circleId, ownerId]
    );
    if (!circle.rows[0]) throw new Error('Circle not found');
    const row = await this.db.query(
      `INSERT INTO wallet_share_members (circle_id, member_id, daily_limit)
       VALUES ($1,$2,$3)
       ON CONFLICT (circle_id, member_id) DO UPDATE SET
         daily_limit = EXCLUDED.daily_limit, status = 'active'
       RETURNING *`,
      [circleId, memberId, dailyLimit]
    );
    return row.rows[0];
  }

  async listFamilyCircles(userId: string) {
    const owned = await this.db.query(
      `SELECT c.*, 'owner' AS role FROM wallet_share_circles c WHERE owner_id = $1`,
      [userId]
    );
    const member = await this.db.query(
      `SELECT c.*, 'member' AS role, m.daily_limit, m.spent_today
       FROM wallet_share_members m
       JOIN wallet_share_circles c ON c.id = m.circle_id
       WHERE m.member_id = $1 AND m.status = 'active'`,
      [userId]
    );
    return [...owned.rows, ...member.rows];
  }

  /** Diaspora sends ride credit — claimable by phone or user id. */
  async createRemittanceGift(input: {
    senderId: string;
    amount: number;
    currency?: string;
    recipientPhone?: string;
    recipientId?: string;
    note?: string;
    ridesCount?: number;
  }) {
    const amount = Number(input.amount);
    if (!amount || amount <= 0) throw new Error('Invalid amount');
    const claimCode = crypto.randomBytes(4).toString('hex').toUpperCase();

    // Debit sender
    const bal = await this.getMobilityBalance(input.senderId);
    if (bal.walletBalance + bal.mobilityCredit < amount) {
      throw new Error('Insufficient balance to gift rides');
    }
    await this.db.query(
      `UPDATE wallets SET
         mobility_credit = GREATEST(0, COALESCE(mobility_credit,0) - LEAST(COALESCE(mobility_credit,0), $2)),
         balance_fiat = balance_fiat - GREATEST(0, $2 - LEAST(COALESCE(mobility_credit,0), $2)),
         last_updated = NOW()
       WHERE user_id = $1`,
      [input.senderId, amount]
    );

    const row = await this.db.query(
      `INSERT INTO remittance_ride_gifts (
         sender_id, recipient_id, recipient_phone, amount, currency,
         rides_remaining, note, status, claim_code
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8) RETURNING *`,
      [
        input.senderId,
        input.recipientId || null,
        input.recipientPhone || null,
        amount,
        input.currency || bal.currency,
        input.ridesCount || null,
        input.note || 'Family ride credit from diaspora',
        claimCode,
      ]
    );

    // If recipient already known, auto-claim
    if (input.recipientId) {
      return this.claimRemittanceGift(claimCode, input.recipientId);
    }
    return { ...row.rows[0], claimUrl: `/claim-rides/${claimCode}` };
  }

  async claimRemittanceGift(claimCode: string, recipientId: string) {
    const g = await this.db.query(
      `SELECT * FROM remittance_ride_gifts WHERE claim_code = $1 AND status = 'pending'`,
      [claimCode]
    );
    const gift = g.rows[0];
    if (!gift) throw new Error('Gift not found or already claimed');

    await this.topUpMobilityCredit({
      userId: recipientId,
      amount: Number(gift.amount),
      currency: gift.currency,
      source: 'remittance',
      reference: `GIFT-${gift.id}`,
      meta: { senderId: gift.sender_id, note: gift.note },
    });

    const updated = await this.db.query(
      `UPDATE remittance_ride_gifts SET
         status = 'claimed', recipient_id = $2, claimed_at = NOW()
       WHERE id = $1 RETURNING *`,
      [gift.id, recipientId]
    );
    return updated.rows[0];
  }

  // --- Driver guarantees + destination ---

  async setDestinationPref(input: {
    driverId: string;
    destLat: number;
    destLng: number;
    label?: string;
    radiusKm?: number;
    hours?: number;
    bonusAccept?: number;
  }) {
    const hours = Math.max(1, Number(input.hours || 3));
    const row = await this.db.query(
      `INSERT INTO driver_destination_prefs (
         driver_id, label, dest_lat, dest_lng, radius_km, bonus_accept, active_until
       ) VALUES ($1,$2,$3,$4,$5,$6, NOW() + ($7 || ' hours')::interval)
       ON CONFLICT (driver_id) DO UPDATE SET
         label = EXCLUDED.label,
         dest_lat = EXCLUDED.dest_lat,
         dest_lng = EXCLUDED.dest_lng,
         radius_km = EXCLUDED.radius_km,
         bonus_accept = EXCLUDED.bonus_accept,
         active_until = EXCLUDED.active_until
       RETURNING *`,
      [
        input.driverId,
        input.label || 'Going home / demand',
        input.destLat,
        input.destLng,
        input.radiusKm ?? 3,
        input.bonusAccept ?? 0,
        String(hours),
      ]
    );
    return row.rows[0];
  }

  async clearDestinationPref(driverId: string) {
    await this.db.query(`DELETE FROM driver_destination_prefs WHERE driver_id = $1`, [driverId]);
    return { cleared: true };
  }

  async enrollGuarantee(input: {
    driverId: string;
    minAmount?: number;
    windowHours?: number;
    zoneId?: string;
    currency?: string;
  }) {
    const cfg = await this.settingJson();
    const hours = Number(input.windowHours || cfg.guarantee_window_hours || 4);
    const minAmount = Number(
      input.minAmount || (cfg.default_guarantee_hourly || 25) * hours
    );
    // Cancel overlapping active
    await this.db.query(
      `UPDATE driver_earnings_guarantees SET status = 'cancelled'
       WHERE driver_id = $1 AND status = 'active'`,
      [input.driverId]
    );
    const row = await this.db.query(
      `INSERT INTO driver_earnings_guarantees (
         driver_id, window_start, window_end, min_amount, currency, zone_id, status
       ) VALUES ($1, NOW(), NOW() + ($2 || ' hours')::interval, $3, $4, $5, 'active')
       RETURNING *`,
      [
        input.driverId,
        String(hours),
        minAmount,
        input.currency || 'GHS',
        input.zoneId || null,
      ]
    );
    return row.rows[0];
  }

  async recordGuaranteeEarnings(driverId: string, amount: number) {
    await this.db.query(
      `UPDATE driver_earnings_guarantees SET
         earned_amount = earned_amount + $2
       WHERE driver_id = $1 AND status = 'active' AND window_end > NOW()`,
      [driverId, amount]
    );
  }

  /** Cron: top up drivers who finished window below floor. */
  async settleGuarantees(): Promise<{ toppedUp: number; fulfilled: number }> {
    const due = await this.db.query(
      `SELECT * FROM driver_earnings_guarantees
       WHERE status = 'active' AND window_end <= NOW()
       ORDER BY window_end ASC
       LIMIT 50`
    );
    let toppedUp = 0;
    let fulfilled = 0;
    for (const g of due.rows) {
      const earned = Number(g.earned_amount || 0);
      const min = Number(g.min_amount || 0);
      const gap = Math.max(0, min - earned);
      if (gap > 0) {
        await this.db.query(
          `UPDATE wallets SET balance_fiat = balance_fiat + $2, last_updated = NOW()
           WHERE user_id = $1`,
          [g.driver_id, gap]
        );
        await this.db
          .query(
            `INSERT INTO wallet_transactions (user_id, amount, type, description, reference)
             VALUES ($1,$2,'credit',$3,$4)`,
            [g.driver_id, gap, 'Driver income guarantee top-up', `GUARANTEE-${g.id}`]
          )
          .catch(() => undefined);
        await this.db.query(
          `UPDATE driver_earnings_guarantees SET
             status = 'topped_up', topup_amount = $2, settled_at = NOW()
           WHERE id = $1`,
          [g.id, gap]
        );
        toppedUp += 1;
      } else {
        await this.db.query(
          `UPDATE driver_earnings_guarantees SET status = 'fulfilled', settled_at = NOW()
           WHERE id = $1`,
          [g.id]
        );
        fulfilled += 1;
      }
    }
    return { toppedUp, fulfilled };
  }

  // --- Trust scores ---

  async recomputeTrustScore(userId: string) {
    const rides = await this.db.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
         COUNT(*) FILTER (WHERE cancellation_reason ILIKE '%no_show%')::int AS noshows
       FROM rides WHERE customer_id = $1 OR driver_id = $1`,
      [userId]
    );
    const disputes = await this.db
      .query(
        `SELECT COUNT(*)::int AS c FROM unified_disputes
         WHERE user_id = $1 AND status = 'rejected'`,
        [userId]
      )
      .catch(() => ({ rows: [{ c: 0 }] }));

    const kyc = await this.db
      .query(
        `SELECT status FROM kyc_attestations WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1`,
        [userId]
      )
      .catch(() => ({ rows: [] as any[] }));

    const completed = Number(rides.rows[0]?.completed || 0);
    const noshows = Number(rides.rows[0]?.noshows || 0);
    const lost = Number(disputes.rows[0]?.c || 0);
    const kycBoost = /approved|verified/i.test(String(kyc.rows[0]?.status || '')) ? 10 : 0;
    const score = Math.max(
      0,
      Math.min(100, 70 + Math.min(20, completed * 0.5) + kycBoost - noshows * 5 - lost * 8)
    );

    await this.db.query(
      `INSERT INTO mobility_trust_scores (
         user_id, score, rides_completed, disputes_lost, no_shows, kyc_boost, last_computed_at
       ) VALUES ($1,$2,$3,$4,$5,$6,NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         score = EXCLUDED.score,
         rides_completed = EXCLUDED.rides_completed,
         disputes_lost = EXCLUDED.disputes_lost,
         no_shows = EXCLUDED.no_shows,
         kyc_boost = EXCLUDED.kyc_boost,
         last_computed_at = NOW(),
         updated_at = NOW()`,
      [userId, score, completed, lost, noshows, kycBoost]
    );
    return { userId, score, completed, noshows, lost, kycBoost };
  }

  async getTrustScore(userId: string) {
    const row = await this.db.query(
      `SELECT * FROM mobility_trust_scores WHERE user_id = $1`,
      [userId]
    );
    if (row.rows[0]) return row.rows[0];
    return this.recomputeTrustScore(userId);
  }

  private async settingJson(): Promise<any> {
    try {
      const r = await this.db.query(
        `SELECT value FROM platform_settings WHERE key = 'africa_mobility_rails' LIMIT 1`
      );
      const v = r.rows[0]?.value;
      if (v && typeof v === 'object') return v;
      if (typeof v === 'string') return JSON.parse(v);
    } catch {
      /* */
    }
    return {};
  }
}
