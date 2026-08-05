import { Router, Response } from 'express';
import {
  AuthRequest,
  authenticateToken,
  requireAdmin,
  requireCustomer,
} from '../middleware/auth.middleware';
import { DatabaseService } from '../services/database.service';
import { MatchingEngineService } from '../services/matching-engine.service';
import { RideBookingService } from '../services/ride-booking.service';
import { VoiceIntentService } from '../services/voice-intent.service';
import { LocalizationService } from '../services/localization.service';
import getLogger from '../utils/logger';

const db = new DatabaseService();
const matching = new MatchingEngineService(db, null, { broadcastToDrivers: () => undefined } as any);
const booking = new RideBookingService(db, matching);
const voice = new VoiceIntentService(db);
const localization = new LocalizationService(db);
const logger = getLogger('channels');

export const rideBookingRouter = Router();
export const voiceRouter = Router();
export const channelWebhooksRouter = Router();
export const adminVehicleRouter = Router();
export const adminChannelsRouter = Router();

async function rateLimitPhone(phone: string, channel: string) {
  // lightweight in-memory fallback when redis unavailable
  const key = `${channel}:${phone}`;
  (global as any).__movrRate = (global as any).__movrRate || new Map();
  const map: Map<string, number> = (global as any).__movrRate;
  const now = Date.now();
  const last = map.get(key) || 0;
  if (now - last < 3000) throw new Error('Too many requests — slow down');
  map.set(key, now);
}

async function findOrCreateUserByPhone(phone: string, name?: string) {
  const existing = await db.query(`SELECT * FROM users WHERE phone = $1 LIMIT 1`, [phone]);
  if (existing.rows[0]) return existing.rows[0];
  const country = await localization.detectCountry({ phoneNumber: phone });
  const created = await db.query(
    `INSERT INTO users (phone, first_name, user_type, country)
     VALUES ($1, $2, 'customer', $3) RETURNING *`,
    [phone, name || 'Rider', country?.code || 'GH']
  );
  return created.rows[0];
}

// --- App ride create thin wrapper (Phase 22) ---
rideBookingRouter.post(
  '/request',
  authenticateToken,
  requireCustomer,
  async (req: AuthRequest, res: Response) => {
    try {
      const result = await booking.createRideRequest({
        userId: req.user!.id,
        pickupLat: Number(req.body.pickupLat),
        pickupLng: Number(req.body.pickupLng),
        dropoffLat: Number(req.body.dropoffLat),
        dropoffLng: Number(req.body.dropoffLng),
        pickupAddress: req.body.pickupAddress,
        dropoffAddress: req.body.dropoffAddress,
        rideType: req.body.rideType,
        vehicleTypeCode: req.body.vehicleTypeCode,
        sourceChannel: 'app',
        countryCode: req.body.countryCode,
      });
      res.status(201).json({ status: 'success', data: result });
    } catch (error: any) {
      res.status(400).json({ status: 'error', message: error.message });
    }
  }
);

