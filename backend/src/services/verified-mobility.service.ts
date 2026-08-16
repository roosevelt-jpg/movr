import crypto from 'crypto';
import { DatabaseService } from './database.service';
import { RideBookingService } from './ride-booking.service';
import { MatchingEngineService } from './matching-engine.service';
import { AfricaMobilityRailsService } from './africa-mobility-rails.service';

const CLASS_TO_RIDE: Record<string, string> = {
  classic: 'standard',
  vip: 'premium',
  security: 'xl',
  executive: 'premium',
  executive_plus: 'premium',
  armored: 'xl',
  signature: 'premium',
};

function maskPlate(plate?: string | null) {
  const p = String(plate || '').replace(/\s+/g, '');
  if (p.length < 3) return p || '•••';
  return `${p.slice(0, 2)}••••${p.slice(-2)}`;
}

function hoursUntil(at?: Date | string | null) {
  if (!at) return 0;
  return (new Date(at).getTime() - Date.now()) / 36e5;
}

export class VerifiedMobilityService {
  constructor(
    private db: DatabaseService,
    private booking: RideBookingService,
    private matching: MatchingEngineService,
    private rails: AfricaMobilityRailsService
  ) {}

  passport(row: any) {
    if (!row) return null;
    const inspected =
      row.inspection_expires_at && new Date(row.inspection_expires_at).getTime() > Date.now();
    return {
      listingId: row.id || row.listing_id,
      classCode: row.class_code,
      className: row.class_name || row.class_code,
      title: row.title,
      make: row.make,
      model: row.model,
      year: row.year,
      seats: Number(row.seats || 4),
      photos: {
        exterior: row.exterior_photo_url || null,
        interior: row.interior_photo_url || null,
      },
      plateMasked: maskPlate(row.plate_number),
      vinLast4: row.vin ? String(row.vin).slice(-4) : null,
      chauffeur: {
        id: row.chauffeur_user_id || null,
        name: row.chauffeur_name || 'Verified chauffeur',
        rating: Number(row.chauffeur_rating || 4.8),
      },
      inspection: {
        at: row.inspection_at,
        expiresAt: row.inspection_expires_at,
        valid: Boolean(inspected),
        badge: inspected ? 'Inspected' : 'Inspection due',
      },
      city: row.city,
      countryCode: row.country_code,
      ownerPrice: row.owner_price != null ? Number(row.owner_price) : null,
      hourlyRate: row.hourly_rate != null ? Number(row.hourly_rate) : null,
      airportRate: row.airport_rate != null ? Number(row.airport_rate) : null,
      currency: row.currency_code || 'NGN',
      slaGuaranteed: row.sla_guaranteed !== false,
      securityGrade: row.security_grade || 'none',
    };
  }

  async listClasses() {
    const r = await this.db.query(
      `SELECT * FROM verified_classes ORDER BY sort_order, name`
    );
    return r.rows;
  }

  async listListings(filters: {
    classCode?: string;
    city?: string;
    countryCode?: string;
    q?: string;
  }) {
    const r = await this.db.query(
      `SELECT l.*, c.name AS class_name, c.sla_guaranteed, c.security_grade
       FROM verified_listings l
       JOIN verified_classes c ON c.code = l.class_code
       WHERE l.is_active = TRUE AND l.listed_for_hire = TRUE
         AND ($1::text IS NULL OR l.class_code = $1)
         AND ($2::text IS NULL OR lower(l.city) = lower($2))
         AND ($3::text IS NULL OR l.country_code = $3)
         AND ($4::text IS NULL OR l.title ILIKE '%' || $4 || '%'
              OR COALESCE(l.make,'') ILIKE '%' || $4 || '%'
              OR COALESCE(l.model,'') ILIKE '%' || $4 || '%')
       ORDER BY c.sort_order, l.owner_price NULLS LAST, l.title`,
      [
        filters.classCode || null,
        filters.city || null,
        filters.countryCode || null,
        filters.q ? String(filters.q).trim() : null,
      ]
    );
    return r.rows.map((row) => ({
      ...this.passport(row),
      ownerPrice: row.owner_price != null ? Number(row.owner_price) : null,
    }));
  }

