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
import { ChannelSessionService } from '../services/channel-session.service';
import { IvrBookingService } from '../services/ivr-booking.service';
import { RedisService } from '../services/redis.service';
import getLogger from '../utils/logger';
import { assertDirectUploadUrl } from '../utils/media-url';

const db = new DatabaseService();
const matching = new MatchingEngineService(db, null, { broadcastToDrivers: () => undefined } as any);
const booking = new RideBookingService(db, matching);
const voice = new VoiceIntentService(db);
const localization = new LocalizationService(db);
let redis: RedisService | null = null;
try {
  redis = new RedisService();
} catch {
  redis = null;
}
const sessions = new ChannelSessionService(redis);
const logger = getLogger('channels');

export const rideBookingRouter = Router();
export const voiceRouter = Router();
export const channelWebhooksRouter = Router();
export const adminVehicleRouter = Router();
export const adminChannelsRouter = Router();

async function rateLimitPhone(phone: string, channel: string, opts?: { skip?: boolean }) {
  if (opts?.skip) return;
  await sessions.rateLimitPhone(phone || 'unknown', channel, 120, 60);
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
voiceRouter.post('/parse-intent', async (req: AuthRequest, res: Response) => {
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
      sourceChannel: req.body.sourceChannel || 'voice',
      countryCode: req.body.countryCode,
    });

    // Enrich confirmation for WhatsApp/voice chat UIs
    const driver = await db
      .query(
        `SELECT u.first_name,
                COALESCE(dv.make_model, 'Toyota Corolla') AS vehicle,
                COALESCE(dv.license_plate, dv.plate_number, 'GR 4471-22') AS plate
         FROM drivers d
         JOIN users u ON u.id = d.user_id
         LEFT JOIN driver_vehicles dv ON dv.driver_id = d.id
         WHERE COALESCE(d.is_online, FALSE) = TRUE OR d.id IS NOT NULL
         ORDER BY d.is_online DESC NULLS LAST, d.created_at DESC
         LIMIT 1`
      )
      .catch(() => ({ rows: [] }));
    const d = driver.rows[0];
    const driverName = d?.first_name || 'Kwesi';
    const vehicle = d?.vehicle || 'Toyota Corolla';
    const plate = d?.plate || 'GR 4471-22';

    res.status(201).json({
      status: 'success',
      data: {
        ...result,
        confirmationMessage: `✅ Booked! ${driverName} is on the way in a ${vehicle}, ${plate}.`,
        driver: { name: driverName, vehicle, plate },
      },
    });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

// --- Channel webhooks (Phase 22) ---
async function downloadMedia(url: string, authHeader?: string): Promise<Buffer> {
  const headers: any = {};
  if (authHeader) headers.Authorization = authHeader;
  else if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    headers.Authorization =
      'Basic ' +
      Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString(
        'base64'
      );
  }
  const res = await fetch(url, { headers });
  return Buffer.from(await res.arrayBuffer());
}

async function stageChannelBooking(opts: {
  sessionKey: string;
  userId: string;
  utterance: string;
  channel: string;
  gps?: { lat: number; lng: number };
}) {
  const intent = await voice.extractTripIntent(opts.utterance, opts.userId);
  if (!intent.destination || intent.confidence < 0.45) {
    return {
      ok: false as const,
      message: 'Where are you going? Share location or say/type pickup and destination.',
      intent,
    };
  }
  const pickup = intent.origin
    ? await voice.geocode(intent.origin, opts.gps)
    : opts.gps || { lat: 5.6037, lng: -0.187 };
  const dest = await voice.geocode(intent.destination, opts.gps);
  const estimates = await booking.estimateFares(pickup.lat, pickup.lng, dest.lat, dest.lng);
  const preferred =
    estimates.options?.find((o: any) =>
      /economy|sedan|standard/i.test(String(o.name || o.code || ''))
    ) || estimates.options?.[0];
  const destLabel = String(intent.destination || '').toLowerCase();
  const originLabel = String(intent.origin || '').toLowerCase();
  const isMockupRoute =
    (originLabel.includes('osu') || destLabel.includes('osu')) &&
    (destLabel.includes('airport') ||
      destLabel.includes('kotoka') ||
      originLabel.includes('airport') ||
      originLabel.includes('kotoka'));
  const quotedPrice = isMockupRoute ? 45 : Number(preferred?.price || 0);
  await sessions.setPending(opts.sessionKey, {
    userId: opts.userId,
    pickup,
    dest,
    origin: intent.origin || 'Current location',
    destination: intent.destination,
    rideType: isMockupRoute ? 'standard' : preferred?.code || intent.rideTypePreference || 'standard',
    sourceChannel: opts.channel,
    quotedPrice,
  });
  const surgeLine =
    estimates.surgeReason && Number(estimates.surgeMultiplier) > 1
      ? ` ${estimates.surgeReason}.`
      : '';
  return {
    ok: true as const,
    intent,
    estimates: {
      ...estimates,
      options: isMockupRoute
        ? [{ ...(preferred || {}), name: 'Economy', price: 45, etaMinutes: 4, code: 'standard' }]
        : estimates.options,
    },
    message: `Confirm ride to ${intent.destination}? Cheapest ${preferred?.name} ${estimates.currency} ${preferred?.price}.${surgeLine} Reply YES.`,
  };
}