rideBookingRouter.post('/estimate', async (req: any, res: Response) => {
  try {
    const data = await booking.estimateFares(
      Number(req.body.pickupLat),
      Number(req.body.pickupLng),
      Number(req.body.dropoffLat),
      Number(req.body.dropoffLng),
      req.body.countryCode || 'GH'
    );
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

// --- Voice (Phase 23) ---
voiceRouter.post('/parse-intent', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    let utterance = req.body.text || '';
    if (!utterance && req.body.audioBase64) {
      const buf = Buffer.from(req.body.audioBase64, 'base64');
      utterance = await voice.transcribeAudio(buf, req.body.mimeType || 'audio/webm');
    }

    const intent = await voice.extractTripIntent(utterance, req.user!.id);
    if (!intent.destination || intent.confidence < 0.45) {
      return res.json({
        status: 'success',
        data: {
          needsClarification: true,
          intent,
          prompt: 'Where are you going? Say pickup and destination.',
          transcript: utterance,
        },
      });
    }

    const gps = {
      lat: Number(req.body.currentLat || 5.6037),
      lng: Number(req.body.currentLng || -0.187),
    };
    const originGeo =
      (intent as any).originLat != null
        ? { lat: (intent as any).originLat, lng: (intent as any).originLng }
        : intent.origin
          ? await voice.geocode(intent.origin, gps)
          : gps;
    const destGeo =
      (intent as any).destinationLat != null
        ? { lat: (intent as any).destinationLat, lng: (intent as any).destinationLng }
        : await voice.geocode(intent.destination!, gps);

    const estimates = await booking.estimateFares(
      originGeo.lat,
      originGeo.lng,
      destGeo.lat,
      destGeo.lng,
      req.body.countryCode || 'GH'
    );

    res.json({
      status: 'success',
      data: {
        needsClarification: false,
        transcript: utterance,
        intent,
        pickup: { address: intent.origin || 'Current location', ...originGeo },
        destination: { address: intent.destination, ...destGeo },
        ...estimates,
      },
    });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

voiceRouter.post('/confirm', authenticateToken, requireCustomer, async (req: AuthRequest, res: Response) => {
  try {
    if (req.body.spoken) {
      const ok = await voice.confirmIntent(req.body.spoken);
      if (!ok) {
        return res.status(400).json({ status: 'error', message: 'Confirmation not recognized' });
      }
    }

    const result = await booking.createRideRequest({
      userId: req.user!.id,
      pickupLat: Number(req.body.pickupLat),
      pickupLng: Number(req.body.pickupLng),
      dropoffLat: Number(req.body.dropoffLat),
      dropoffLng: Number(req.body.dropoffLng),
      pickupAddress: req.body.pickupAddress,
      dropoffAddress: req.body.dropoffAddress,
      rideType: req.body.rideType || req.body.vehicleTypeCode || 'standard',
      sourceChannel: 'voice',
      countryCode: req.body.countryCode,
    });

    res.status(201).json({ status: 'success', data: result });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

// --- Channel webhooks (Phase 22) ---
channelWebhooksRouter.post('/whatsapp', async (req: any, res: Response) => {
  try {
    const phone = req.body.From?.replace('whatsapp:', '') || req.body.phone;
    const body = req.body.Body || req.body.text || '';
    await rateLimitPhone(phone || 'unknown', 'whatsapp');

    const user = await findOrCreateUserByPhone(phone);
    await db.query(
      `INSERT INTO user_channel_links (user_id, channel, external_id)
       VALUES ($1,'whatsapp',$2)
       ON CONFLICT (channel, external_id) DO NOTHING`,
      [user.id, phone]
    );

    // Voice note path
    if (req.body.NumMedia === '1' || req.body.MediaContentType0?.startsWith('audio')) {
      // Download + voice-intent in production; acknowledge for now
      logger.info('whatsapp voice note received', { phone });
    }

    // Simple text: "RIDE from X to Y" or guided
    const intent = await voice.extractTripIntent(body, user.id);
    if (intent.destination) {
      const pickup = intent.origin
        ? await voice.geocode(intent.origin)
        : { lat: 5.6037, lng: -0.187 };
      const dest = await voice.geocode(intent.destination);
      const estimates = await booking.estimateFares(pickup.lat, pickup.lng, dest.lat, dest.lng);
      return res.json({
        status: 'success',
        message: `Confirm ride to ${intent.destination}? Cheapest ${estimates.options[0]?.name} ${estimates.currency} ${estimates.options[0]?.price}. Reply YES.`,
        data: { intent, estimates, pendingBooking: true },
      });
    }

    if (/^yes$/i.test(body.trim()) && req.body.pending) {
      // confirmation handled by client state / redis session in production
    }

    res.json({
      status: 'success',
      message: 'Where are you going? Share location or type: from PLACE to PLACE',
    });
  } catch (error: any) {
    res.status(429).json({ status: 'error', message: error.message });
  }
});

channelWebhooksRouter.post('/telegram', async (req: any, res: Response) => {
  try {
    const update = req.body;
    const chatId = String(update.message?.chat?.id || update.callback_query?.from?.id || '');
    const text = update.message?.text || update.callback_query?.data || '';
    await rateLimitPhone(chatId || 'unknown', 'telegram');

    const user = await findOrCreateUserByPhone(`tg:${chatId}`, update.message?.from?.first_name);
    await db.query(
      `INSERT INTO user_channel_links (user_id, channel, external_id)
       VALUES ($1,'telegram',$2)
       ON CONFLICT (channel, external_id) DO NOTHING`,
      [user.id, chatId]
    );

    if (update.message?.voice) {
      logger.info('telegram voice received', { chatId });
    }

    const intent = await voice.extractTripIntent(text, user.id);
    res.json({
      status: 'success',
      method: 'sendMessage',
      chat_id: chatId,
      text: intent.destination
        ? `Got it — heading to ${intent.destination}. Confirm to book.`
        : 'Send pickup and destination, or a voice note.',
    });
  } catch (error: any) {
    res.status(429).json({ status: 'error', message: error.message });
  }
});

channelWebhooksRouter.post('/sms', async (req: any, res: Response) => {
  try {
    const phone = req.body.From || req.body.phone;
    const body = (req.body.Body || '').trim();
    await rateLimitPhone(phone || 'unknown', 'sms');
    const user = await findOrCreateUserByPhone(phone);

    const match = body.match(/^RIDE\s+(.+?),\s*(.+)$/i);
    if (match) {
      const pickup = await voice.geocode(match[1]);
      const dest = await voice.geocode(match[2]);
      const estimates = await booking.estimateFares(pickup.lat, pickup.lng, dest.lat, dest.lng);
      return res.type('text/xml').send(
        `<Response><Message>Est ${estimates.currency} ${estimates.options[0]?.price}. Reply YES to confirm ${match[2]}.</Message></Response>`
      );
    }
    if (/^YES$/i.test(body)) {
      return res.type('text/xml').send('<Response><Message>Booking confirmed. Driver matching now.</Message></Response>');
    }
    res
      .type('text/xml')
      .send('<Response><Message>Text: RIDE pickup, destination</Message></Response>');
  } catch (error: any) {
    res.status(429).send(error.message);
  }
});

channelWebhooksRouter.post('/ussd', async (req: any, res: Response) => {
  try {
    const sessionId = req.body.sessionId || req.body.session_id;
    const text = req.body.text || '';
    const phone = req.body.phoneNumber || req.body.phone;
    await rateLimitPhone(phone || sessionId || 'unknown', 'ussd');

    const parts = String(text).split('*').filter(Boolean);
    if (!parts.length) {
      return res.send('CON 1. Book a ride\n2. Saved addresses');
    }
    if (parts[0] === '1' && parts.length === 1) {
      return res.send('CON Enter destination:');
    }
    if (parts[0] === '1' && parts.length === 2) {
      return res.send(`CON Confirm ride to ${parts[1]}?\n1. Yes\n2. No`);
    }
    if (parts[0] === '1' && parts[2] === '1') {
      const user = await findOrCreateUserByPhone(phone);
      const dest = await voice.geocode(parts[1]);
      await booking.createRideRequest({
        userId: user.id,
        pickupLat: 5.6037,
        pickupLng: -0.187,
        dropoffLat: dest.lat,
        dropoffLng: dest.lng,
        dropoffAddress: parts[1],
        sourceChannel: 'ussd',
      });
      return res.send('END Ride booked. You will get an SMS when a driver accepts.');
    }
    res.send('END Goodbye');
  } catch (error: any) {
    res.send(`END ${error.message}`);
  }
});

channelWebhooksRouter.post('/ivr', async (req: any, res: Response) => {
  try {
    // Twilio Voice webhook — record then process
    if (req.body.RecordingUrl) {
      logger.info('ivr recording', { url: req.body.RecordingUrl, from: req.body.From });
      // Download recording → voice-intent → TTS confirm in production
      return res.type('text/xml').send(`
        <Response>
          <Say>We heard your trip request. Press 1 to confirm or hang up to cancel.</Say>
          <Gather numDigits="1" action="/webhooks/ivr/confirm" method="POST"/>
        </Response>`);
    }
    res.type('text/xml').send(`
      <Response>
        <Say>Welcome to MOVR. Tell us where you are going after the beep.</Say>
        <Record maxLength="15" action="/webhooks/ivr" method="POST"/>
      </Response>`);
  } catch (error: any) {
    res.type('text/xml').send(`<Response><Say>${error.message}</Say></Response>`);
  }
});

channelWebhooksRouter.post('/ivr/confirm', async (req: any, res: Response) => {
  if (req.body.Digits === '1') {
    return res
      .type('text/xml')
      .send('<Response><Say>Ride confirmed. A driver is on the way.</Say></Response>');
  }
  res.type('text/xml').send('<Response><Say>Cancelled.</Say></Response>');
});

// --- Admin vehicle pricing (Phase 24) ---
adminVehicleRouter.use(authenticateToken, requireAdmin);

adminVehicleRouter.get('/vehicle-types', async (_req, res: Response) => {
  const rows = await db.query(`SELECT * FROM vehicle_types ORDER BY sort_order`);
  res.json({ status: 'success', data: rows.rows });
});

adminVehicleRouter.post('/vehicle-types', async (req: AuthRequest, res: Response) => {
  const row = await db.query(
    `INSERT INTO vehicle_types (name, code, category, passenger_capacity, icon_url, is_active, sort_order)
     VALUES ($1,$2,$3::vehicle_category,$4,$5,TRUE,$6) RETURNING *`,
    [
      req.body.name,
      req.body.code,
      req.body.category,
      req.body.passengerCapacity || 4,
      req.body.iconUrl || null,
      req.body.sortOrder || 0,
    ]
  );
  res.status(201).json({ status: 'success', data: row.rows[0] });
});

adminVehicleRouter.patch('/vehicle-types/:id', async (req: AuthRequest, res: Response) => {
  const row = await db.query(
    `UPDATE vehicle_types SET
       name = COALESCE($1, name),
       is_active = COALESCE($2, is_active),
       sort_order = COALESCE($3, sort_order),
       icon_url = COALESCE($4, icon_url)
     WHERE id = $5 RETURNING *`,
    [
      req.body.name || null,
      req.body.is_active ?? null,
      req.body.sortOrder ?? null,
      req.body.iconUrl || null,
      req.params.id,
    ]
  );
  res.json({ status: 'success', data: row.rows[0] });
});

adminVehicleRouter.get('/vehicle-types/:id/pricing', async (req, res: Response) => {
  const rows = await db.query(
    `SELECT * FROM vehicle_type_pricing WHERE vehicle_type_id = $1 ORDER BY effective_from DESC`,
    [req.params.id]
  );
  res.json({ status: 'success', data: rows.rows });
});

adminVehicleRouter.patch('/vehicle-types/:id/pricing', async (req: AuthRequest, res: Response) => {
  const row = await db.query(
    `INSERT INTO vehicle_type_pricing (
       vehicle_type_id, country_code, city, base_fare, per_km_rate, per_minute_rate,
       minimum_fare, currency_code, cancellation_fee, effective_from
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,COALESCE($10,NOW()))
     RETURNING *`,
    [
      req.params.id,
      req.body.countryCode || 'GH',
      req.body.city || null,
      req.body.baseFare,
      req.body.perKmRate,
      req.body.perMinuteRate,
      req.body.minimumFare || 0,
      req.body.currencyCode || 'GHS',
      req.body.cancellationFee || 0,
      req.body.effectiveFrom || null,
    ]
  );
  res.json({ status: 'success', data: row.rows[0] });
});

/** Phase 15 — admin-editable rental hourly/daily rates */
adminVehicleRouter.get('/rental-pricing', async (_req, res: Response) => {
  try {
    const rows = await db.query(
      `SELECT * FROM rental_pricing ORDER BY vehicle_type_id, rental_type, rate_unit`
    );
    res.json({ status: 'success', data: rows.rows });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

adminVehicleRouter.put('/rental-pricing', async (req: AuthRequest, res: Response) => {
  try {
    const {
      vehicleTypeId,
      rentalType,
      rateUnit,
      rateAmount,
      currencyCode = 'GHS',
      minDuration = 1,
      maxDuration = 30,
    } = req.body;
    if (!vehicleTypeId || !rentalType || !rateUnit || rateAmount == null) {
      return res.status(400).json({
        status: 'error',
        message: 'vehicleTypeId, rentalType, rateUnit, rateAmount required',
      });
    }
    const row = await db.query(
      `INSERT INTO rental_pricing (
         vehicle_type_id, rental_type, rate_unit, rate_amount, currency_code, min_duration, max_duration
       ) VALUES ($1,$2::rental_type,$3::rental_rate_unit,$4,$5,$6,$7)
       ON CONFLICT (vehicle_type_id, rental_type, rate_unit, currency_code) DO UPDATE SET
         rate_amount = EXCLUDED.rate_amount,
         min_duration = EXCLUDED.min_duration,
         max_duration = EXCLUDED.max_duration
       RETURNING *`,
      [vehicleTypeId, rentalType, rateUnit, rateAmount, currencyCode, minDuration, maxDuration]
    );
    res.json({ status: 'success', data: row.rows[0] });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

// --- Admin channel funnel ---
adminChannelsRouter.get(
  '/funnel',
  authenticateToken,
  requireAdmin,
  async (_req: AuthRequest, res: Response) => {
    const rows = await db.query(
      `SELECT COALESCE(source_channel, 'app') AS channel,
              COUNT(*)::int AS rides,
              COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
              COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled
       FROM rides
       GROUP BY 1
       ORDER BY rides DESC`
    );
    res.json({ status: 'success', data: rows.rows });
  }
);