  async getListing(id: string) {
    const r = await this.db.query(
      `SELECT l.*, c.name AS class_name, c.sla_guaranteed, c.security_grade
       FROM verified_listings l
       JOIN verified_classes c ON c.code = l.class_code
       WHERE l.id = $1`,
      [id]
    );
    if (!r.rows[0]) return null;
    return this.passport(r.rows[0]);
  }

  quoteListing(
    listing: any,
    input: { product?: string; hours?: number; priority?: boolean; pickupAt?: string | null }
  ) {
    const product = String(input.product || 'trip');
    let base = Number(listing.owner_price || listing.ownerPrice || 0);
    if (product === 'hourly') {
      const hrs = Math.max(1, Number(input.hours || 1));
      base = Number(listing.hourly_rate || listing.hourlyRate || base / 8 || 0) * hrs;
    } else if (product === 'airport') {
      base = Number(listing.airport_rate || listing.airportRate || listing.owner_price || 0);
    }
    const soon = hoursUntil(input.pickupAt || null) > 0 && hoursUntil(input.pickupAt) < 6;
    const wantPriority = Boolean(input.priority) || (soon && Boolean(input.priority));
    const surcharge = wantPriority ? Math.round(base * 0.2 * 100) / 100 : 0;
    return {
      product,
      base,
      priority: Boolean(input.priority),
      prioritySurcharge: surcharge,
      total: Math.round((base + surcharge) * 100) / 100,
      currency: listing.currency_code || listing.currency || 'NGN',
      slaGuaranteed: listing.sla_guaranteed !== false,
    };
  }

  async quote(listingId: string, input: any) {
    const listing = await this.getListingRow(listingId);
    if (!listing) throw new Error('Vehicle not found');
    return { listing: this.passport(listing), quote: this.quoteListing(listing, input) };
  }

  private async getListingRow(id: string) {
    const r = await this.db.query(
      `SELECT l.*, c.name AS class_name, c.sla_guaranteed, c.security_grade
       FROM verified_listings l
       JOIN verified_classes c ON c.code = l.class_code
       WHERE l.id = $1`,
      [id]
    );
    return r.rows[0] || null;
  }

