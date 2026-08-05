import { Router, Response } from 'express';
import { DatabaseService } from '../services/database.service';
import { MatchingEngineService } from '../services/matching-engine.service';
import { RideBookingService } from '../services/ride-booking.service';

const db = new DatabaseService();
const matching = new MatchingEngineService(db, null, { broadcastToDrivers: () => undefined } as any);
const booking = new RideBookingService(db, matching);

/**
 * Public vehicle types + live fare estimates (Phase 24).
 * Single source of truth for app, voice, and messaging channels.
 */
export const publicVehicleTypesRouter = Router();

publicVehicleTypesRouter.get('/', async (req: any, res: Response) => {
  try {
    const region = String(req.query.region || req.query.country || 'GH').toUpperCase();
    const city = req.query.city ? String(req.query.city) : null;
    const pickupLat = req.query.pickupLat != null ? Number(req.query.pickupLat) : null;
    const pickupLng = req.query.pickupLng != null ? Number(req.query.pickupLng) : null;
    const dropoffLat = req.query.dropoffLat != null ? Number(req.query.dropoffLat) : null;
    const dropoffLng = req.query.dropoffLng != null ? Number(req.query.dropoffLng) : null;

    const types = await db.query(
      `SELECT vt.*,
         (
           SELECT json_build_object(
             'base_fare', p.base_fare,
             'per_km_rate', p.per_km_rate,
             'per_minute_rate', p.per_minute_rate,
             'minimum_fare', p.minimum_fare,
             'currency_code', p.currency_code,
             'cancellation_fee', p.cancellation_fee,
             'effective_from', p.effective_from,
             'country_code', p.country_code,
             'city', p.city
           )
           FROM vehicle_type_pricing p
           WHERE p.vehicle_type_id = vt.id
             AND (p.country_code = $1 OR p.country_code IS NULL)
             AND ($2::text IS NULL OR p.city IS NULL OR p.city = $2)
             AND p.effective_from <= NOW()
           ORDER BY p.country_code NULLS LAST, p.city NULLS LAST, p.effective_from DESC
           LIMIT 1
         ) AS pricing
       FROM vehicle_types vt
       WHERE vt.is_active = TRUE
       ORDER BY vt.sort_order`,
      [region, city]
    );

    let estimates: any = null;
    if (
      pickupLat != null &&
      pickupLng != null &&
      dropoffLat != null &&
      dropoffLng != null &&
      !Number.isNaN(pickupLat)
    ) {
      estimates = await booking.estimateFares(
        pickupLat,
        pickupLng,
        dropoffLat,
        dropoffLng,
        region
      );
    }

    res.json({
      status: 'success',
      data: {
        region,
        city,
        vehicleTypes: types.rows,
        estimates,
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});
