import { randomUUID } from 'crypto';
import axios from 'axios';
import { DatabaseService } from './database.service';
import { VoiceIntentService } from './voice-intent.service';
import { RideBookingService } from './ride-booking.service';
import { MarketplaceService } from './marketplace.service';
import { PaymentService } from './payment.service';
import { MatchingEngineService } from './matching-engine.service';
import { RankingService } from './ranking.service';
import { RedisService } from './redis.service';
import getLogger from '../utils/logger';

export type AiChatCard = {
  kind: 'fare' | 'store' | 'info';
  title: string;
  subtitle?: string;
  price?: string | number;
  badge?: string;
  href?: string;
  meta?: Record<string, any>;
};

export type AiChatAction = {
  label: string;
  href?: string;
  action?: string;
  payload?: Record<string, any>;
};

export type AiChatResult = {
  sessionId: string;
  reply: string;
  cards: AiChatCard[];
  actions: AiChatAction[];
  needsAuth?: boolean;
  pendingBooking?: Record<string, any> | null;
  escalated?: boolean;
  ticketId?: string | null;
};

type SessionState = {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  lastEstimate?: {
    pickup: { address: string; lat: number; lng: number };
    destination: { address: string; lat: number; lng: number };
    options: any[];
    countryCode: string;
  };
  updatedAt: number;
};

/** In-memory fallback. Prefer Redis when available (multi-instance safe). TTL = 1h. */
const sessions = new Map<string, SessionState>();
const SESSION_TTL_MS = 1000 * 60 * 60;
const SESSION_TTL_SEC = Math.floor(SESSION_TTL_MS / 1000);

const SYSTEM_PROMPT = `You are Movr AI, the intelligent assistant for Movr — a mobility and commerce platform (rides, shop, deliver, rentals, wallet).
Return JSON only with this shape:
{
  "intent": "estimate_ride" | "book_ride" | "search_stores" | "explain_pricing" | "help_lookup" | "navigate" | "escalate" | "rank_leaders" | "recommend" | "track_ride" | "track_order" | "wallet_balance" | "safety_sos_info" | "dispute_help" | "merchant_hours" | "chat",
  "reply": "short helpful message to the user",
  "origin": "pickup place or null",
  "destination": "dropoff place or null",
  "rideType": "economy|comfort|standard|null",
  "storeQuery": "search string or null",
  "navigateTo": "ride|shop|deliver|wallet|help|drivers|merchants|download|ai|safety|null",
  "helpTopic": "short topic or null",
  "rankType": "stores|drivers|riders|null"
}
Rules:
- For fare/price/how much / airport / from X to Y → estimate_ride
- For book / confirm / yes book it → book_ride
- For shops, groceries, stores, buy → search_stores
- For recommend / for me / suggestions / what should I → recommend
- For top stores / best merchants / rank drivers / best riders → rank_leaders
- For where is my ride / track ride / driver eta → track_ride
- For where is my order / package status → track_order
- For wallet balance / how much money → wallet_balance
- For SOS / emergency / safety centre → safety_sos_info
- For dispute / refund / no-show credit → dispute_help
- For store hours / is X open → merchant_hours
- For speak to human / agent / real person / escalate / complaint beyond AI → escalate
- For driver commission, subscription, how pricing works → explain_pricing
- For help/support → help_lookup
- For "take me to marketplace" etc → navigate
- Otherwise chat with a brief Movr-oriented answer
Keep reply under 2 sentences.`;

/**
 * Multi-domain Movr AI — rides/rates, shop search, pricing copy, help, deep-links.
 */
export class MovrAiService {
  private logger = getLogger('movr-ai');
  private voice: VoiceIntentService;
  private booking: RideBookingService;
  private marketplace: MarketplaceService;
  private ranking: RankingService;
  private redis: RedisService | null = null;

  constructor(private db: DatabaseService) {
    this.voice = new VoiceIntentService(db);
    const matching = new MatchingEngineService(db, null, {
      broadcastToDrivers: () => undefined,
    } as any);
    this.booking = new RideBookingService(db, matching);
    this.marketplace = new MarketplaceService(db, new PaymentService(db));
    this.ranking = new RankingService(db);
    try {
      this.redis = new RedisService();
    } catch {
      this.redis = null;
      this.logger.warn('AI sessions: Redis unavailable — using in-memory Map (TTL 1h, not multi-instance safe)');
    }
  }