  async book(input: {
    userId: string;
    listingId: string;
    pickupLat: number;
    pickupLng: number;
    dropoffLat: number;
    dropoffLng: number;
    pickupAddress?: string;
    dropoffAddress?: string;
    pickupAt?: string | null;
    passengers?: number;
    product?: string;
    hours?: number;
    priority?: boolean;
    orgId?: string;
    movementId?: string;
    countryCode?: string;
  }) {
    const listing = await this.getListingRow(input.listingId);
    if (!listing || listing.is_active === false) throw new Error('Vehicle not available');
    const quote = this.quoteListing(listing, input);
    const walletPayer = await this.resolvePayer(input.userId, input.orgId);
    const hold = await this.holdEscrow(walletPayer, quote.total, quote.currency);

    const booking = await this.db.query(
      `INSERT INTO verified_bookings (
         user_id, org_id, movement_id, listing_id, driver_id, class_code,
         pickup_address, dropoff_address, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng,
         pickup_at, passengers, product, hours, priority, priority_surcharge,
         quoted_fare, currency_code, escrow_status, escrow_amount, status
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,'held',$21,'requested')
       RETURNING *`,
      [
        input.userId,
        input.orgId || null,
        input.movementId || null,
        listing.id,
        listing.chauffeur_user_id || null,
        listing.class_code,
        input.pickupAddress || null,
        input.dropoffAddress || null,
        input.pickupLat,
        input.pickupLng,
        input.dropoffLat,
        input.dropoffLng,
        input.pickupAt || null,
        Math.max(1, Number(input.passengers || 1)),
        quote.product,
        input.hours || null,
        Boolean(input.priority),
        quote.prioritySurcharge,
        quote.total,
        quote.currency,
        quote.total,
      ]
    );
    const row = booking.rows[0];
    await this.db.query(
      `INSERT INTO verified_escrow (booking_id, user_id, amount, currency, status, reference)
       VALUES ($1,$2,$3,$4,'held',$5)`,
      [row.id, hold.payerId, quote.total, quote.currency, hold.reference]
    );

    const rideType = CLASS_TO_RIDE[listing.class_code] || 'premium';
    const created = await this.booking.createRideRequest({
      userId: input.userId,
      pickupLat: input.pickupLat,
      pickupLng: input.pickupLng,
      dropoffLat: input.dropoffLat,
      dropoffLng: input.dropoffLng,
      pickupAddress: input.pickupAddress,
      dropoffAddress: input.dropoffAddress,
      vehicleTypeCode: rideType,
      rideType,
      fareMode: 'now',
      sourceChannel: 'app',
      countryCode: input.countryCode,
      skipAutoAssign: true,
    });

    if (created.rideId) {
      await this.db.query(
        `UPDATE rides SET
           verified_booking_id = $2,
           estimated_fare = $3,
           driver_earnings = $3,
           payment_method = 'verified_escrow',
           status = CASE WHEN status IN ('pool_waiting','requested','searching') THEN 'requested' ELSE status END,
           pricing_meta = COALESCE(pricing_meta, '{}'::jsonb) || $4::jsonb
         WHERE id = $1`,
        [
          created.rideId,
          row.id,
          quote.total,
          JSON.stringify({
            verified: true,
            listingId: listing.id,
            classCode: listing.class_code,
            escrow: 'held',
            payerId: hold.payerId,
            zeroTakeRate: true,
          }),
        ]
      );
      await this.db.query(
        `UPDATE verified_bookings SET ride_id = $2, status = 'offered' WHERE id = $1`,
        [row.id, created.rideId]
      );
      if (listing.chauffeur_user_id) {
        await this.matching.offerRideToDriver(created.rideId, listing.chauffeur_user_id).catch(() => undefined);
      } else {
        await this.matching
          .assignNearestDriver('ride', created.rideId, input.pickupLat, input.pickupLng, {
            rideType,
            dropoffLat: input.dropoffLat,
            dropoffLng: input.dropoffLng,
          })
          .catch(() => undefined);
      }
    }

    return {
      booking: { ...row, ride_id: created.rideId, rideId: created.rideId },
      rideId: created.rideId,
      passport: this.passport(listing),
      quote,
      escrow: { status: 'held', amount: quote.total, currency: quote.currency },
    };
  }

  async bookMovement(input: {
    userId: string;
    orgId?: string;
    pickupLat: number;
    pickupLng: number;
    dropoffLat: number;
    dropoffLng: number;
    pickupAddress?: string;
    dropoffAddress?: string;
    pickupAt?: string | null;
    notes?: string;
    vehicles: Array<{ listingId?: string; classCode?: string; product?: string; priority?: boolean }>;
    countryCode?: string;
  }) {
    if (!input.vehicles?.length) throw new Error('Add at least one vehicle');
    const movement = await this.db.query(
      `INSERT INTO verified_movements (
         user_id, org_id, pickup_address, dropoff_address,
         pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, pickup_at, notes, status
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'booked') RETURNING *`,
      [
        input.userId,
        input.orgId || null,
        input.pickupAddress || null,
        input.dropoffAddress || null,
        input.pickupLat,
        input.pickupLng,
        input.dropoffLat,
        input.dropoffLng,
        input.pickupAt || null,
        input.notes || null,
      ]
    );
    const mv = movement.rows[0];
    const bookings = [];
    for (const v of input.vehicles) {
      let listingId = v.listingId;
      if (!listingId && v.classCode) {
        const pick = await this.db.query(
          `SELECT id FROM verified_listings
           WHERE is_active = TRUE AND listed_for_hire = TRUE AND class_code = $1
           ORDER BY owner_price NULLS LAST LIMIT 1`,
          [v.classCode]
        );
        listingId = pick.rows[0]?.id;
      }
      if (!listingId) continue;
      const booked = await this.book({
        userId: input.userId,
        listingId,
        orgId: input.orgId,
        movementId: mv.id,
        pickupLat: input.pickupLat,
        pickupLng: input.pickupLng,
        dropoffLat: input.dropoffLat,
        dropoffLng: input.dropoffLng,
        pickupAddress: input.pickupAddress,
        dropoffAddress: input.dropoffAddress,
        pickupAt: input.pickupAt,
        product: v.product || 'trip',
        priority: v.priority,
        countryCode: input.countryCode,
      });
      bookings.push(booked);
    }
    return { movement: mv, bookings };
  }