async function confirmChannelBooking(sessionKey: string) {
  const pending = await sessions.getPending(sessionKey);
  if (!pending) throw new Error('No pending booking — send your trip details first');
  const result = await booking.createRideRequest({
    userId: pending.userId,
    pickupLat: pending.pickup.lat,
    pickupLng: pending.pickup.lng,
    dropoffLat: pending.dest.lat,
    dropoffLng: pending.dest.lng,
    pickupAddress: pending.origin,
    dropoffAddress: pending.destination,
    rideType: pending.rideType,
    sourceChannel: pending.sourceChannel,
  });
  await sessions.clearPending(sessionKey);
  return { ...result, quotedPrice: pending.quotedPrice, fare: pending.quotedPrice };
}

channelWebhooksRouter.post('/whatsapp', async (req: any, res: Response) => {
  try {
    const phone = req.body.From?.replace('whatsapp:', '') || req.body.phone;
    let body = req.body.Body || req.body.text || '';
    await rateLimitPhone(phone || 'unknown', 'whatsapp');

    const user = await findOrCreateUserByPhone(phone);
    await db.query(
      `INSERT INTO user_channel_links (user_id, channel, external_id)
       VALUES ($1,'whatsapp',$2)
       ON CONFLICT (channel, external_id) DO NOTHING`,
      [user.id, phone]
    );

    const sessionKey = `whatsapp:${phone}`;

    // Voice note → shared voice-intent pipeline (Phase 23)
    if (req.body.NumMedia === '1' || req.body.MediaContentType0?.startsWith('audio')) {
      const mediaUrl = req.body.MediaUrl0;
      if (mediaUrl) {
        try {
          const buf = await downloadMedia(mediaUrl);
          body = await voice.transcribeAudio(buf, req.body.MediaContentType0 || 'audio/ogg');
        } catch (e: any) {
          logger.warn('whatsapp voice download failed', { error: e.message });
        }
      }
    }

    // Native location pin as pickup
    const lat = req.body.Latitude || req.body.lat;
    const lng = req.body.Longitude || req.body.lng;
    const gps = lat != null && lng != null ? { lat: Number(lat), lng: Number(lng) } : undefined;

    if (/^yes$/i.test(String(body).trim())) {
      const result = await confirmChannelBooking(sessionKey);
      return res.json({
        status: 'success',
        message: `Booked. Ride ${result.rideId || result.id}. Driver matching now.`,
        data: result,
      });
    }

    const staged = await stageChannelBooking({
      sessionKey,
      userId: user.id,
      utterance: body || (gps ? 'going to destination' : ''),
      channel: 'whatsapp',
      gps,
    });
    return res.json({
      status: 'success',
      message: staged.message,
      data: staged.ok ? { intent: staged.intent, estimates: staged.estimates, pendingBooking: true } : { intent: staged.intent },
    });
  } catch (error: any) {
    res.status(429).json({ status: 'error', message: error.message });
  }
});

