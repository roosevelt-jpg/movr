import { DatabaseService } from './database.service';
import { MatchingEngineService } from './matching-engine.service';
import { LocalizationService } from './localization.service';
import { InboxService } from './inbox.service';
import getLogger from '../utils/logger';

export type SourceChannel =
  | 'app'
  | 'whatsapp'
  | 'telegram'
  | 'sms'
  | 'ussd'
  | 'ivr'
  | 'voice';

export interface RideRequestInput {
  userId: string;
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  pickupAddress?: string;
  dropoffAddress?: string;
  rideType?: string;
  vehicleTypeCode?: string;
  sourceChannel?: SourceChannel;
  countryCode?: string;
  /** Dual pricing mode: now | wait | shoulder | walk | share */
  fareMode?: string;
}

/**
 * Channel-agnostic ride creation (Phase 22).
 * All channels (app, WhatsApp, Telegram, SMS, USSD, IVR, voice) call this.
 */
export class RideBookingService {
  private logger = getLogger('ride-booking');
  private localization: LocalizationService;
  private inbox: InboxService;

  constructor(
    private db: DatabaseService,
    private matching: MatchingEngineService
  ) {
    this.localization = new LocalizationService(db);
    this.inbox = new InboxService(db);
  }

  async createRideRequest(input: RideRequestInput) {
    const rideType = input.vehicleTypeCode || input.rideType || 'standard';
    const fareMode = String(input.fareMode || 'now').toLowerCase();
    let countryCode = input.countryCode;
    if (!countryCode && input.userId) {
      const u = await this.db.query(`SELECT country, phone FROM users WHERE id = $1`, [
        input.userId,
      ]);
      countryCode =
        u.rows[0]?.country ||
        (
          await this.localization.detectCountry({
            phoneNumber: u.rows[0]?.phone || undefined,
          })
        )?.code ||
        'GH';
    }
    countryCode = countryCode || 'GH';

    const distanceKm =
      Math.sqrt(
        Math.pow(input.dropoffLat - input.pickupLat, 2) +
          Math.pow(input.dropoffLng - input.pickupLng, 2)
      ) * 111;
    const durationMinutes = Math.ceil(distanceKm * 2);

    const quote = await this.matching.calculateFareWithBreakdown(
      distanceKm,
      durationMinutes,
      rideType,
      countryCode,
      input.pickupLat,
      input.pickupLng,
      undefined,
      {
        destLat: input.dropoffLat,
        destLng: input.dropoffLng,
        fareMode,
      }
    );

    const estimatedFare = quote.riderFare ?? quote.fare;
    const pricingBreakdown = quote.breakdown;
    const city = await this.localization.getCityPricing(
      input.pickupLat,
      input.pickupLng,
      countryCode
    );

    const pricingMeta = {
      riderFare: estimatedFare,
      driverPayout: quote.driverPayout,
      platformSubsidy: quote.platformSubsidy,
      surgeBonus: quote.surgeBonus,
      dvtReward: quote.dvtReward,
      fareMode: quote.fareMode,
      riderReason: pricingBreakdown?.riderReason,
      driverReason: pricingBreakdown?.driverReason,
      riderMultiplier: pricingBreakdown?.riderMultiplier,
      driverMultiplier: pricingBreakdown?.driverMultiplier,
    };

    const rideResult = await this.db.query(
      `INSERT INTO rides (
         customer_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng,
         pickup_address, dropoff_address, ride_type, status, estimated_fare,
         distance_km, estimated_duration_minutes, source_channel, surge_multiplier,
         driver_earnings, dvt_reward, fare_mode, platform_subsidy, pricing_meta, created_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'requested',$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,NOW())
       RETURNING *`,
      [
        input.userId,
        input.pickupLat,
        input.pickupLng,
        input.dropoffLat,
        input.dropoffLng,
        input.pickupAddress || null,
        input.dropoffAddress || null,
        rideType,
        estimatedFare,
        distanceKm,
        durationMinutes + Number(quote.fareMode?.etaExtraMinutes || 0),
        input.sourceChannel || 'app',
        Number(pricingBreakdown?.riderMultiplier || pricingBreakdown?.finalMultiplier || 1),
        Number(quote.driverPayout || estimatedFare),
        Number(quote.dvtReward || 0),
        fareMode,
        Number(quote.platformSubsidy || 0),
        JSON.stringify(pricingMeta),
      ]
    ).catch(async () => {
      // Fallback if dual-pricing columns not migrated yet
      return this.db.query(
        `INSERT INTO rides (
           customer_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng,
           pickup_address, dropoff_address, ride_type, status, estimated_fare,
           distance_km, estimated_duration_minutes, source_channel, surge_multiplier, created_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'requested',$9,$10,$11,$12,$13,NOW())
         RETURNING *`,
        [
          input.userId,
          input.pickupLat,
          input.pickupLng,
          input.dropoffLat,
          input.dropoffLng,
          input.pickupAddress || null,
          input.dropoffAddress || null,
          rideType,
          estimatedFare,
          distanceKm,
          durationMinutes,
          input.sourceChannel || 'app',
          Number(pricingBreakdown?.riderMultiplier || 1),
        ]
      );
    });

    const ride = rideResult.rows[0];
    // Backfill earnings if insert used fallback
    if (ride && quote.driverPayout != null) {
      await this.db
        .query(
          `UPDATE rides SET
             driver_earnings = COALESCE(driver_earnings, $2),
             dvt_reward = COALESCE(dvt_reward, $3),
             fare_mode = COALESCE(fare_mode, $4),
             platform_subsidy = COALESCE(platform_subsidy, $5),
             pricing_meta = COALESCE(pricing_meta, $6::jsonb)
           WHERE id = $1`,
          [
            ride.id,
            quote.driverPayout,
            quote.dvtReward,
            fareMode,
            quote.platformSubsidy,
            JSON.stringify(pricingMeta),
          ]
        )
        .catch(() => undefined);
    }

    const drivers = await this.matching.findBestDrivers(
      input.pickupLat,
      input.pickupLng,
      rideType
    );

    let assignmentStatus: 'assigned' | 'offered' | 'searching' | 'no_drivers' = 'searching';
    let offeredDriverId: string | null = null;

    try {
      const autoAssign = await this.matching.isAutoAssignEnabled();
      if (autoAssign && drivers.length) {
        const result = await this.matching.assignNearestDriver(
          'ride',
          ride.id,
          input.pickupLat,
          input.pickupLng,
          { rideType }
        );
        offeredDriverId = result.driverId;
        assignmentStatus =
          result.assignmentStatus === 'assigned'
            ? 'assigned'
            : result.driverId
              ? 'offered'
              : 'no_drivers';
      } else if (!drivers.length) {
        assignmentStatus = 'no_drivers';
      }
    } catch (e: any) {
      this.logger.warn('auto-assign skipped', { error: e?.message });
      assignmentStatus = drivers.length ? 'searching' : 'no_drivers';
    }

    try {
      const { PricingEngineService } = require('./pricing-engine.service');
      const pe = new PricingEngineService(this.db);
      const zone = await pe.findZone(input.pickupLat, input.pickupLng);
      if (zone?.id) {
        const snap = await this.db.query(
          `SELECT active_rides, available_drivers FROM zone_demand_snapshots
           WHERE zone_id = $1 ORDER BY recorded_at DESC LIMIT 1`,
          [zone.id]
        );
        const active = Number(snap.rows[0]?.active_rides || 0) + 1;
        const available = Math.max(0, Number(snap.rows[0]?.available_drivers || 10) - 1);
        await pe.snapshotDemand(zone.id, active, available);
      }
    } catch {
      /* optional */
    }

    await this.inbox.sendInboxMessage(
      input.userId,
      'ride_update',
      assignmentStatus === 'offered' || assignmentStatus === 'assigned'
        ? 'Driver found'
        : 'Ride requested',
      assignmentStatus === 'offered' || assignmentStatus === 'assigned'
        ? `A driver has been offered your trip. Est. ${this.localization.formatCurrency(estimatedFare, city.currency_code)}.`
        : `Looking for a driver. Est. ${this.localization.formatCurrency(estimatedFare, city.currency_code)}.`,
      `/ride/active/${ride.id}`
    );

    this.logger.info('ride created', {
      rideId: ride.id,
      channel: input.sourceChannel || 'app',
      drivers: drivers.length,
      assignmentStatus,
      fareMode,
      riderFare: estimatedFare,
      driverPayout: quote.driverPayout,
    });

    return {
      ride,
      rideId: ride.id,
      id: ride.id,
      estimatedFare,
      driverPayout: quote.driverPayout,
      platformSubsidy: quote.platformSubsidy,
      fareMode: quote.fareMode,
      pricing: pricingMeta,
      currency: city.currency_code,
      timezone: city.timezone,
      driversNotified: drivers.length,
      drivers,
      assignmentStatus,
      offeredDriverId,
    };
  }