  async byRide(rideId: string, userId?: string) {
    const r = await this.db.query(
      `SELECT b.*, l.title, l.make, l.model, l.year, l.seats, l.exterior_photo_url,
              l.interior_photo_url, l.plate_number, l.vin, l.inspection_at, l.inspection_expires_at,
              l.chauffeur_name, l.chauffeur_rating, l.chauffeur_user_id, l.class_code,
              l.owner_price, l.hourly_rate, l.airport_rate, l.currency_code, l.city, l.country_code,
              c.name AS class_name, c.sla_guaranteed, c.security_grade,
              l.id AS listing_pk
       FROM verified_bookings b
       JOIN verified_listings l ON l.id = b.listing_id
       JOIN verified_classes c ON c.code = l.class_code
       WHERE b.ride_id = $1`,
      [rideId]
    );
    const row = r.rows[0];
    if (!row) return null;
    if (userId && row.user_id !== userId && row.driver_id !== userId) {
      const member = await this.db.query(
        `SELECT 1 FROM verified_org_members WHERE org_id = $1 AND user_id = $2 LIMIT 1`,
        [row.org_id, userId]
      ).catch(() => ({ rows: [] as any[] }));
      if (!member.rows[0]) return null;
    }
    return {
      booking: row,
      passport: this.passport({ ...row, id: row.listing_pk }),
      escrow: {
        status: row.escrow_status,
        amount: Number(row.escrow_amount),
        currency: row.currency_code,
      },
    };
  }

  async confirmMatch(userId: string, rideId: string, matches: boolean) {
    const data = await this.byRide(rideId, userId);
    if (!data) throw new Error('Verified booking not found');
    const b = data.booking;
    if (b.user_id !== userId) {
      const orgOwner = await this.db.query(`SELECT owner_id FROM verified_orgs WHERE id = $1`, [b.org_id]);
      if (orgOwner.rows[0]?.owner_id !== userId && b.user_id !== userId) {
        throw new Error('Only the rider can confirm the vehicle');
      }
    }
    if (matches) {
      await this.db.query(
        `UPDATE verified_bookings SET match_confirmed_at = NOW(), status = 'matched' WHERE id = $1`,
        [b.id]
      );
      await this.captureEscrow(b.id);
      return { matched: true, escrow: 'released' };
    }
    await this.db.query(
      `UPDATE verified_bookings SET match_rejected_at = NOW(), status = 'mismatch' WHERE id = $1`,
      [b.id]
    );
    await this.releaseEscrow(b.id);
    await this.db.query(
      `UPDATE rides SET status = 'cancelled', cancellation_reason = 'vehicle_mismatch', updated_at = NOW()
       WHERE id = $1`,
      [rideId]
    ).catch(() => undefined);
    return { matched: false, escrow: 'refunded' };
  }

  async applyClassSla(rideId: string, actualClass: string) {
    const data = await this.byRide(rideId);
    if (!data) return null;
    const expected = String(data.booking.class_code);
    const actual = String(actualClass || expected);
    await this.db.query(
      `UPDATE verified_bookings SET arrived_class_code = $2 WHERE id = $1`,
      [data.booking.id, actual]
    );
    if (actual === expected) return { credit: 0 };
    const exp = await this.db.query(
      `SELECT COALESCE(AVG(owner_price), 0) AS p FROM verified_listings WHERE class_code = $1 AND is_active`,
      [expected]
    );
    const act = await this.db.query(
      `SELECT COALESCE(AVG(owner_price), 0) AS p FROM verified_listings WHERE class_code = $1 AND is_active`,
      [actual]
    );
    const delta = Math.max(0, Number(exp.rows[0]?.p || 0) - Number(act.rows[0]?.p || 0));
    if (delta <= 0) return { credit: 0, expected, actual };
    const payer = await this.escrowPayer(data.booking.id);
    await this.db.query(
      `UPDATE wallets SET
         mobility_credit = COALESCE(mobility_credit,0) + $2,
         last_updated = NOW()
       WHERE user_id = $1`,
      [payer, delta]
    );
    await this.db.query(
      `UPDATE verified_bookings SET sla_credit_amount = $2 WHERE id = $1`,
      [data.booking.id, delta]
    );
    return { credit: delta, expected, actual };
  }