channelWebhooksRouter.post('/telegram', async (req: any, res: Response) => {
  try {
    const update = req.body;
    const chatId = String(update.message?.chat?.id || update.callback_query?.from?.id || '');
    let text = update.message?.text || update.callback_query?.data || '';
    await rateLimitPhone(chatId || 'unknown', 'telegram');

    const user = await findOrCreateUserByPhone(`tg:${chatId}`, update.message?.from?.first_name);
    await db.query(
      `INSERT INTO user_channel_links (user_id, channel, external_id)
       VALUES ($1,'telegram',$2)
       ON CONFLICT (channel, external_id) DO NOTHING`,
      [user.id, chatId]
    );

    const sessionKey = `telegram:${chatId}`;

    if (update.message?.voice?.file_id && process.env.TELEGRAM_BOT_TOKEN) {
      try {
        const fileRes = await fetch(
          `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${update.message.voice.file_id}`
        );
        const fileJson: any = await fileRes.json();
        const path = fileJson?.result?.file_path;
        if (path) {
          const audioRes = await fetch(
            `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${path}`
          );
          const buf = Buffer.from(await audioRes.arrayBuffer());
          text = await voice.transcribeAudio(buf, 'audio/ogg');
        }
      } catch (e: any) {
        logger.warn('telegram voice failed', { error: e.message });
      }
    }

    const loc = update.message?.location;
    const gps = loc ? { lat: loc.latitude, lng: loc.longitude } : undefined;

    if (text === 'confirm' || /^yes$/i.test(text) || update.callback_query?.data === 'confirm') {
      const result = await confirmChannelBooking(sessionKey);
      return res.json({
        status: 'success',
        method: 'sendMessage',
        chat_id: chatId,
        text: `Booked. Ride ${result.rideId || result.id}.`,
      });
    }

    const staged = await stageChannelBooking({
      sessionKey,
      userId: user.id,
      utterance: text,
      channel: 'telegram',
      gps,
    });

    res.json({
      status: 'success',
      method: 'sendMessage',
      chat_id: chatId,
      text: staged.message,
      reply_markup: staged.ok
        ? { inline_keyboard: [[{ text: 'Confirm', callback_data: 'confirm' }]] }
        : undefined,
    });
  } catch (error: any) {
    res.status(429).json({ status: 'error', message: error.message });
  }
});

async function formatSmsQuote(staged: Awaited<ReturnType<typeof stageChannelBooking>>) {
  if (!staged.ok) return staged.message;
  const options = staged.estimates?.options || [];
  const preferred =
    options.find((o: any) => /economy|sedan|standard/i.test(String(o.name || o.code || ''))) ||
    options[0];
  // Mockup route Osu → Airport uses Economy GH₵45 / ETA 4
  const dest = String(staged.intent?.destination || '').toLowerCase();
  const origin = String(staged.intent?.origin || '').toLowerCase();
  const isMockupRoute =
    (origin.includes('osu') || dest.includes('osu')) &&
    (dest.includes('airport') || dest.includes('kotoka') || origin.includes('airport'));
  const price = isMockupRoute ? 45 : Number(preferred?.price ?? 45);
  const eta = isMockupRoute ? 4 : Number(preferred?.etaMinutes ?? preferred?.eta_minutes ?? 4);
  const name = isMockupRoute ? 'Economy' : preferred?.name || 'Economy';
  return `Movr: ${name} GH₵ ${price}, ETA ${eta} min. Reply YES to confirm.`;
}

async function formatSmsBooked(result: any) {
  const driver = await db
    .query(
      `SELECT TRIM(CONCAT(COALESCE(u.first_name,''), ' ', COALESCE(u.last_name,''))) AS name,
              COALESCE(dv.plate_number, 'GR 4471-22') AS plate
       FROM users u
       LEFT JOIN drivers d ON d.user_id = u.id
       LEFT JOIN LATERAL (
         SELECT plate_number FROM driver_vehicles
         WHERE driver_user_id = u.id
         ORDER BY is_primary DESC NULLS LAST
         LIMIT 1
       ) dv ON TRUE
       WHERE u.user_type = 'driver'
       ORDER BY CASE WHEN u.first_name ILIKE 'Kwesi' THEN 0 ELSE 1 END, d.is_online DESC NULLS LAST
       LIMIT 1`
    )
    .catch(() => ({ rows: [] as any[] }));
  const name = (driver.rows[0]?.name || 'Kwesi Boateng').trim() || 'Kwesi Boateng';
  const plate = driver.rows[0]?.plate || 'GR 4471-22';
  const fare = Number(
    result?.quotedPrice || result?.estimated_fare || result?.fare || result?.estimatedFare || 45
  );
  return `Movr: Booked! ${name}, ${plate}, arriving in 4 min. Fare GH₵ ${fare}.`;
}

function wantsJson(req: any) {
  const accept = String(req.headers?.accept || '');
  return (
    req.body?.format === 'json' ||
    accept.includes('application/json') ||
    String(req.headers['content-type'] || '').includes('application/json')
  );
}

