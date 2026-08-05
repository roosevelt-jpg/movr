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

    const estimatedFare = await this.matching.calculateFare(
      distanceKm,
      durationMinutes,
      rideType,
      countryCode,
      input.pickupLat,
      input.pickupLng
    );

    const city = await this.localization.getCityPricing(
      input.pickupLat,
      input.pickupLng,
      countryCode
    );

    const rideResult = await this.db.query(
      `INSERT INTO rides (
         customer_id, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng,
         pickup_address, dropoff_address, ride_type, status, estimated_fare,
         distance_km, estimated_duration_minutes, source_channel, created_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'requested',$9,$10,$11,$12,NOW())
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
      ]
    );

    const ride = rideResult.rows[0];
    const drivers = await this.matching.findBestDrivers(
      input.pickupLat,
      input.pickupLng,
      rideType
    );

    await this.inbox.sendInboxMessage(
      input.userId,
      'ride_update',
      'Ride requested',
      `Looking for a driver. Est. ${this.localization.formatCurrency(estimatedFare, city.currency_code)}.`,
      `/ride/active/${ride.id}`
    );

    this.logger.info('ride created', {
      rideId: ride.id,
      channel: input.sourceChannel || 'app',
      drivers: drivers.length,
    });

    return {
      ride,
      estimatedFare,
      currency: city.currency_code,
      timezone: city.timezone,
      driversNotified: drivers.length,
      drivers,
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

    const options = [];
    const { PricingEngineService } = require('./pricing-engine.service');
    const pricingEngine = new PricingEngineService(this.db);
    const sharedBreakdown = await pricingEngine.calculateMultiplier({
      lat: pickupLat,
      lng: pickupLng,
    });

    for (const vt of types.rows) {
      const { fare: price } = await this.matching.calculateFareWithBreakdown(
        distanceKm,
        durationMinutes,
        vt.code,
        countryCode,
        pickupLat,
        pickupLng,
        sharedBreakdown
      );
      const nearby = await this.matching.findBestDrivers(pickupLat, pickupLng, vt.code);
      options.push({
        vehicleTypeId: vt.id,
        code: vt.code,
        name: vt.name,
        capacity: vt.passenger_capacity,
        price,
        etaMinutes: Math.max(3, Math.round(durationMinutes * 0.15 + 3)),
        driversNearby: nearby.length,
        surgeMultiplier: sharedBreakdown.finalMultiplier,
        surgeReason: sharedBreakdown.reasonSummary,
      });
    }

    options.sort((a, b) => a.price - b.price);
    if (options[0]) (options[0] as any).isRecommended = true;

    const city = await this.localization.getCityPricing(pickupLat, pickupLng, countryCode);
    return {
      options,
      currency: city.currency_code,
      distanceKm,
      durationMinutes,
      surgeMultiplier: sharedBreakdown.finalMultiplier,
      surgeReason: sharedBreakdown.reasonSummary,
    };
  }
}