  async chat(input: {
    message: string;
    sessionId?: string;
    userId?: string;
    countryCode?: string;
    lat?: number;
    lng?: number;
  }): Promise<AiChatResult> {
    const sessionId = input.sessionId || randomUUID();
    const session = await this.getSession(sessionId);
    const message = (input.message || '').trim();
    if (!message) {
      return {
        sessionId,
        reply: 'Tell me where you want to go, what to buy, or ask about rates.',
        cards: [],
        actions: [
          { label: 'Book a ride', href: '/login' },
          { label: 'Browse stores', href: '/marketplace' },
          { label: 'Help centre', href: '/help' },
        ],
      };
    }

    session.messages.push({ role: 'user', content: message });
    this.prune(session);

    const plan = await this.plan(message, session);
    const gps = {
      lat: Number(input.lat ?? 5.6037),
      lng: Number(input.lng ?? -0.187),
    };
    const countryCode = (input.countryCode || 'GH').toUpperCase();

    let result: AiChatResult;

    switch (plan.intent) {
      case 'estimate_ride':
        result = await this.estimateRide(sessionId, session, plan, gps, countryCode, input.userId);
        break;
      case 'book_ride':
        result = await this.bookRide(sessionId, session, plan, input.userId, countryCode);
        break;
      case 'search_stores':
        result = await this.searchStores(sessionId, plan, input.userId, gps);
        break;
      case 'recommend':
        result = await this.recommend(sessionId, plan, input.userId, gps);
        break;
      case 'rank_leaders':
        result = await this.rankLeaders(sessionId, plan, input.userId, gps);
        break;
      case 'track_ride':
        result = await this.trackRide(sessionId, input.userId);
        break;
      case 'track_order':
        result = await this.trackOrder(sessionId, input.userId);
        break;
      case 'wallet_balance':
        result = await this.walletBalance(sessionId, input.userId);
        break;
      case 'safety_sos_info':
        result = await this.safetyInfo(sessionId, input.userId);
        break;
      case 'dispute_help':
        result = this.disputeHelp(sessionId, plan);
        break;
      case 'merchant_hours':
        result = await this.merchantHours(sessionId, plan);
        break;
      case 'escalate':
        result = await this.escalate(sessionId, session, plan, input.userId);
        break;
      case 'explain_pricing':
        result = this.explainPricing(sessionId, plan);
        break;
      case 'help_lookup':
        result = await this.helpLookup(sessionId, plan);
        break;
      case 'navigate':
        result = this.navigate(sessionId, plan);
        break;
      default:
        result = {
          sessionId,
          reply:
            plan.reply ||
            'I can quote rides, recommend stores, check your wallet, or connect you to a live agent. What do you need?',
          cards: [],
          actions: [
            { label: 'Get a fare', action: 'suggest', payload: { text: 'How much from Osu to the airport?' } },
            { label: 'For you', action: 'suggest', payload: { text: 'Recommend something for me' } },
            { label: 'Talk to a human', action: 'escalate' },
          ],
        };
    }

    session.messages.push({ role: 'assistant', content: result.reply });
    await this.saveSession(sessionId, session);
    return result;
  }

  private sessionKey(id: string) {
    return `movr-ai:session:${id}`;
  }

  /** Load session from memory, then Redis; create fresh if expired/missing. */
  private async getSession(id: string): Promise<SessionState> {
    const existing = sessions.get(id);
    if (existing && Date.now() - existing.updatedAt < SESSION_TTL_MS) {
      existing.updatedAt = Date.now();
      return existing;
    }
    if (this.redis?.get) {
      try {
        const cached = await this.redis.get<SessionState>(this.sessionKey(id));
        if (cached?.messages && Date.now() - Number(cached.updatedAt || 0) < SESSION_TTL_MS) {
          cached.updatedAt = Date.now();
          sessions.set(id, cached);
          return cached;
        }
      } catch {
        /* fall through to memory */
      }
    }
    const fresh: SessionState = { messages: [], updatedAt: Date.now() };
    sessions.set(id, fresh);
    return fresh;
  }

  private async saveSession(id: string, session: SessionState) {
    session.updatedAt = Date.now();
    sessions.set(id, session);
    if (this.redis?.set) {
      try {
        await this.redis.set(this.sessionKey(id), session, SESSION_TTL_SEC);
      } catch {
        /* memory already updated */
      }
    }
  }

  private prune(session: SessionState) {
    if (session.messages.length > 16) {
      session.messages = session.messages.slice(-16);
    }
    session.updatedAt = Date.now();
  }