  async settleOnComplete(rideId: string) {
    const data = await this.byRide(rideId);
    if (!data) return;
    if (data.booking.escrow_status === 'held') {
      await this.captureEscrow(data.booking.id);
    }
    await this.db.query(
      `UPDATE verified_bookings SET status = 'completed' WHERE id = $1`,
      [data.booking.id]
    );
  }

  async markArrived(rideId: string) {
    await this.db
      .query(`UPDATE verified_bookings SET status = 'arrived' WHERE ride_id = $1 AND status <> 'mismatch'`, [
        rideId,
      ])
      .catch(() => undefined);
  }

  async myBookings(userId: string) {
    const r = await this.db.query(
      `SELECT b.*, l.title, l.exterior_photo_url, l.class_code, c.name AS class_name
       FROM verified_bookings b
       JOIN verified_listings l ON l.id = b.listing_id
       JOIN verified_classes c ON c.code = b.class_code
       WHERE b.user_id = $1
          OR b.org_id IN (SELECT org_id FROM verified_org_members WHERE user_id = $1)
       ORDER BY b.created_at DESC
       LIMIT 50`,
      [userId]
    );
    return r.rows;
  }

  async upsertListingFromDriver(userId: string, body: any) {
    const veh = await this.db.query(
      `SELECT * FROM driver_vehicles WHERE driver_user_id = $1
       ORDER BY is_primary DESC NULLS LAST, updated_at DESC NULLS LAST LIMIT 1`,
      [userId]
    );
    const dv = veh.rows[0];
    if (!dv) throw new Error('Add your vehicle first');
    const existing = await this.db.query(
      `SELECT id FROM verified_listings WHERE driver_vehicle_id = $1 LIMIT 1`,
      [dv.id]
    );
    const classCode = body.classCode || 'classic';
    const payload = [
      userId,
      classCode,
      body.title || dv.make_model || `${dv.make || ''} ${dv.model || ''}`.trim(),
      dv.make,
      dv.model,
      dv.year,
      body.interiorPhotoUrl || null,
      dv.photo_url,
      dv.plate_number,
      dv.vin,
      body.ownerPrice != null ? Number(body.ownerPrice) : 25000,
      body.hourlyRate != null ? Number(body.hourlyRate) : 8000,
      body.airportRate != null ? Number(body.airportRate) : 30000,
      body.listedForHire !== false,
    ];
    if (existing.rows[0]) {
      const u = await this.db.query(
        `UPDATE verified_listings SET
           chauffeur_user_id = $1, class_code = $2, title = $3, make = $4, model = $5, year = $6,
           interior_photo_url = COALESCE($7, interior_photo_url),
           exterior_photo_url = COALESCE($8, exterior_photo_url),
           plate_number = $9, vin = $10, owner_price = $11, hourly_rate = $12, airport_rate = $13,
           listed_for_hire = $14, inspection_at = COALESCE(inspection_at, NOW()),
           inspection_expires_at = COALESCE(inspection_expires_at, NOW() + INTERVAL '90 days'),
           is_active = TRUE, updated_at = NOW()
         WHERE id = $15 RETURNING *`,
        [...payload, existing.rows[0].id]
      );
      return this.passport(u.rows[0]);
    }
    const ins = await this.db.query(
      `INSERT INTO verified_listings (
         source, driver_vehicle_id, chauffeur_user_id, class_code, title, make, model, year,
         interior_photo_url, exterior_photo_url, plate_number, vin, owner_price, hourly_rate,
         airport_rate, listed_for_hire, inspection_at, inspection_expires_at, is_active
       ) VALUES ('driver_vehicle',$15,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW(),NOW()+INTERVAL '90 days',TRUE)
       RETURNING *`,
      [...payload, dv.id]
    );
    return this.passport(ins.rows[0]);
  }

