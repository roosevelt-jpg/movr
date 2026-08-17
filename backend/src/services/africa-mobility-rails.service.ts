import crypto from 'crypto';
import { DatabaseService } from './database.service';
import { MatchingEngineService } from './matching-engine.service';
import { RideBookingService } from './ride-booking.service';
import { TrustSettlementService } from './trust-settlement.service';
import { PricingEngineService } from './pricing-engine.service';
import { WalletTransferService } from './wallet-transfer.service';
import { WalletLedgerService, normalizePayMethod, PayMethod } from './wallet-ledger.service';
import { PaymentService } from './payment.service';
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
  private ledger: WalletLedgerService;
  private payments: PaymentService;

  constructor(
    private db: DatabaseService,
    private matching: MatchingEngineService,
    private booking: RideBookingService
  ) {
    this.trust = new TrustSettlementService(db);
    this.pricing = new PricingEngineService(db);
    this.transfers = new WalletTransferService(db);
    this.ledger = new WalletLedgerService(db);
    this.payments = new PaymentService(db);
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
    const walletBalance = Number(row.balance_fiat || 0);
    const mobilityCredit = Number(row.mobility_credit || 0);
    return {
      walletBalance,
      mobilityCredit,
      spendable: walletBalance + mobilityCredit,
      currency: row.currency || 'GHS',
    };
  }

  /** Resolve who pays: rider wallet first, else an active family circle owner. */
  async resolveRidePayer(userId: string, amount: number) {
    const bal = await this.getMobilityBalance(userId);
    if (bal.mobilityCredit + bal.walletBalance >= amount) {
      return { payerId: userId, viaFamily: false as const, membership: null as any, currency: bal.currency };
    }

    const today = new Date().toISOString().slice(0, 10);
    const memberships = await this.db
      .query(
        `SELECT m.*, c.owner_id, c.currency AS circle_currency
         FROM wallet_share_members m
         JOIN wallet_share_circles c ON c.id = m.circle_id
         WHERE m.member_id = $1 AND m.status = 'active'
         ORDER BY m.created_at ASC`,
        [userId]
      )
      .catch(() => ({ rows: [] as any[] }));

    for (const m of memberships.rows) {
      const spentToday =
        m.spent_on && String(m.spent_on).slice(0, 10) === today ? Number(m.spent_today || 0) : 0;
      const remaining = Number(m.daily_limit || 0) - spentToday;
      if (remaining < amount) continue;
      const ownerBal = await this.getMobilityBalance(m.owner_id);
      if (ownerBal.mobilityCredit + ownerBal.walletBalance >= amount) {
        return {
          payerId: m.owner_id,
          viaFamily: true as const,
          membership: m,
          currency: ownerBal.currency || m.circle_currency || 'GHS',
        };
      }
    }

    throw new Error(
      `Insufficient mobility credit (need ${amount} ${bal.currency}, have ${
        bal.mobilityCredit + bal.walletBalance
      })`
    );
  }

  async spendMobilityCredit(userId: string, amount: number, reference: string) {
    const spend = await this.ledger.spendForRide(userId, amount, reference);
    return {
      spent: spend.amount,
      fromCredit: spend.fromCredit,
      fromWallet: spend.fromWallet,
      payerId: spend.payerId,
      viaFamily: spend.viaFamily,
      circleId: spend.circleId,
    };
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
      const inOrigin = c.origin_polygon
        ? this.pointInPolygon(pickupLng, pickupLat, c.origin_polygon)
        : null;
      const inDest = c.dest_polygon
        ? this.pointInPolygon(dropoffLng, dropoffLat, c.dest_polygon)
        : null;
      if (inOrigin === true && inDest === true) {
        return c;
      }

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

  /** GeoJSON Polygon point-in-polygon (lng, lat). */
  pointInPolygon(lng: number, lat: number, polygon: any): boolean {
    try {
      const rings = polygon?.coordinates?.[0];
      if (!Array.isArray(rings) || rings.length < 3) return false;
      let inside = false;
      for (let i = 0, j = rings.length - 1; i < rings.length; j = i++) {
        const xi = Number(rings[i][0]);
        const yi = Number(rings[i][1]);
        const xj = Number(rings[j][0]);
        const yj = Number(rings[j][1]);
        const intersect =
          yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi;
        if (intersect) inside = !inside;
      }
      return inside;
    } catch {
      return false;
    }
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
    paymentMethod?: string;
    paymentMethodId?: string;
    email?: string;
    phone?: string;
    fullName?: string;
    /** Hold ride until share pool dispatches one vehicle. */
    skipAutoAssign?: boolean;
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

    const method = normalizePayMethod(input.paymentMethod, input.payWithMobilityCredit);
    const chargeNow = !input.skipAutoAssign && input.fareMode !== 'share';
    const payWallet = chargeNow && method === 'wallet';

    if (payWallet) {
      const fare = Number(
        (quote.options || []).find((o: any) => o.code === (input.vehicleTypeCode || o.code))
          ?.riderFare ??
          quote.options?.[0]?.riderFare ??
          0
      );
      if (fare > 0) {
        // Includes family-circle owner wallet when member balance is short
        await this.resolveRidePayer(input.userId, fare);
      }
    }

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
      skipAutoAssign: Boolean(input.skipAutoAssign || input.fareMode === 'share'),
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

    if (payWallet && result.rideId) {
      const fare = Number(opt?.riderFare ?? result.estimatedFare ?? 0);
      try {
        const spend = await this.spendMobilityCredit(input.userId, fare, `RIDE-${result.rideId}`);
        await this.db
          .query(
            `UPDATE rides SET
               payment_method = 'wallet',
               payment_status = 'paid',
               pricing_meta = COALESCE(pricing_meta, '{}'::jsonb) || $2::jsonb
             WHERE id = $1`,
            [
              result.rideId,
              JSON.stringify({
                paidWithWallet: true,
                paidWithMobilityCredit: Number(spend.fromCredit || 0) > 0,
                fare,
                payerId: spend.payerId,
                viaFamily: spend.viaFamily,
                circleId: spend.circleId,
                fromCredit: spend.fromCredit,
                fromWallet: spend.fromWallet,
                paymentMethodId: input.paymentMethodId || null,
              }),
            ]
          )
          .catch(() => undefined);
      } catch (e: any) {
        await this.db
          .query(
            `UPDATE rides SET status = 'cancelled',
               cancellation_reason = 'wallet_pay_failed',
               updated_at = NOW()
             WHERE id = $1`,
            [result.rideId]
          )
          .catch(() => undefined);
        throw e;
      }
    }

    let checkout: any = null;
    if (chargeNow && (method === 'card' || method === 'momo') && result.rideId) {
      const fare = Number(opt?.riderFare ?? result.estimatedFare ?? 0);
      checkout = await this.startFareCheckout({
        userId: input.userId,
        amount: fare,
        rideId: result.rideId,
        method,
        paymentMethodId: input.paymentMethodId,
        countryCode: input.countryCode,
        email: input.email,
        phone: input.phone,
        fullName: input.fullName,
        currency: quote.currency,
      });
    } else if (!chargeNow && result.rideId) {
      await this.db
        .query(
          `UPDATE rides SET payment_method = $2, payment_status = 'pending' WHERE id = $1`,
          [result.rideId, method]
        )
        .catch(() => undefined);
    }

    await this.logChannelEvent({
      channel: input.sourceChannel || 'app',
      userId: input.userId,
      rideId: result.rideId,
      eventType: 'booked',
      payload: {
        fareMode: input.fareMode,
        vehicle: input.vehicleTypeCode,
        paymentMethod: method,
      },
    });

    await this.recomputeTrustScore(input.userId).catch(() => undefined);

    return {
      ...result,
      quote,
      corridor: quote.corridor,
      paymentMethod: method,
      payment: checkout,
    };
  }

  private async startFareCheckout(input: {
    userId: string;
    amount: number;
    rideId: string;
    method: PayMethod;
    paymentMethodId?: string;
    countryCode?: string;
    email?: string;
    phone?: string;
    fullName?: string;
    currency?: string;
  }) {
    const fare = Number(input.amount);
    const user = await this.db.query(
      `SELECT email, phone,
              TRIM(CONCAT(COALESCE(first_name,''), ' ', COALESCE(last_name,''))) AS full_name
       FROM users WHERE id = $1`,
      [input.userId]
    );
    const profile = user.rows[0] || {};
    const payment = await this.payments.initializePayment({
      userId: input.userId,
      amount: fare,
      currency: input.currency || 'GHS',
      paymentType: 'ride',
      email: input.email || profile.email,
      fullName: input.fullName || profile.full_name || 'Movr rider',
      phone: input.phone || profile.phone,
      countryCode: input.countryCode,
      metadata: {
        rideId: input.rideId,
        channel: input.method,
        paymentMethodId: input.paymentMethodId || null,
      },
    });
    if (!payment?.success) {
      await this.db
        .query(
          `UPDATE rides SET status = 'cancelled', cancellation_reason = 'gateway_init_failed', updated_at = NOW()
           WHERE id = $1`,
          [input.rideId]
        )
        .catch(() => undefined);
      throw new Error(
        payment?.error ||
          `Could not start ${input.method === 'momo' ? 'MoMo' : 'card'} payment. Pay with wallet or add a method.`
      );
    }
    await this.db
      .query(
        `UPDATE rides SET
           payment_method = $2,
           payment_status = 'pending',
           pricing_meta = COALESCE(pricing_meta, '{}'::jsonb) || $3::jsonb
         WHERE id = $1`,
        [
          input.rideId,
          input.method,
          JSON.stringify({
            paymentReference: payment.reference,
            paymentMethodId: input.paymentMethodId || null,
            awaitingGateway: true,
          }),
        ]
      )
      .catch(() => undefined);
    return payment;
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
    /** When true, caller already debited sender (corridor FX path). */
    skipDebit?: boolean;
  }) {
    const amount = Number(input.amount);
    if (!amount || amount <= 0) throw new Error('Invalid amount');
    const claimCode = crypto.randomBytes(4).toString('hex').toUpperCase();

    const bal = await this.getMobilityBalance(input.senderId);
    if (!input.skipDebit) {
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
    }

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
    const driverKyc = await this.db
      .query(`SELECT kyc_status FROM drivers WHERE user_id = $1 LIMIT 1`, [userId])
      .catch(() => ({ rows: [] as any[] }));

    const completed = Number(rides.rows[0]?.completed || 0);
    const noshows = Number(rides.rows[0]?.noshows || 0);
    const lost = Number(disputes.rows[0]?.c || 0);
    const kycBoost =
      /approved|verified/i.test(String(kyc.rows[0]?.status || '')) ||
      /approved|verified/i.test(String(driverKyc.rows[0]?.kyc_status || ''))
        ? 10
        : 0;
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

  /** Start MoMo/card gateway top-up that credits mobility_credit on webhook. */
  async startMobilityTopUp(input: {
    userId: string;
    amount: number;
    currency?: string;
    source?: string;
    provider?: string;
    email?: string;
    phone?: string;
    countryCode?: string;
  }) {
    const amount = Number(input.amount);
    if (!amount || amount <= 0) throw new Error('Invalid amount');
    const source = String(input.source || 'momo');
    const currency = input.currency || 'GHS';

    if (source === 'airtime' || source === 'salary') {
      const intent = await this.db.query(
        `INSERT INTO mobility_topup_intents (user_id, amount, currency, source, provider, status, meta)
         VALUES ($1,$2,$3,$4,$5,'pending',$6::jsonb) RETURNING *`,
        [
          input.userId,
          amount,
          currency,
          source,
          source === 'airtime' ? 'airtime_gateway' : 'payroll',
          JSON.stringify({ phone: input.phone || null }),
        ]
      );
      // Never auto-complete airtime/salary in production — even if AUTO_COMPLETE is set
      const allowDemoAlt =
        process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEMO_TOPUPS !== 'false';
      if (allowDemoAlt) {
        await this.topUpMobilityCredit({
          userId: input.userId,
          amount,
          currency,
          source,
          reference: `ALT-${intent.rows[0].id}`,
        });
        await this.db.query(
          `UPDATE mobility_topup_intents SET status = 'completed', completed_at = NOW() WHERE id = $1`,
          [intent.rows[0].id]
        );
        return {
          mode: 'instant',
          source,
          intent: { ...intent.rows[0], status: 'completed' },
          balance: await this.getMobilityBalance(input.userId),
          demo: true,
        };
      }
      return { mode: 'pending_provider', intent: intent.rows[0] };
    }

    const { PaymentService } = require('./payment.service');
    const payments = new PaymentService(this.db);

    // Demo MoMo/card only outside production. Live keys required for production.
    const demoComplete =
      process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEMO_TOPUPS !== 'false';

    let init: any;
    try {
      init = await payments.initializePayment({
        userId: input.userId,
        amount,
        currency,
        paymentType: 'mobility' as any,
        email: input.email || `user-${input.userId.slice(0, 8)}@mymovr.io`,
        fullName: 'Movr Rider',
        phone: input.phone,
        countryCode: input.countryCode || 'GH',
        metadata: {
          mobility: true,
          source,
          provider: input.provider || 'paystack',
          paymentType: 'mobility',
        },
      });
    } catch (e: any) {
      if (!demoComplete) throw e;
      init = { success: false, message: e?.message };
    }

    if (!init?.success || !init?.paymentLink) {
      if (demoComplete) {
        const intent = await this.db.query(
          `INSERT INTO mobility_topup_intents (user_id, amount, currency, source, provider, status, meta)
           VALUES ($1,$2,$3,$4,$5,'completed',$6::jsonb) RETURNING *`,
          [
            input.userId,
            amount,
            currency,
            source,
            input.provider || 'paystack',
            JSON.stringify({ demo: true, reason: init?.message || 'no_gateway' }),
          ]
        );
        await this.topUpMobilityCredit({
          userId: input.userId,
          amount,
          currency,
          source,
          reference: `DEMO-${intent.rows[0].id}`,
        });
        return {
          mode: 'instant',
          source,
          intent: intent.rows[0],
          balance: await this.getMobilityBalance(input.userId),
          demo: true,
        };
      }
      throw new Error(
        init?.message ||
          'Payment gateway unavailable — set live Paystack/Flutterwave keys (Integrations Hub or env)'
      );
    }

    const ref = init.reference || init.txRef || init.data?.reference;
    await this.db
      .query(
        `INSERT INTO mobility_topup_intents (
           user_id, amount, currency, source, provider, status, payment_reference, meta
         ) VALUES ($1,$2,$3,$4,$5,'awaiting_payment',$6,$7::jsonb)`,
        [
          input.userId,
          amount,
          currency,
          source,
          input.provider || 'paystack',
          ref || null,
          JSON.stringify({ init }),
        ]
      )
      .catch(() => undefined);

    return {
      mode: 'gateway',
      payment: {
        ...init,
        authorization_url: init.paymentLink,
        checkoutUrl: init.paymentLink,
        paymentLink: init.paymentLink,
      },
      source,
    };
  }

  private async sharePoolSettings() {
    try {
      const r = await this.db.query(
        `SELECT value FROM platform_settings WHERE key = 'share_pool_dispatch' LIMIT 1`
      );
      const v = r.rows[0]?.value;
      const parsed = typeof v === 'string' ? JSON.parse(v) : v || {};
      return {
        waitSeconds: Number(parsed.waitSeconds ?? 180),
        maxRiders: Number(parsed.maxRiders ?? 3),
        equalFareSplit: parsed.equalFareSplit !== false,
      };
    } catch {
      return { waitSeconds: 180, maxRiders: 3, equalFareSplit: true };
    }
  }

  /**
   * Join (or open) a share pool. Rides stay unmatched until the pool is full
   * or match_after elapses — then one driver is assigned and fares are split.
   */
  async joinSharePool(input: {
    userId: string;
    pickupLat: number;
    pickupLng: number;
    dropoffLat: number;
    dropoffLng: number;
    pickupAddress?: string;
    dropoffAddress?: string;
    countryCode?: string;
    payWithMobilityCredit?: boolean;
    paymentMethod?: string;
    paymentMethodId?: string;
    email?: string;
    phone?: string;
    fullName?: string;
  }) {
    const country = input.countryCode || 'GH';
    const settings = await this.sharePoolSettings();
    const open = await this.db.query(
      `SELECT * FROM share_pools
       WHERE status IN ('open','waiting','matching') AND rider_count < max_riders
         AND COALESCE(country_code,'GH') = $1
         AND driver_id IS NULL
       ORDER BY created_at ASC LIMIT 40`,
      [country]
    );

    let pool = open.rows.find((p: any) => {
      const o =
        Math.sqrt(
          Math.pow(input.pickupLat - Number(p.origin_lat), 2) +
            Math.pow(input.pickupLng - Number(p.origin_lng), 2)
        ) * 111;
      const d =
        Math.sqrt(
          Math.pow(input.dropoffLat - Number(p.dest_lat), 2) +
            Math.pow(input.dropoffLng - Number(p.dest_lng), 2)
        ) * 111;
      return o <= Number(p.pickup_radius_km || 1.2) && d <= Number(p.dropoff_radius_km || 1.5);
    });

    if (!pool) {
      const created = await this.db.query(
        `INSERT INTO share_pools (
           origin_lat, origin_lng, dest_lat, dest_lng, country_code, status, rider_count,
           max_riders, match_after, matching_started_at
         ) VALUES (
           $1,$2,$3,$4,$5,'waiting',0,$6,
           NOW() + ($7::text || ' seconds')::interval, NOW()
         ) RETURNING *`,
        [
          input.pickupLat,
          input.pickupLng,
          input.dropoffLat,
          input.dropoffLng,
          country,
          settings.maxRiders,
          String(settings.waitSeconds),
        ]
      );
      pool = created.rows[0];
    }

    const method = normalizePayMethod(input.paymentMethod, input.payWithMobilityCredit);
    const booked = await this.book({
      userId: input.userId,
      pickupLat: input.pickupLat,
      pickupLng: input.pickupLng,
      dropoffLat: input.dropoffLat,
      dropoffLng: input.dropoffLng,
      pickupAddress: input.pickupAddress,
      dropoffAddress: input.dropoffAddress,
      vehicleTypeCode: 'shared',
      fareMode: 'share',
      sourceChannel: 'app',
      countryCode: country,
      paymentMethod: method,
      payWithMobilityCredit: method === 'wallet',
      skipAutoAssign: true,
      email: input.email,
      phone: input.phone,
      fullName: input.fullName,
    });

    const rideId = booked.rideId || booked.id;
    await this.db.query(
      `INSERT INTO share_pool_members (
         pool_id, user_id, ride_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, pay_with_credit
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (pool_id, user_id) DO UPDATE SET
         ride_id = EXCLUDED.ride_id,
         pay_with_credit = EXCLUDED.pay_with_credit`,
      [
        pool.id,
        input.userId,
        rideId,
        input.pickupLat,
        input.pickupLng,
        input.dropoffLat,
        input.dropoffLng,
        method === 'wallet',
      ]
    );

    const updated = await this.db.query(
      `UPDATE share_pools SET
         rider_count = rider_count + 1,
         ride_ids = array_append(COALESCE(ride_ids,'{}'), $2::uuid),
         status = CASE
           WHEN rider_count + 1 >= max_riders THEN 'full'
           ELSE 'waiting'
         END
       WHERE id = $1 RETURNING *`,
      [pool.id, rideId]
    );
    pool = updated.rows[0];

    let dispatch: any = null;
    if (Number(pool.rider_count) >= Number(pool.max_riders)) {
      dispatch = await this.dispatchSharePool(pool.id);
    }

    return {
      pool: dispatch?.pool || pool,
      booking: booked,
      waitingForRiders: !dispatch,
      sharedVehicle: Boolean(dispatch?.driverId),
      fareSplit: dispatch?.fareSplit || null,
      dispatch,
    };
  }

  /** Assign one driver to every ride in the pool and apply equal fare split. */
  async dispatchSharePool(poolId: string) {
    const poolRes = await this.db.query(`SELECT * FROM share_pools WHERE id = $1`, [poolId]);
    const pool = poolRes.rows[0];
    if (!pool) throw new Error('Pool not found');
    if (pool.driver_id) {
      return { pool, driverId: pool.driver_id, alreadyDispatched: true };
    }
    if (Number(pool.rider_count || 0) < 1) {
      return { pool, skipped: true, reason: 'empty' };
    }

    const members = await this.db.query(
      `SELECT m.*, r.estimated_fare, r.driver_earnings, r.user_id AS rider_user_id,
              r.pickup_latitude, r.pickup_longitude, r.payment_method, r.payment_status
       FROM share_pool_members m
       LEFT JOIN rides r ON r.id = m.ride_id
       WHERE m.pool_id = $1
       ORDER BY m.created_at ASC`,
      [poolId]
    );
    const rows = members.rows.filter((m: any) => m.ride_id);
    if (!rows.length) return { pool, skipped: true, reason: 'no_rides' };

    const n = rows.length;
    const settings = await this.sharePoolSettings();
    const soloFares = rows.map((m: any) => Number(m.estimated_fare || 0));
    const soloSum = soloFares.reduce((a: number, b: number) => a + b, 0) || 0;
    const discount = n >= 3 ? 0.65 : n === 2 ? 0.75 : 1;
    const perRider =
      settings.equalFareSplit && soloSum > 0
        ? Math.round(((soloSum / n) * discount + Number.EPSILON) * 100) / 100
        : null;
    const totalFare = perRider != null ? Math.round(perRider * n * 100) / 100 : soloSum;
    const baseDriver = Math.max(
      ...rows.map((m: any) => Number(m.driver_earnings || m.estimated_fare || 0)),
      0
    );
    const driverPayout = Math.round(baseDriver * (1 + 0.25 * (n - 1)) * 100) / 100;

    const avgLat =
      rows.reduce(
        (s: number, m: any) => s + Number(m.pickup_lat || m.pickup_latitude || pool.origin_lat),
        0
      ) / n;
    const avgLng =
      rows.reduce(
        (s: number, m: any) => s + Number(m.pickup_lng || m.pickup_longitude || pool.origin_lng),
        0
      ) / n;

    const drivers = await this.matching.findBestDrivers(avgLat, avgLng, 'shared');
    const driverId = drivers?.[0]?.id || drivers?.[0]?.driver_id || drivers?.[0]?.user_id;
    if (!driverId) {
      await this.db.query(
        `UPDATE share_pools SET status = 'matching', matching_started_at = COALESCE(matching_started_at, NOW())
         WHERE id = $1`,
        [poolId]
      );
      // Release rides back into normal matching so they are not stuck forever
      for (const m of rows) {
        await this.db
          .query(
            `UPDATE rides SET status = 'requested',
               pricing_meta = COALESCE(pricing_meta, '{}'::jsonb) || '{"poolWaiting":false,"poolMatching":true}'::jsonb
             WHERE id = $1 AND driver_id IS NULL`,
            [m.ride_id]
          )
          .catch(() => undefined);
        try {
          await this.matching.findBestDrivers(
            Number(m.pickup_lat || m.pickup_latitude),
            Number(m.pickup_lng || m.pickup_longitude),
            'shared'
          );
        } catch {
          /* */
        }
      }
      return { pool, skipped: true, reason: 'no_driver', fareSplit: { perRider, totalFare, driverPayout } };
    }

    for (const m of rows) {
      const fareShare = perRider != null ? perRider : Number(m.estimated_fare || 0);
      await this.db
        .query(
          `UPDATE rides SET
             estimated_fare = $2,
             driver_earnings = $3,
             fare_mode = 'share',
             pricing_meta = COALESCE(pricing_meta, '{}'::jsonb) || $4::jsonb
           WHERE id = $1`,
          [
            m.ride_id,
            fareShare,
            Math.round((driverPayout / n) * 100) / 100,
            JSON.stringify({
              sharePoolId: poolId,
              fareShare,
              sharedVehicle: true,
              poolRiders: n,
            }),
          ]
        )
        .catch(() => undefined);

      await this.db
        .query(`UPDATE share_pool_members SET fare_share = $2, status = 'dispatched' WHERE id = $1`, [
          m.id,
          fareShare,
        ])
        .catch(() => undefined);

      await this.matching.assignRideToDriver(m.ride_id, driverId);

      const payWallet =
        m.pay_with_credit !== false &&
        normalizePayMethod(m.payment_method, m.pay_with_credit !== false) === 'wallet';
      if (payWallet && fareShare > 0) {
        try {
          const spend = await this.spendMobilityCredit(
            m.user_id || m.rider_user_id,
            fareShare,
            `POOL-${poolId}-${m.ride_id}`
          );
          await this.db
            .query(
              `UPDATE rides SET
                 payment_method = 'wallet',
                 payment_status = 'paid',
                 pricing_meta = COALESCE(pricing_meta, '{}'::jsonb) || $2::jsonb
               WHERE id = $1`,
              [
                m.ride_id,
                JSON.stringify({
                  paidWithWallet: true,
                  fare: fareShare,
                  payerId: spend.payerId,
                  viaFamily: spend.viaFamily,
                  fromCredit: spend.fromCredit,
                  fromWallet: spend.fromWallet,
                }),
              ]
            )
            .catch(() => undefined);
        } catch (e: any) {
          this.logger.warn(`pool wallet pay fail ${m.ride_id}: ${e?.message || e}`);
          throw e;
        }
      }
    }

    const updated = await this.db.query(
      `UPDATE share_pools SET
         driver_id = $2,
         status = 'en_route',
         total_fare = $3,
         per_rider_fare = $4,
         driver_payout = $5,
         closed_at = NULL
       WHERE id = $1 RETURNING *`,
      [poolId, driverId, totalFare, perRider, driverPayout]
    );

    return {
      pool: updated.rows[0],
      driverId,
      fareSplit: { perRider, totalFare, driverPayout, riders: n, discount },
    };
  }

  /** Job: dispatch full pools and timed-out waiting pools (same vehicle + fare split). */
  async processSharePools() {
    const due = await this.db
      .query(
        `SELECT id FROM share_pools
         WHERE driver_id IS NULL
           AND status IN ('open','waiting','matching','full')
           AND rider_count >= 1
           AND (
             rider_count >= max_riders
             OR match_after IS NULL
             OR match_after <= NOW()
           )
         ORDER BY created_at ASC
         LIMIT 20`
      )
      .catch(() => ({ rows: [] as any[] }));

    let dispatched = 0;
    for (const row of due.rows) {
      try {
        const r = await this.dispatchSharePool(row.id);
        if (r?.driverId && !r.alreadyDispatched) dispatched += 1;
      } catch (e: any) {
        this.logger.warn(`share pool ${row.id}: ${e?.message || e}`);
      }
    }
    return { checked: due.rows.length, dispatched };
  }

  async listRemittanceCorridors() {
    return (
      await this.db
        .query(`SELECT * FROM remittance_corridors WHERE is_active = TRUE ORDER BY name`)
        .catch(() => ({ rows: [] as any[] }))
    ).rows;
  }

  async quoteRemittanceGift(input: { corridorId: string; amountFrom: number }) {
    const c = await this.db.query(`SELECT * FROM remittance_corridors WHERE id = $1`, [
      input.corridorId,
    ]);
    const corridor = c.rows[0];
    if (!corridor) throw new Error('Corridor not found');
    const amountFrom = Number(input.amountFrom);
    if (amountFrom < Number(corridor.min_amount) || amountFrom > Number(corridor.max_amount)) {
      throw new Error(
        `Amount must be between ${corridor.min_amount} and ${corridor.max_amount} ${corridor.currency_from}`
      );
    }
    const fee =
      amountFrom * (Number(corridor.fee_percent) / 100) + Number(corridor.fee_flat || 0);
    const net = amountFrom - fee;
    const creditTo = Math.round(net * Number(corridor.fx_rate) * 100) / 100;
    return {
      corridor,
      amountFrom,
      fee: Math.round(fee * 100) / 100,
      creditTo,
      currencyTo: corridor.currency_to,
      complianceNote: corridor.compliance_note,
    };
  }

  async sendRemittanceViaCorridor(input: {
    senderId: string;
    corridorId: string;
    amountFrom: number;
    recipientPhone?: string;
    recipientId?: string;
    note?: string;
  }) {
    const q = await this.quoteRemittanceGift({
      corridorId: input.corridorId,
      amountFrom: input.amountFrom,
    });
    const bal = await this.getMobilityBalance(input.senderId);
    if (bal.walletBalance + bal.mobilityCredit < q.amountFrom) {
      throw new Error('Insufficient balance for remittance');
    }
    await this.db.query(
      `UPDATE wallets SET
         mobility_credit = GREATEST(0, COALESCE(mobility_credit,0) - LEAST(COALESCE(mobility_credit,0), $2)),
         balance_fiat = balance_fiat - GREATEST(0, $2 - LEAST(COALESCE(mobility_credit,0), $2)),
         last_updated = NOW()
       WHERE user_id = $1`,
      [input.senderId, q.amountFrom]
    );
    return this.createRemittanceGift({
      senderId: input.senderId,
      amount: q.creditTo,
      currency: q.currencyTo,
      recipientPhone: input.recipientPhone,
      recipientId: input.recipientId,
      note: input.note || `Remittance via ${q.corridor.name}`,
      skipDebit: true,
    });
  }
}