  private async plan(message: string, session: SessionState) {
    const { resolveOpenAiApiKey, resolveOpenAiModel } = require('../utils/openai-credentials');
    const apiKey = await resolveOpenAiApiKey(this.db);
    const model = await resolveOpenAiModel(this.db);
    if (apiKey) {
      try {
        const response = await axios.post(
          'https://api.openai.com/v1/chat/completions',
          {
            model,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              ...session.messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
              { role: 'user', content: message },
            ],
            temperature: 0.2,
          },
          { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 12000 }
        );
        const parsed = JSON.parse(response.data.choices[0].message.content);
        return {
          intent: String(parsed.intent || 'chat'),
          reply: String(parsed.reply || ''),
          origin: parsed.origin || null,
          destination: parsed.destination || null,
          rideType: parsed.rideType || null,
          storeQuery: parsed.storeQuery || null,
          navigateTo: parsed.navigateTo || null,
          helpTopic: parsed.helpTopic || null,
          rankType: parsed.rankType || null,
        };
      } catch (err: any) {
        this.logger.warn('LLM plan failed — heuristic', { error: err?.message });
      }
    }
    return this.heuristicPlan(message);
  }

  private heuristicPlan(message: string) {
    const t = message.toLowerCase();
    if (/\b(human|agent|specialist|real person|escalate|complaint|manager|fraud|refund dispute)\b/.test(t)) {
      return {
        intent: 'escalate',
        reply: '',
        origin: null,
        destination: null,
        rideType: null,
        storeQuery: null,
        navigateTo: null,
        helpTopic: null,
        rankType: null,
      };
    }
    if (/\b(recommend|for me|suggestion|what should i|personalize)\b/.test(t)) {
      return {
        intent: 'recommend',
        reply: '',
        origin: null,
        destination: null,
        rideType: null,
        storeQuery: null,
        navigateTo: null,
        helpTopic: null,
        rankType: null,
      };
    }
    if (/\b(track (my )?ride|where('s| is) my (driver|ride)|ride status|eta)\b/.test(t)) {
      return {
        intent: 'track_ride',
        reply: '',
        origin: null,
        destination: null,
        rideType: null,
        storeQuery: null,
        navigateTo: null,
        helpTopic: null,
        rankType: null,
      };
    }
    if (/\b(track (my )?order|where('s| is) my (order|package|parcel)|order status)\b/.test(t)) {
      return {
        intent: 'track_order',
        reply: '',
        origin: null,
        destination: null,
        rideType: null,
        storeQuery: null,
        navigateTo: null,
        helpTopic: null,
        rankType: null,
      };
    }
    if (/\b(wallet|balance|how much (do i|money)|top.?up)\b/.test(t) && !/\b(fare|ride|from|to)\b/.test(t)) {
      return {
        intent: 'wallet_balance',
        reply: '',
        origin: null,
        destination: null,
        rideType: null,
        storeQuery: null,
        navigateTo: 'wallet',
        helpTopic: null,
        rankType: null,
      };
    }
    if (/\b(sos|emergency|safety centre|safety center|share trip)\b/.test(t)) {
      return {
        intent: 'safety_sos_info',
        reply: '',
        origin: null,
        destination: null,
        rideType: null,
        storeQuery: null,
        navigateTo: 'safety',
        helpTopic: null,
        rankType: null,
      };
    }
    if (/\b(dispute|refund|no-?show|compensation|trust)\b/.test(t)) {
      return {
        intent: 'dispute_help',
        reply: '',
        origin: null,
        destination: null,
        rideType: null,
        storeQuery: null,
        navigateTo: null,
        helpTopic: 'dispute',
        rankType: null,
      };
    }
    if (/\b(open|hours|closing|when does).*(store|shop|restaurant)|\b(store|shop) hours\b/.test(t)) {
      return {
        intent: 'merchant_hours',
        reply: '',
        origin: null,
        destination: null,
        rideType: null,
        storeQuery: message,
        navigateTo: null,
        helpTopic: null,
        rankType: null,
      };
    }
    if (/\b(top store|best store|best merchant|rank|leaderboard|top driver|best rider|top rated)\b/.test(t)) {
      const rankType = /\bdriver/.test(t) ? 'drivers' : /\brider/.test(t) ? 'riders' : 'stores';
      return {
        intent: 'rank_leaders',
        reply: '',
        origin: null,
        destination: null,
        rideType: null,
        storeQuery: null,
        navigateTo: null,
        helpTopic: null,
        rankType,
      };
    }
    if (/\b(book|confirm|yes book|go ahead)\b/.test(t)) {
      return {
        intent: 'book_ride',
        reply: 'Booking that for you.',
        origin: null,
        destination: null,
        rideType: /comfort|premium/.test(t) ? 'comfort' : 'economy',
        storeQuery: null,
        navigateTo: null,
        helpTopic: null,
      };
    }
    if (
      /\b(how much|fare|price|cost|airport|from .+ to |ride to|going to)\b/.test(t) ||
      /from\s+.+\s+to\s+/.test(t)
    ) {
      const fromTo = message.match(/from\s+(.+?)\s+to\s+(.+)/i);
      const toOnly = message.match(/(?:to|airport)\s*(.*)/i);
      return {
        intent: 'estimate_ride',
        reply: '',
        origin: fromTo?.[1]?.trim() || null,
        destination: fromTo?.[2]?.replace(/[?.!].*$/, '').trim() || (/\bairport\b/.test(t) ? 'airport' : toOnly?.[1]?.trim() || null),
        rideType: null,
        storeQuery: null,
        navigateTo: null,
        helpTopic: null,
      };
    }
    if (/\b(shop|store|grocery|market|buy|food|fashion)\b/.test(t)) {
      return {
        intent: 'search_stores',
        reply: '',
        origin: null,
        destination: null,
        rideType: null,
        storeQuery: message.replace(/find|search|show|me|stores?|for/gi, '').trim() || 'all',
        navigateTo: null,
        helpTopic: null,
      };
    }
    if (/\b(commission|subscription|driver pay|pricing|rates?)\b/.test(t)) {
      return {
        intent: 'explain_pricing',
        reply: '',
        origin: null,
        destination: null,
        rideType: null,
        storeQuery: null,
        navigateTo: null,
        helpTopic: null,
      };
    }
    if (/\b(help|support|safety|dispute|cancel)\b/.test(t)) {
      return {
        intent: 'help_lookup',
        reply: '',
        origin: null,
        destination: null,
        rideType: null,
        storeQuery: null,
        navigateTo: null,
        helpTopic: message,
      };
    }
    if (/\b(wallet|marketplace|merchant|driver|download|deliver)\b/.test(t)) {
      const navigateTo = /\bwallet\b/.test(t)
        ? 'wallet'
        : /\bmerchant\b/.test(t)
          ? 'merchants'
          : /\bdriver\b/.test(t)
            ? 'drivers'
            : /\bdownload\b/.test(t)
              ? 'download'
              : /\bdeliver\b/.test(t)
                ? 'deliver'
                : 'shop';
      return {
        intent: 'navigate',
        reply: '',
        origin: null,
        destination: null,
        rideType: null,
        storeQuery: null,
        navigateTo,
        helpTopic: null,
      };
    }
    return {
      intent: 'chat',
      reply:
        'I can quote rides, book when you’re signed in, find stores, or explain Movr pricing. Try “How much from Osu to the airport?”',
      origin: null,
      destination: null,
      rideType: null,
      storeQuery: null,
      navigateTo: null,
      helpTopic: null,
    };
  }

  private async estimateRide(
    sessionId: string,
    session: SessionState,
    plan: any,
    gps: { lat: number; lng: number },
    countryCode: string,
    userId?: string
  ): Promise<AiChatResult> {
    const utterance =
      plan.origin && plan.destination
        ? `from ${plan.origin} to ${plan.destination}`
        : plan.destination
          ? `to ${plan.destination}`
          : session.messages.filter((m) => m.role === 'user').slice(-1)[0]?.content || '';

    const intent = await this.voice.extractTripIntent(utterance, userId);
    if (!intent.destination || intent.confidence < 0.4) {
      return {
        sessionId,
        reply: plan.reply || 'Where are you going? Try “from Osu to the airport”.',
        cards: [],
        actions: [
          { label: 'Osu → Airport', action: 'suggest', payload: { text: 'How much from Osu to the airport?' } },
        ],
      };
    }

    const originGeo =
      (intent as any).originLat != null
        ? { lat: (intent as any).originLat, lng: (intent as any).originLng }
        : intent.origin
          ? await this.voice.geocode(intent.origin, gps)
          : gps;
    const destGeo =
      (intent as any).destinationLat != null
        ? { lat: (intent as any).destinationLat, lng: (intent as any).destinationLng }
        : await this.voice.geocode(intent.destination!, gps);

    const estimates = await this.booking.estimateFares(
      originGeo.lat,
      originGeo.lng,
      destGeo.lat,
      destGeo.lng,
      countryCode
    );

    const options = estimates.options || [];
    session.lastEstimate = {
      pickup: { address: intent.origin || 'Current location', ...originGeo },
      destination: { address: intent.destination!, ...destGeo },
      options,
      countryCode,
    };

    const cards: AiChatCard[] = options.slice(0, 4).map((o: any) => ({
      kind: 'fare' as const,
      title: o.name || o.code || 'Ride',
      subtitle: o.etaMinutes != null ? `${o.etaMinutes} min away` : undefined,
      price: o.price,
      badge: 'Fare estimate',
      meta: {
        code: o.code,
        vehicleTypeId: o.vehicleTypeId,
        pickup: session.lastEstimate!.pickup,
        destination: session.lastEstimate!.destination,
      },
    }));

    const lines = cards
      .map((c) => `${c.title} · ${c.price}${c.subtitle ? ` · ${c.subtitle}` : ''}`)
      .join(' · ');

    return {
      sessionId,
      reply:
        plan.reply ||
        (lines
          ? `Here’s a live quote: ${lines}. Sign in and say “book economy” (or tap a option) to confirm.`
          : 'I couldn’t price that route — try a clearer pickup and destination.'),
      cards,
      actions: [
        ...cards.slice(0, 2).map((c) => ({
          label: `Book ${c.title}`,
          action: 'book_ride',
          payload: { rideType: c.meta?.code || 'standard' },
        })),
        { label: 'Sign in to book', href: '/login?next=/ai' },
      ],
      pendingBooking: session.lastEstimate,
    };
  }

  private async bookRide(
    sessionId: string,
    session: SessionState,
    plan: any,
    userId?: string,
    countryCode = 'GH'
  ): Promise<AiChatResult> {
    if (!userId) {
      return {
        sessionId,
        reply: 'Sign in to book a ride with Movr AI — I’ll keep your quote ready.',
        cards: [],
        actions: [{ label: 'Sign in', href: '/login?next=/ai' }],
        needsAuth: true,
        pendingBooking: session.lastEstimate || null,
      };
    }

    const est = session.lastEstimate;
    if (!est) {
      return {
        sessionId,
        reply: 'Tell me the trip first — e.g. “from Osu to the airport” — then I can book it.',
        cards: [],
        actions: [
          { label: 'Get a fare', action: 'suggest', payload: { text: 'How much from Osu to the airport?' } },
        ],
      };
    }

    const preferred =
      (plan.rideType &&
        est.options.find((o: any) =>
          String(o.code || o.name || '')
            .toLowerCase()
            .includes(String(plan.rideType).toLowerCase())
        )) ||
      est.options[0];

    try {
      const result = await this.booking.createRideRequest({
        userId,
        pickupLat: est.pickup.lat,
        pickupLng: est.pickup.lng,
        dropoffLat: est.destination.lat,
        dropoffLng: est.destination.lng,
        pickupAddress: est.pickup.address,
        dropoffAddress: est.destination.address,
        rideType: preferred?.code || plan.rideType || 'standard',
        vehicleTypeCode: preferred?.code,
        sourceChannel: 'app',
        countryCode: est.countryCode || countryCode,
      });

      return {
        sessionId,
        reply: `Booked. Your ${preferred?.name || preferred?.code || 'ride'} is confirmed — track it from your dashboard.`,
        cards: [
          {
            kind: 'info',
            title: 'Ride requested',
            subtitle: est.destination.address,
            badge: preferred?.code || 'ride',
            href: result?.rideId ? `/ride/active/${result.rideId}` : '/dashboard',
            meta: result,
          },
        ],
        actions: [
          { label: 'Open ride', href: result?.rideId ? `/ride/active/${result.rideId}` : '/dashboard' },
          { label: 'Dashboard', href: '/dashboard' },
        ],
      };
    } catch (err: any) {
      this.logger.warn('book_ride failed', { error: err?.message });
      return {
        sessionId,
        reply: err?.message || 'Could not book that ride. Try again from the dashboard.',
        cards: [],
        actions: [{ label: 'Dashboard', href: '/dashboard' }],
      };
    }
  }

  private async recommend(
    sessionId: string,
    plan: any,
    userId?: string,
    gps?: { lat: number; lng: number }
  ): Promise<AiChatResult> {
    const { RecommendService } = require('./recommend.service');
    const data = await new RecommendService(this.db).forUser({
      userId,
      lat: gps?.lat,
      lng: gps?.lng,
      limit: 6,
    });
    return {
      sessionId,
      reply: plan.reply || data.reason || 'Here are personalized picks for you.',
      cards: data.cards || [],
      actions: [
        { label: 'Browse marketplace', href: '/marketplace' },
        { label: 'Book a ride', href: userId ? '/dashboard' : '/login' },
      ],
    };
  }

  private async trackRide(sessionId: string, userId?: string): Promise<AiChatResult> {
    if (!userId) {
      return {
        sessionId,
        reply: 'Sign in to track your active ride.',
        cards: [],
        actions: [{ label: 'Log in', href: '/login' }],
        needsAuth: true,
      };
    }
    const ride = await this.db
      .query(
        `SELECT id, status, pickup_address, dropoff_address, eta_minutes
         FROM rides
         WHERE customer_id = $1 AND status IN ('requested','searching','matched','accepted','arrived','in_progress','ongoing')
         ORDER BY created_at DESC LIMIT 1`,
        [userId]
      )
      .catch(() => ({ rows: [] as any[] }));
    if (!ride.rows[0]) {
      return {
        sessionId,
        reply: 'No active ride right now. Want a fare estimate?',
        cards: [],
        actions: [
          { label: 'Get a fare', action: 'suggest', payload: { text: 'How much from Osu to the airport?' } },
        ],
      };
    }
    const r = ride.rows[0];
    return {
      sessionId,
      reply: `Your ride is ${r.status}${r.eta_minutes != null ? ` · ETA ${r.eta_minutes} min` : ''}.`,
      cards: [
        {
          kind: 'info',
          title: `${r.pickup_address || 'Pickup'} → ${r.dropoff_address || 'Destination'}`,
          subtitle: String(r.status),
          href: `/ride/${r.id}`,
        },
      ],
      actions: [{ label: 'Open ride', href: `/ride/${r.id}` }, { label: 'Safety Centre', href: '/safety' }],
    };
  }

  private async trackOrder(sessionId: string, userId?: string): Promise<AiChatResult> {
    if (!userId) {
      return {
        sessionId,
        reply: 'Sign in to track your latest order.',
        cards: [],
        actions: [{ label: 'Log in', href: '/login' }],
        needsAuth: true,
      };
    }
    const order = await this.db
      .query(
        `SELECT o.id, o.status, o.total, s.name AS store_name
         FROM marketplace_orders o
         LEFT JOIN stores s ON s.id = o.store_id
         WHERE o.user_id = $1
         ORDER BY o.created_at DESC LIMIT 1`,
        [userId]
      )
      .catch(() => ({ rows: [] as any[] }));
    if (!order.rows[0]) {
      return {
        sessionId,
        reply: 'No recent orders found. Browse stores?',
        cards: [],
        actions: [{ label: 'Marketplace', href: '/marketplace' }],
      };
    }
    const o = order.rows[0];
    return {
      sessionId,
      reply: `Latest order from ${o.store_name || 'store'} is ${o.status}.`,
      cards: [
        {
          kind: 'info',
          title: o.store_name || 'Order',
          subtitle: String(o.status),
          price: o.total,
          href: `/orders/${o.id}`,
        },
      ],
      actions: [{ label: 'Track order', href: `/orders/${o.id}` }],
    };
  }

  private async walletBalance(sessionId: string, userId?: string): Promise<AiChatResult> {
    if (!userId) {
      return {
        sessionId,
        reply: 'Sign in to see your wallet balance.',
        cards: [],
        actions: [{ label: 'Log in', href: '/login' }],
        needsAuth: true,
      };
    }
    const w = await this.db
      .query(
        `SELECT COALESCE(balance_fiat, 0)::float AS balance, COALESCE(currency, 'GHS') AS currency
         FROM wallets WHERE user_id = $1 LIMIT 1`,
        [userId]
      )
      .catch(() => ({ rows: [] as any[] }));
    const bal = w.rows[0]?.balance ?? 0;
    const cur = w.rows[0]?.currency || 'GHS';
    return {
      sessionId,
      reply: `Your wallet has ${bal} ${cur}.`,
      cards: [{ kind: 'info', title: 'Wallet', subtitle: `${bal} ${cur}`, href: '/wallet' }],
      actions: [
        { label: 'Top up', href: '/wallet/topup' },
        { label: 'Withdraw', href: '/wallet/withdraw' },
      ],
    };
  }

  private async safetyInfo(sessionId: string, userId?: string): Promise<AiChatResult> {
    let contactNote = 'Add emergency contacts in Safety Centre.';
    if (userId) {
      const c = await this.db
        .query(
          `SELECT COUNT(*)::int AS n FROM emergency_contacts WHERE user_id = $1`,
          [userId]
        )
        .catch(() => ({ rows: [{ n: 0 }] }));
      const n = c.rows[0]?.n || 0;
      contactNote = n
        ? `You have ${n} emergency contact${n === 1 ? '' : 's'} on file.`
        : contactNote;
    }
    return {
      sessionId,
      reply: `Safety tools are in Safety Centre — SOS, trip share, and trusted contacts. ${contactNote}`,
      cards: [],
      actions: [
        { label: 'Open Safety Centre', href: '/safety' },
        { label: 'Share trip', href: '/trust/share-trip' },
      ],
    };
  }

  private disputeHelp(sessionId: string, plan: any): AiChatResult {
    return {
      sessionId,
      reply:
        plan.reply ||
        'For no-show credits, refunds, or disputes, open Trust & Settlement or escalate to a live agent.',
      cards: [],
      actions: [
        { label: 'Settlement hub', href: '/wallet/settlement' },
        { label: 'Talk to a human', action: 'escalate' },
      ],
    };
  }

  private async merchantHours(sessionId: string, plan: any): Promise<AiChatResult> {
    const q = String(plan.storeQuery || plan.reply || '').replace(/hours|open|closing|when does/gi, '').trim();
    const rows = await this.db
      .query(
        `SELECT id, name, hours_json, category FROM stores
         WHERE COALESCE(is_active, TRUE) = TRUE
           AND ($1 = '' OR name ILIKE '%' || $1 || '%')
         ORDER BY rating DESC NULLS LAST LIMIT 5`,
        [q.slice(0, 80)]
      )
      .catch(() => ({ rows: [] as any[] }));
    if (!rows.rows.length) {
      return {
        sessionId,
        reply: 'I couldn’t find that store. Try searching the marketplace.',
        cards: [],
        actions: [{ label: 'Marketplace', href: '/marketplace' }],
      };
    }
    const cards: AiChatCard[] = rows.rows.map((s: any) => ({
      kind: 'store' as const,
      title: s.name,
      subtitle: s.hours_json?.label || s.hours_json?.mon_sun || s.category || 'See store',
      href: `/store/${s.id}`,
    }));
    return {
      sessionId,
      reply: plan.reply || `Hours for ${cards[0].title}: ${cards[0].subtitle}`,
      cards,
      actions: cards.slice(0, 2).map((c) => ({ label: c.title, href: c.href })),
    };
  }

  private async searchStores(
    sessionId: string,
    plan: any,
    userId?: string,
    gps?: { lat: number; lng: number }
  ): Promise<AiChatResult> {
    const q = (plan.storeQuery || '').trim();
    // Empty / browse query while logged in → personalized recommendations
    if (userId && (!q || q === 'all')) {
      return this.recommend(sessionId, plan, userId, gps);
    }
    try {
      const result = await this.marketplace.listStores({
        search: q && q !== 'all' ? q : undefined,
      });
      let rows = (result.rows || []).slice(0, 5);
      if (userId && rows.length) {
        try {
          const { RecommendService } = require('./recommend.service');
          const rec = await new RecommendService(this.db).forUser({ userId, ...gps, limit: 3 });
          const preferred = new Set((rec.stores || []).map((s: any) => s.id));
          rows = [
            ...rows.filter((s: any) => preferred.has(s.id)),
            ...rows.filter((s: any) => !preferred.has(s.id)),
          ].slice(0, 5);
        } catch {
          /* keep search order */
        }
      }
      if (!rows.length) {
        return {
          sessionId,
          reply: plan.reply || 'No stores matched — browse the marketplace or try another search.',
          cards: [],
          actions: [{ label: 'Marketplace', href: '/marketplace' }],
        };
      }
      return {
        sessionId,
        reply: plan.reply || `Here are stores${q && q !== 'all' ? ` for “${q}”` : ''}:`,
        cards: rows.map((s: any) => ({
          kind: 'store' as const,
          title: s.name || s.business_name || 'Store',
          subtitle: s.category || s.city || undefined,
          href: `/store/${s.id}`,
          badge: 'Shop',
        })),
        actions: [
          { label: 'Open marketplace', href: '/marketplace' },
          ...rows.slice(0, 2).map((s: any) => ({
            label: s.name || 'Store',
            href: `/store/${s.id}`,
          })),
        ],
      };
    } catch (err: any) {
      return {
        sessionId,
        reply: 'Marketplace is briefly unavailable — open Shop to browse stores.',
        cards: [],
        actions: [{ label: 'Marketplace', href: '/marketplace' }],
      };
    }
  }

  private explainPricing(sessionId: string, plan: any): AiChatResult {
    return {
      sessionId,
      reply:
        plan.reply ||
        'Rider fares are distance- and demand-based (Economy vs Comfort, etc.). Drivers keep 100% of fares on a flexible subscription — no per-ride commission. Merchants pay for delivery fulfillment, not a ride cut.',
      cards: [
        {
          kind: 'info',
          title: 'Drivers keep 100%',
          subtitle: 'Subscription instead of commission',
          href: '/drivers',
        },
        {
          kind: 'info',
          title: 'Get a live fare',
          subtitle: 'Ask “How much from A to B?”',
        },
      ],
      actions: [
        { label: 'Quote a ride', action: 'suggest', payload: { text: 'How much from Osu to the airport?' } },
        { label: 'For drivers', href: '/drivers' },
        { label: 'For merchants', href: '/merchants' },
      ],
    };
  }

  private async helpLookup(sessionId: string, plan: any): Promise<AiChatResult> {
    try {
      const cats = await this.db.query(
        `SELECT slug, title, description FROM help_categories ORDER BY sort_order NULLS LAST, title LIMIT 6`
      ).catch(() => ({ rows: [] }));
      const cards: AiChatCard[] = (cats.rows || []).map((c: any) => ({
        kind: 'info' as const,
        title: c.title,
        subtitle: c.description || undefined,
        href: `/help/${c.slug}`,
        badge: 'Help',
      }));
      return {
        sessionId,
        reply:
          plan.reply ||
          'Here’s the help centre. You can also keep chatting — I can quote rides or find stores.',
        cards,
        actions: [
          { label: 'Help centre', href: '/help' },
          { label: 'Support chat', href: '/support' },
          { label: 'Talk to Movr AI', href: '/ai' },
        ],
      };
    } catch {
      return {
        sessionId,
        reply: 'Open the help centre for articles, or stay here for booking and rates.',
        cards: [],
        actions: [
          { label: 'Help centre', href: '/help' },
          { label: 'Support', href: '/support' },
        ],
      };
    }
  }

  private navigate(sessionId: string, plan: any): AiChatResult {
    const map: Record<string, { href: string; label: string }> = {
      ride: { href: '/login', label: 'Book a ride' },
      shop: { href: '/marketplace', label: 'Marketplace' },
      deliver: { href: '/login', label: 'Send a parcel' },
      wallet: { href: '/wallet', label: 'Wallet' },
      help: { href: '/help', label: 'Help centre' },
      drivers: { href: '/drivers', label: 'For drivers' },
      merchants: { href: '/merchants', label: 'For merchants' },
      download: { href: '/download', label: 'Get the app' },
      ai: { href: '/ai', label: 'Movr AI' },
      safety: { href: '/safety', label: 'Safety Centre' },
    };
    const target = map[String(plan.navigateTo || 'shop')] || map.shop;
    return {
      sessionId,
      reply: plan.reply || `Opening ${target.label} for you.`,
      cards: [],
      actions: [{ label: target.label, href: target.href }],
    };
  }

  private async rankLeaders(
    sessionId: string,
    plan: any,
    userId?: string,
    gps?: { lat: number; lng: number }
  ): Promise<AiChatResult> {
    const kind = String(plan.rankType || 'stores').toLowerCase();
    const type = kind.startsWith('driver') ? 'driver' : kind.startsWith('rider') ? 'rider' : 'store';
    if (type === 'store' && userId) {
      const personalized = await this.recommend(sessionId, { ...plan, reply: plan.reply }, userId, gps);
      if (personalized.cards?.length) {
        return {
          ...personalized,
          reply: plan.reply || 'Top stores for you, ranked by your history and quality scores:',
        };
      }
    }
    const leaders = await this.ranking.top(type as any, 5);
    if (!leaders.length) {
      return {
        sessionId,
        reply: plan.reply || 'Rankings are warming up — check the marketplace meanwhile.',
        cards: [],
        actions: [{ label: 'Marketplace', href: '/marketplace' }],
      };
    }
    const label = type === 'driver' ? 'drivers' : type === 'rider' ? 'riders' : 'stores';
    return {
      sessionId,
      reply:
        plan.reply ||
        `Top ${label} by ratings, activity, and reliable behaviour on Movr:`,
      cards: leaders.map((l) => ({
        kind: type === 'store' ? ('store' as const) : ('info' as const),
        title: `#${l.rank} ${l.name}`,
        subtitle: `Score ${l.score.toFixed(0)} · ${l.rating ? `${Number(l.rating).toFixed(1)}★` : 'Verified'}`,
        badge: l.badge,
        href: l.href,
        meta: l.meta,
      })),
      actions: [
        ...(type === 'store'
          ? [{ label: 'Open marketplace', href: '/marketplace' }]
          : [{ label: 'For drivers', href: '/drivers' }]),
        { label: 'Book a ride', action: 'suggest', payload: { text: 'How much from Osu to the airport?' } },
      ],
    };
  }

  private async escalate(
    sessionId: string,
    session: SessionState,
    plan: any,
    userId?: string
  ): Promise<AiChatResult> {
    const transcript = session.messages.slice(-12).map((m) => ({
      role: m.role,
      content: m.content,
    }));
    let ticketId: string | null = null;
    try {
      const ticket = await this.db.query(
        `INSERT INTO support_tickets (subject, status, priority, user_id, channel, source, transcript)
         VALUES ($1, 'open', 'high', $2, 'in_app', 'ai_escalate', $3::jsonb)
         RETURNING id`,
        [
          plan.reply || 'AI escalation — live agent requested',
          userId || null,
          JSON.stringify(transcript),
        ]
      );
      ticketId = ticket.rows[0]?.id || null;
      if (ticketId && transcript.length) {
        for (const m of transcript) {
          await this.db.query(
            `INSERT INTO support_ticket_messages (ticket_id, sender, body) VALUES ($1, $2, $3)`,
            [ticketId, m.role === 'user' ? 'user' : 'ai', m.content]
          ).catch(() => undefined);
        }
      }
      if (userId) {
        try {
          const { InboxService } = require('./inbox.service');
          const inbox = new InboxService(this.db);
          await inbox.sendInboxMessage(
            userId,
            'security',
            'Live agent connected',
            'Your conversation was escalated from Movr AI. A specialist will reply shortly.',
            '/support'
          );
        } catch {
          /* optional */
        }
      }
    } catch (err: any) {
      this.logger.warn('escalate ticket failed', { error: err?.message });
    }

    return {
      sessionId,
      reply:
        plan.reply ||
        'Connecting you to a live Movr specialist. They can see this chat and usually reply within a few minutes.',
      cards: [
        {
          kind: 'info',
          title: 'Live agent queue',
          subtitle: ticketId ? `Ticket ${String(ticketId).slice(0, 8)}…` : 'Priority support',
          badge: 'Escalated',
          href: '/support',
        },
      ],
      actions: [
        { label: 'Open support chat', href: '/support' },
        { label: 'Help centre', href: '/help' },
        { label: 'Continue with AI', action: 'suggest', payload: { text: 'Show me top stores' } },
      ],
      escalated: true,
      ticketId,
    };
  }
}