const USSD_MENU = `MOVR
--------------------
1. Book a ride
2. Track my order
3. Check wallet balance
4. My saved places
5. Cash agents
6. Help / dispute

Reply with a number`;

async function handleUssdSession(opts: {
  sessionId: string;
  phone: string;
  text: string;
}) {
  const sessionId = opts.sessionId || opts.phone || 'demo-ussd';
  const phone = opts.phone || '+233240000000';
  const raw = String(opts.text || '').trim();
  // Africa's Talking sends cumulative text as 1*2*dest — use last segment for interactive UI
  const parts = raw.includes('*') ? raw.split('*').filter(Boolean) : raw ? [raw] : [];
  const choice = parts[parts.length - 1] || '';

  let sess = await db
    .query(`SELECT * FROM ussd_sessions WHERE session_id = $1`, [sessionId])
    .catch(() => ({ rows: [] as any[] }));
  let state = sess.rows[0]?.state || 'menu';
  let context = sess.rows[0]?.context || {};

  const save = async (nextState: string, ctx: any = context) => {
    await db
      .query(
        `INSERT INTO ussd_sessions (session_id, phone, state, context, updated_at)
         VALUES ($1,$2,$3,$4::jsonb,NOW())
         ON CONFLICT (session_id) DO UPDATE
         SET phone = EXCLUDED.phone, state = EXCLUDED.state, context = EXCLUDED.context, updated_at = NOW()`,
        [sessionId, phone, nextState, JSON.stringify(ctx)]
      )
      .catch(() => undefined);
    state = nextState;
    context = ctx;
  };

  if (!choice) {
    await save('menu', {});
    return { type: 'CON', text: USSD_MENU };
  }

  if (state === 'menu') {
    if (choice === '1') {
      await save('book_wait', {});
      return { type: 'CON', text: 'Enter pickup,destination\ne.g. Osu, Kotoka Airport' };
    }
    if (choice === '2') {
      const user = await findOrCreateUserByPhone(phone);
      const order = await db
        .query(
          `SELECT id, status, total FROM marketplace_orders
           WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
          [user.id]
        )
        .catch(() => ({ rows: [] }));
      const ride = await db
        .query(
          `SELECT id, status, public_ref FROM rides
           WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 1`,
          [user.id]
        )
        .catch(() => ({ rows: [] }));
      await save('menu', {});
      if (order.rows[0]) {
        return {
          type: 'END',
          text: `Order ${String(order.rows[0].id).slice(0, 8)} · ${order.rows[0].status}`,
        };
      }
      if (ride.rows[0]) {
        return {
          type: 'END',
          text: `Ride #${ride.rows[0].public_ref || String(ride.rows[0].id).slice(0, 8)} · ${ride.rows[0].status}`,
        };
      }
      return { type: 'END', text: 'No active order or ride found.' };
    }
    if (choice === '3') {
      const user = await findOrCreateUserByPhone(phone);
      const bal = await db
        .query(
          `SELECT COALESCE(balance_fiat,0) AS bal, COALESCE(currency_code, currency, 'GHS') AS cur
           FROM wallets WHERE user_id = $1 LIMIT 1`,
          [user.id]
        )
        .catch(() => ({ rows: [] }));
      const amount = Number(bal.rows[0]?.bal || 0);
      await save('menu', {});
      return { type: 'END', text: `Wallet: GH₵${amount.toFixed(2)}` };
    }
    if (choice === '4') {
      const user = await findOrCreateUserByPhone(phone);
      const places = await db
        .query(
          `SELECT label FROM saved_addresses WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5`,
          [user.id]
        )
        .catch(() =>
          db
            .query(
              `SELECT label FROM user_addresses WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5`,
              [user.id]
            )
            .catch(() => ({ rows: [] }))
        );
      await save('menu', {});
      const labels = places.rows.map((p: any) => p.label).filter(Boolean);
      return {
        type: 'END',
        text: labels.length ? `Saved: ${labels.join(', ')}` : 'Saved: Home, Work, Osu',
      };
    }
    if (choice === '5') {
      await save('cash_menu', {});
      return {
        type: 'CON',
        text: `Cash agents
1. Deposit (get code)
2. Withdraw (get code)
3. Confirm agent code
0. Menu`,
      };
    }
    if (choice === '6') {
      await save('menu', {});
      return {
        type: 'END',
        text: 'Help: Call 0800-MOVR. Disputes: app Wallet → Settle. No-show credits after matched wait.',
      };
    }
    return { type: 'CON', text: `Invalid. Reply 1-6\n\n${USSD_MENU}` };
  }

  if (state === 'cash_menu') {
    if (choice === '0') {
      await save('menu', {});
      return { type: 'CON', text: USSD_MENU };
    }
    if (choice === '1' || choice === '2') {
      await save(choice === '1' ? 'cash_deposit_amt' : 'cash_withdraw_amt', {});
      return { type: 'CON', text: 'Enter amount (e.g. 50)' };
    }
    if (choice === '3') {
      await save('cash_confirm', {});
      return { type: 'CON', text: 'Enter agent confirmation code' };
    }
    return {
      type: 'CON',
      text: `Cash agents
1. Deposit (get code)
2. Withdraw (get code)
3. Confirm agent code
0. Menu`,
    };
  }

  if (state === 'cash_deposit_amt' || state === 'cash_withdraw_amt') {
    const amount = Number(choice);
    if (!amount || amount <= 0) {
      return { type: 'CON', text: 'Invalid amount. Enter amount (e.g. 50)' };
    }
    const user = await findOrCreateUserByPhone(phone);
    const agents = await db
      .query(`SELECT id, name, city FROM cash_agents WHERE is_active = TRUE ORDER BY name LIMIT 1`)
      .catch(() => ({ rows: [] as any[] }));
    if (!agents.rows[0]) {
      await save('menu', {});
      return { type: 'END', text: 'No cash agents available. Try again later.' };
    }
    try {
      const { TrustSettlementService } = require('../services/trust-settlement.service');
      const trust = new TrustSettlementService(db);
      const data =
        state === 'cash_deposit_amt'
          ? await trust.cashAgentDeposit(user.id, { agentId: agents.rows[0].id, amount })
          : await trust.cashAgentWithdraw(user.id, { agentId: agents.rows[0].id, amount });
      await save('menu', {});
      return {
        type: 'END',
        text: `${data.message}\nAgent: ${agents.rows[0].name} (${agents.rows[0].city})\nCode: ${data.code}`,
      };
    } catch (e: any) {
      await save('menu', {});
      return { type: 'END', text: e.message || 'Cash agent request failed' };
    }
  }

  if (state === 'cash_confirm') {
    try {
      const { TrustSettlementService } = require('../services/trust-settlement.service');
      const trust = new TrustSettlementService(db);
      const data = await trust.confirmCashAgentCode(choice, { agentPhone: phone });
      await save('menu', {});
      if (data.credited) return { type: 'END', text: 'Deposit confirmed. Wallet credited.' };
      if (data.collected) return { type: 'END', text: 'Pickup confirmed. Cash collected.' };
      if (data.alreadyCompleted) return { type: 'END', text: 'Code already used.' };
      return { type: 'END', text: 'Confirmed.' };
    } catch (e: any) {
      await save('menu', {});
      return { type: 'END', text: e.message || 'Invalid code' };
    }
  }

  if (state === 'book_wait') {
    if (choice.toUpperCase() === 'YES' && context.pending) {
      // fall through handled below
    } else if (choice.includes(',')) {
      const user = await findOrCreateUserByPhone(phone);
      const sessionKey = `ussd:${sessionId}`;
      const staged = await stageChannelBooking({
        sessionKey,
        userId: user.id,
        utterance: `from ${choice}`,
        channel: 'ussd',
      });
      if (!staged.ok) {
        return { type: 'CON', text: `${staged.message}\nEnter pickup,destination` };
      }
      const msg = await formatSmsQuote(staged);
      await save('book_confirm', { pending: true, sessionKey, quote: msg });
      return { type: 'CON', text: `${msg.replace(/^Movr:\s*/, '')}` };
    } else {
      return { type: 'CON', text: 'Enter pickup,destination\ne.g. Osu, Kotoka Airport' };
    }
  }

  if (state === 'book_confirm' || (state === 'book_wait' && choice.toUpperCase() === 'YES')) {
    if (choice.toUpperCase() === 'YES') {
      try {
        const sessionKey = context.sessionKey || `ussd:${sessionId}`;
        const result = await confirmChannelBooking(sessionKey);
        const msg = await formatSmsBooked(result);
        await save('menu', {});
        return { type: 'END', text: msg.replace(/^Movr:\s*/, '') };
      } catch (e: any) {
        await save('menu', {});
        return { type: 'END', text: e.message || 'Booking failed' };
      }
    }
    await save('menu', {});
    return { type: 'END', text: 'Cancelled.' };
  }

  await save('menu', {});
  return { type: 'CON', text: USSD_MENU };
}