  async estimateFares(
    pickupLat: number,
    pickupLng: number,
    dropoffLat: number,
    dropoffLng: number,
    countryCode = 'GH'
  ) {
    const distanceKm =
      Math.sqrt(
        Math.pow(dropoffLat - pickupLat, 2) + Math.pow(dropoffLng - pickupLng, 2)
      ) * 111;
    const durationMinutes = Math.ceil(distanceKm * 2);

    const types = await this.db.query(
      `SELECT * FROM vehicle_types WHERE is_active = TRUE ORDER BY sort_order`
    );

    const { PricingEngineService } = require('./pricing-engine.service');
    const pricingEngine = new PricingEngineService(this.db);
    const modes = await pricingEngine.listFareModes();

    const options = [];
    const fareModes = [];

    // Per vehicle — "now" price (default)
    const nowBreakdown = await pricingEngine.calculateMultiplier({
      lat: pickupLat,
      lng: pickupLng,
      destLat: dropoffLat,
      destLng: dropoffLng,
      fareMode: 'now',
    });

    for (const vt of types.rows) {
      const q = await this.matching.calculateFareWithBreakdown(
        distanceKm,
        durationMinutes,
        vt.code,
        countryCode,
        pickupLat,
        pickupLng,
        undefined,
        { destLat: dropoffLat, destLng: dropoffLng, fareMode: 'now' }
      );
      const nearby = await this.matching.findBestDrivers(pickupLat, pickupLng, vt.code);
      options.push({
        vehicleTypeId: vt.id,
        code: vt.code,
        name: vt.name,
        capacity: vt.passenger_capacity,
        price: q.riderFare ?? q.fare,
        riderFare: q.riderFare ?? q.fare,
        driverPayout: q.driverPayout,
        platformSubsidy: q.platformSubsidy,
        etaMinutes: Math.max(3, Math.round(durationMinutes * 0.15 + 3)),
        driversNearby: nearby.length,
        surgeMultiplier: q.breakdown?.riderMultiplier ?? nowBreakdown.riderMultiplier,
        surgeReason: q.breakdown?.riderReason || nowBreakdown.riderReason,
        driverReason: q.breakdown?.driverReason || nowBreakdown.driverReason,
        fareMode: 'now',
      });
    }

    options.sort((a, b) => a.price - b.price);
    if (options[0]) (options[0] as any).isRecommended = true;

    // Dual-sided mode chips for the cheapest/recommended vehicle
    const primaryCode = options[0]?.code || 'standard';
    for (const m of modes) {
      const q = await this.matching.calculateFareWithBreakdown(
        distanceKm,
        durationMinutes,
        primaryCode,
        countryCode,
        pickupLat,
        pickupLng,
        undefined,
        { destLat: dropoffLat, destLng: dropoffLng, fareMode: m.code }
      );
      const savePct =
        options[0]?.price > 0
          ? Math.max(0, Math.round((1 - (q.riderFare ?? q.fare) / options[0].price) * 100))
          : 0;
      fareModes.push({
        code: m.code,
        name: m.name,
        description: m.description,
        vehicleCode: primaryCode,
        riderFare: q.riderFare ?? q.fare,
        driverPayout: q.driverPayout,
        platformSubsidy: q.platformSubsidy,
        etaMinutes:
          Math.max(3, Math.round(durationMinutes * 0.15 + 3)) + Number(m.eta_extra_minutes || 0),
        walkMeters: Number(m.walk_meters || 0),
        riderMultiplier: q.breakdown?.riderMultiplier,
        driverMultiplier: q.breakdown?.driverMultiplier,
        riderReason: q.breakdown?.riderReason,
        driverReason: q.breakdown?.driverReason,
        savingsPercent: savePct,
        isCheapest: false,
      });
    }
    if (fareModes.length) {
      const cheapest = fareModes.reduce((a, b) => (a.riderFare <= b.riderFare ? a : b));
      cheapest.isCheapest = true;
    }

    const city = await this.localization.getCityPricing(pickupLat, pickupLng, countryCode);
    return {
      options,
      fareModes,
      currency: city.currency_code,
      distanceKm,
      durationMinutes,
      surgeMultiplier: nowBreakdown.riderMultiplier ?? nowBreakdown.finalMultiplier,
      surgeReason: nowBreakdown.riderReason || nowBreakdown.reasonSummary,
      driverReason: nowBreakdown.driverReason,
      dualPricing: true,
    };
  }
}