  async createOrg(userId: string, body: any) {
    const org = await this.db.query(
      `INSERT INTO verified_orgs (owner_id, name, industry, cac_number, monthly_spend_tier, team_size, phone, email, notes, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pilot') RETURNING *`,
      [
        userId,
        body.name,
        body.industry || null,
        body.cacNumber || null,
        body.monthlySpendTier || null,
        body.teamSize || null,
        body.phone || null,
        body.email || null,
        body.notes || null,
      ]
    );
    await this.db.query(
      `INSERT INTO verified_org_members (org_id, user_id, role, cost_center)
       VALUES ($1,$2,'owner',$3) ON CONFLICT (org_id, user_id) DO NOTHING`,
      [org.rows[0].id, userId, body.costCenter || 'HQ']
    );
    return org.rows[0];
  }

  async myOrgs(userId: string) {
    const r = await this.db.query(
      `SELECT o.*, m.role, m.cost_center
       FROM verified_orgs o
       JOIN verified_org_members m ON m.org_id = o.id
       WHERE m.user_id = $1
       ORDER BY o.created_at DESC`,
      [userId]
    );
    return r.rows;
  }

  async addOrgMember(ownerId: string, orgId: string, body: { userId?: string; email?: string; role?: string; costCenter?: string }) {
    const org = await this.db.query(`SELECT * FROM verified_orgs WHERE id = $1`, [orgId]);
    if (!org.rows[0] || org.rows[0].owner_id !== ownerId) throw new Error('Organization not found');
    let memberId = body.userId;
    if (!memberId && body.email) {
      const u = await this.db.query(`SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1`, [body.email]);
      memberId = u.rows[0]?.id;
    }
    if (!memberId) throw new Error('Member user not found');
    await this.db.query(
      `INSERT INTO verified_org_members (org_id, user_id, role, cost_center)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role, cost_center = EXCLUDED.cost_center`,
      [orgId, memberId, body.role || 'booker', body.costCenter || null]
    );
    return { ok: true, userId: memberId };
  }

  async orgDesk(userId: string, orgId: string) {
    const access = await this.db.query(
      `SELECT 1 FROM verified_org_members WHERE org_id = $1 AND user_id = $2`,
      [orgId, userId]
    );
    if (!access.rows[0]) throw new Error('Not a member of this organization');
    const org = await this.db.query(`SELECT * FROM verified_orgs WHERE id = $1`, [orgId]);
    const members = await this.db.query(
      `SELECT m.role, m.cost_center, m.user_id, u.first_name, u.last_name, u.email
       FROM verified_org_members m
       LEFT JOIN users u ON u.id = m.user_id
       WHERE m.org_id = $1`,
      [orgId]
    );
    const trips = await this.db.query(
      `SELECT b.id, b.status, b.quoted_fare, b.currency_code, b.pickup_address, b.dropoff_address,
              b.pickup_at, b.created_at, b.escrow_status, b.class_code, b.ride_id, b.match_confirmed_at,
              l.title, l.plate_number, l.chauffeur_name
       FROM verified_bookings b
       JOIN verified_listings l ON l.id = b.listing_id
       WHERE b.org_id = $1
       ORDER BY b.created_at DESC
       LIMIT 100`,
      [orgId]
    );
    const live = trips.rows.filter((t: any) =>
      ['requested', 'offered', 'arrived', 'matched'].includes(t.status)
    );
    return {
      org: org.rows[0],
      members: members.rows,
      live,
      trips: trips.rows,
      evidence: trips.rows.map((t: any) => ({
        bookedBy: userId,
        chauffeur: t.chauffeur_name,
        vehicle: t.title,
        plate: maskPlate(t.plate_number),
        pickup: t.pickup_address,
        dropoff: t.dropoff_address,
        when: t.pickup_at || t.created_at,
        cost: Number(t.quoted_fare),
        currency: t.currency_code,
        status: t.status,
        matched: Boolean(t.match_confirmed_at),
      })),
    };
  }