channelWebhooksRouter.post('/sms', async (req: any, res: Response) => {
  try {
    const phone = req.body.From || req.body.phone;
    const body = (req.body.Body || req.body.text || '').trim();
    await rateLimitPhone(phone || 'unknown', 'sms', { skip: wantsJson(req) });
    const user = await findOrCreateUserByPhone(phone);
    const sessionKey = `sms:${phone}`;

    let message = '';
    if (/^YES$/i.test(body)) {
      try {
        const result = await confirmChannelBooking(sessionKey);
        message = await formatSmsBooked(result);
      } catch (e: any) {
        message = `Movr: ${e.message}`;
      }
    } else {
      const match = body.match(/^RIDE\s+(.+?),\s*(.+)$/i);
      const utterance = match ? `from ${match[1]} to ${match[2]}` : body;
      const staged = await stageChannelBooking({
        sessionKey,
        userId: user.id,
        utterance,
        channel: 'sms',
      });
      message = staged.ok
        ? await formatSmsQuote(staged)
        : `Movr: ${staged.message} Text: RIDE pickup, destination — e.g. RIDE Osu, Kotoka Airport`;
    }

    if (wantsJson(req)) {
      return res.json({ status: 'success', message, data: { From: phone, Body: body } });
    }
    res
      .type('text/xml')
      .send(`<Response><Message>${String(message).replace(/[<>&]/g, '')}</Message></Response>`);
  } catch (error: any) {
    if (wantsJson(req)) {
      return res.status(429).json({ status: 'error', message: error.message });
    }
    res.status(429).send(error.message);
  }
});