  private async resolvePayer(userId: string, orgId?: string) {
    if (!orgId) return userId;
    const org = await this.db.query(`SELECT owner_id FROM verified_orgs WHERE id = $1`, [orgId]);
    if (!org.rows[0]) throw new Error('Organization not found');
    const mem = await this.db.query(
      `SELECT 1 FROM verified_org_members WHERE org_id = $1 AND user_id = $2`,
      [orgId, userId]
    );
    if (!mem.rows[0]) throw new Error('Not a member of this organization');
    return org.rows[0].owner_id;
  }

  private async holdEscrow(userId: string, amount: number, currency: string) {
    if (amount <= 0) throw new Error('Invalid fare');
    const resolved = await this.rails.resolveRidePayer(userId, amount);
    const payerId = resolved.payerId || userId;
    const bal = await this.rails.getMobilityBalance(payerId);
    if (bal.mobilityCredit + bal.walletBalance < amount) {
      throw new Error('Top up your wallet to hold this booking in escrow');
    }
    const fromCredit = Math.min(bal.mobilityCredit, amount);
    const fromWallet = amount - fromCredit;
    await this.db.query(
      `UPDATE wallets SET
         mobility_credit = GREATEST(0, COALESCE(mobility_credit,0) - $2),
         balance_fiat = balance_fiat - $3,
         verified_escrow_held = COALESCE(verified_escrow_held,0) + $4,
         last_updated = NOW()
       WHERE user_id = $1`,
      [payerId, fromCredit, fromWallet, amount]
    );
    const reference = `ESC-${crypto.randomBytes(6).toString('hex')}`;
    await this.db
      .query(
        `INSERT INTO mobility_credit_ledger (user_id, amount, currency, source, reference)
         VALUES ($1,$2,$3,'verified_escrow_hold',$4)`,
        [payerId, -amount, currency || bal.currency, reference]
      )
      .catch(() => undefined);
    return { reference, payerId };
  }

  private async escrowPayer(bookingId: string) {
    const r = await this.db.query(
      `SELECT user_id FROM verified_escrow WHERE booking_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [bookingId]
    );
    if (r.rows[0]) return r.rows[0].user_id;
    const b = await this.db.query(`SELECT user_id FROM verified_bookings WHERE id = $1`, [bookingId]);
    return b.rows[0]?.user_id;
  }

  private async captureEscrow(bookingId: string) {
    const b = await this.db.query(`SELECT * FROM verified_bookings WHERE id = $1`, [bookingId]);
    const row = b.rows[0];
    if (!row || row.escrow_status !== 'held') return;
    const payer = await this.escrowPayer(bookingId);
    await this.db.query(
      `UPDATE wallets SET
         verified_escrow_held = GREATEST(0, COALESCE(verified_escrow_held,0) - $2),
         last_updated = NOW()
       WHERE user_id = $1`,
      [payer, Number(row.escrow_amount)]
    );
    await this.db.query(
      `UPDATE verified_escrow SET status = 'captured', settled_at = NOW() WHERE booking_id = $1 AND status = 'held'`,
      [bookingId]
    );
    await this.db.query(
      `UPDATE verified_bookings SET escrow_status = 'released' WHERE id = $1`,
      [bookingId]
    );
  }

  private async releaseEscrow(bookingId: string) {
    const b = await this.db.query(`SELECT * FROM verified_bookings WHERE id = $1`, [bookingId]);
    const row = b.rows[0];
    if (!row || row.escrow_status !== 'held') return;
    const payer = await this.escrowPayer(bookingId);
    const amt = Number(row.escrow_amount);
    await this.db.query(
      `UPDATE wallets SET
         verified_escrow_held = GREATEST(0, COALESCE(verified_escrow_held,0) - $2),
         mobility_credit = COALESCE(mobility_credit,0) + $2,
         last_updated = NOW()
       WHERE user_id = $1`,
      [payer, amt]
    );
    await this.db.query(
      `UPDATE verified_escrow SET status = 'released', settled_at = NOW() WHERE booking_id = $1 AND status = 'held'`,
      [bookingId]
    );
    await this.db.query(
      `UPDATE verified_bookings SET escrow_status = 'refunded' WHERE id = $1`,
      [bookingId]
    );
  }
}