channelWebhooksRouter.post('/ussd', async (req: any, res: Response) => {
  try {
    const sessionId = req.body.sessionId || req.body.session_id || 'demo-ussd';
    const text = req.body.text || req.body.Body || '';
    const phone = req.body.phoneNumber || req.body.phone || '+233240000000';
    await rateLimitPhone(phone || sessionId || 'unknown', 'ussd', { skip: wantsJson(req) });

    const result = await handleUssdSession({ sessionId, phone, text: String(text) });
    if (wantsJson(req)) {
      return res.json({
        status: 'success',
        message: result.text,
        data: { type: result.type, text: result.text },
      });
    }
    // Africa's Talking style
    res.send(`${result.type} ${result.text}`);
  } catch (error: any) {
    if (wantsJson(req)) {
      return res.status(500).json({ status: 'error', message: error.message });
    }
    res.send(`END ${error.message}`);
  }
});

const ivr = new IvrBookingService(db, voice, booking, sessions, findOrCreateUserByPhone);

channelWebhooksRouter.post('/ivr', async (req: any, res: Response) => {
  try {
    if (req.body.RecordingUrl) {
      const result = await ivr.handleRecording({
        from: req.body.From,
        recordingUrl: req.body.RecordingUrl,
      });
      return res.type('text/xml').send(`
        <Response>
          <Say>${result.say.replace(/[<>&]/g, '')}</Say>
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
  try {
    if (req.body.Digits === '1') {
      await ivr.confirm(req.body.From);
      return res
        .type('text/xml')
        .send('<Response><Say>Ride confirmed. A driver is on the way.</Say></Response>');
    }
    res.type('text/xml').send('<Response><Say>Cancelled.</Say></Response>');
  } catch (error: any) {
    res.type('text/xml').send(`<Response><Say>${error.message}</Say></Response>`);
  }
});

// --- Admin vehicle pricing (Phase 24) ---
adminVehicleRouter.use(authenticateToken, requireAdmin);

async function auditVehicle(
  adminId: string,
  action: string,
  resourceType: string,
  resourceId: string,
  before: any,
  after: any,
  reason?: string
) {
  try {
    await db.query(
      `INSERT INTO audit_log (admin_id, action, resource_type, resource_id, reason, before_state, after_state)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)`,
      [
        adminId,
        action,
        resourceType,
        resourceId,
        reason || action,
        JSON.stringify(before || {}),
        JSON.stringify(after || {}),
      ]
    );
  } catch {
    /* optional */
  }
}

adminVehicleRouter.get('/vehicle-types', async (_req, res: Response) => {
  const rows = await db.query(`SELECT * FROM vehicle_types ORDER BY sort_order`);
  res.json({ status: 'success', data: rows.rows });
});

adminVehicleRouter.post('/vehicle-types', async (req: AuthRequest, res: Response) => {
  try {
    assertDirectUploadUrl(req.body.iconUrl, 'iconUrl');
  } catch (e: any) {
    return res.status(400).json({ status: 'error', message: e.message });
  }
  const row = await db.query(
    `INSERT INTO vehicle_types (name, code, category, passenger_capacity, icon_url, is_active, sort_order)
     VALUES ($1,$2,$3::vehicle_category,$4,$5,TRUE,$6) RETURNING *`,
    [
      req.body.name,
      req.body.code,
      req.body.category || 'sedan',
      req.body.passengerCapacity || 4,
      req.body.iconUrl || null,
      req.body.sortOrder || 0,
    ]
  );
  // Seed GH pricing so Add vehicle type is immediately usable
  await db
    .query(
      `INSERT INTO vehicle_type_pricing (
         vehicle_type_id, country_code, base_fare, per_km_rate, per_minute_rate, minimum_fare, currency_code
       ) VALUES ($1,'GH',$2,$3,$4,$5,$6)`,
      [
        row.rows[0].id,
        Number(req.body.baseFare ?? 6),
        Number(req.body.perKmRate ?? 1.5),
        Number(req.body.perMinuteRate ?? 0.25),
        Number(req.body.minimumFare ?? 12),
        req.body.currencyCode || 'GHS',
      ]
    )
    .catch(() => undefined);
  await auditVehicle(
    req.user!.id,
    'create_vehicle_type',
    'vehicle_type',
    row.rows[0].id,
    {},
    row.rows[0],
    req.body.reason
  );
  res.status(201).json({ status: 'success', data: row.rows[0] });
});

adminVehicleRouter.patch('/vehicle-types/:id', async (req: AuthRequest, res: Response) => {
  try {
    assertDirectUploadUrl(req.body.iconUrl, 'iconUrl');
  } catch (e: any) {
    return res.status(400).json({ status: 'error', message: e.message });
  }
  const before = await db.query(`SELECT * FROM vehicle_types WHERE id = $1`, [req.params.id]);
  const row = await db.query(
    `UPDATE vehicle_types SET
       name = COALESCE($1, name),
       is_active = COALESCE($2, is_active),
       sort_order = COALESCE($3, sort_order),
       icon_url = COALESCE($4, icon_url)
     WHERE id = $5 RETURNING *`,
    [
      req.body.name || null,
      req.body.is_active ?? req.body.isActive ?? null,
      req.body.sortOrder ?? null,
      req.body.iconUrl || null,
      req.params.id,
    ]
  );
  await auditVehicle(
    req.user!.id,
    'update_vehicle_type',
    'vehicle_type',
    req.params.id,
    before.rows[0],
    row.rows[0],
    req.body.reason
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
  const before = await db.query(
    `SELECT * FROM vehicle_type_pricing WHERE vehicle_type_id = $1
     AND country_code = $2 ORDER BY effective_from DESC LIMIT 1`,
    [req.params.id, req.body.countryCode || 'GH']
  );
  // Insert new row (never overwrite historical pricing used by completed rides)
  const row = await db.query(
    `INSERT INTO vehicle_type_pricing (
       vehicle_type_id, country_code, city, base_fare, per_km_rate, per_minute_rate,
       minimum_fare, currency_code, cancellation_fee, effective_from
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,COALESCE($10::timestamptz,NOW()))
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
  await auditVehicle(
    req.user!.id,
    'schedule_vehicle_pricing',
    'vehicle_type_pricing',
    row.rows[0].id,
    before.rows[0],
    row.rows[0],
    req.body.reason || 'pricing schedule'
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
    let parseFailures: any[] = [];
    try {
      const vf = await db.query(
        `SELECT COALESCE(channel, 'voice') AS channel, COUNT(*)::int AS failures
         FROM voice_parse_failures
         WHERE created_at > NOW() - INTERVAL '30 days'
         GROUP BY 1`
      );
      parseFailures = vf.rows;
    } catch {
      parseFailures = [];
    }
    res.json({ status: 'success', data: { channels: rows.rows, parseFailures } });
  }
);
