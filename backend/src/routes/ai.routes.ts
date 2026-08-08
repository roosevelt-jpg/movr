import { Router, Response } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest, authenticateToken, requireAdmin } from '../middleware/auth.middleware';
import { DatabaseService } from '../services/database.service';
import { MovrAiService } from '../services/movr-ai.service';
import { RankingService } from '../services/ranking.service';
import { RecommendService } from '../services/recommend.service';
import { resolveOpenAiApiKey, resolveOpenAiModel } from '../utils/openai-credentials';
import axios from 'axios';

const db = new DatabaseService();
const ai = new MovrAiService(db);
const ranking = new RankingService(db);
const recommend = new RecommendService(db);

export const aiRouter = Router();
export const aiAdminRouter = Router();

function optionalAuth(req: AuthRequest, _res: Response, next: () => void) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return next();
    jwt.verify(token, process.env.JWT_SECRET || 'secret', (err: any, user: any) => {
      if (!err && user) req.user = user;
      next();
    });
  } catch {
    next();
  }
}

function channelLinks() {
  const waNumber = (process.env.TWILIO_WHATSAPP_NUMBER || process.env.WHATSAPP_BUSINESS_NUMBER || '')
    .replace(/[^\d+]/g, '')
    .replace(/^\+/, '');
  const tgUser = process.env.TELEGRAM_BOT_USERNAME || process.env.VITE_TELEGRAM_BOT || 'MovrAIBot';
  const waText = encodeURIComponent('Hi Movr AI — I need a ride');
  return {
    inApp: { id: 'in_app', label: 'In-app AI', href: '/ai', description: 'Book rides, shop, and get rates here' },
    whatsapp: {
      id: 'whatsapp',
      label: 'WhatsApp',
      href: waNumber ? `https://wa.me/${waNumber}?text=${waText}` : `https://wa.me/?text=${waText}`,
      description: waNumber ? 'Chat on WhatsApp' : 'Open WhatsApp to message Movr',
      configured: Boolean(waNumber),
    },
    telegram: {
      id: 'telegram',
      label: 'Telegram',
      href: `https://t.me/${tgUser.replace(/^@/, '')}`,
      description: 'Book via Telegram bot',
      configured: Boolean(process.env.TELEGRAM_BOT_TOKEN || tgUser),
    },
  };
}

async function triageTranscript(transcript: any[], subject: string) {
  const fallback = {
    category: 'general',
    priority: 'medium',
    suggestedReply:
      'Thanks for reaching out — a Movr specialist is reviewing your request and will reply shortly.',
  };
  try {
    const apiKey = await resolveOpenAiApiKey(db);
    if (!apiKey) return fallback;
    const model = await resolveOpenAiModel(db);
    const text = transcript
      .slice(-12)
      .map((m) => `${m?.role || m?.from || 'user'}: ${m?.content || m?.text || ''}`)
      .join('\n')
      .slice(0, 4000);
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Classify a Movr support escalation. Return JSON: {category: payments|rides|safety|marketplace|account|general, priority: low|medium|high|urgent, suggestedReply: short helpful agent reply under 2 sentences}',
          },
          { role: 'user', content: `Subject: ${subject}\n\n${text || 'No transcript'}` },
        ],
        temperature: 0.2,
        max_tokens: 200,
      },
      { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 10000 }
    );
    const parsed = JSON.parse(response.data.choices[0].message.content);
    return {
      category: String(parsed.category || fallback.category).slice(0, 64),
      priority: String(parsed.priority || fallback.priority).slice(0, 24),
      suggestedReply: String(parsed.suggestedReply || fallback.suggestedReply).slice(0, 1000),
    };
  } catch {
    return fallback;
  }
}

/** GET /api/v1/ai/channels */
aiRouter.get('/channels', (_req, res: Response) => {
  res.json({ status: 'success', data: channelLinks() });
});

/** GET /api/v1/ai/recommendations */
aiRouter.get('/recommendations', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const data = await recommend.forUser({
      userId: req.user?.id,
      lat: req.query.lat != null ? Number(req.query.lat) : undefined,
      lng: req.query.lng != null ? Number(req.query.lng) : undefined,
      limit: req.query.limit != null ? Number(req.query.limit) : 6,
    });
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

/** GET /api/v1/ai/features/:key — public feature-flag check (optional auth for rollout bucketing) */
aiRouter.get('/features/:key', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const key = String(req.params.key || '').slice(0, 64);
    if (!key) return res.status(400).json({ status: 'error', message: 'key required' });
    const { FeatureFlagsService } = require('../services/feature-flags.service');
    const flags = new FeatureFlagsService(db);
    const row = await db.query(`SELECT key, enabled, rollout_pct FROM feature_flags WHERE key = $1`, [
      key,
    ]);
    if (!row.rows[0]) {
      return res.json({ status: 'success', data: { key, enabled: true, configured: false } });
    }
    const enabled = await flags.isEnabled(key, req.user?.id);
    res.json({
      status: 'success',
      data: {
        key,
        enabled,
        configured: true,
        rollout_pct: Number(row.rows[0].rollout_pct || 0),
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

/** GET /api/v1/ai/rankings?type=stores|drivers|riders */
aiRouter.get('/rankings', async (req, res: Response) => {
  try {
    const typeRaw = String(req.query.type || 'stores').toLowerCase();
    const type = typeRaw.startsWith('driver')
      ? 'driver'
      : typeRaw.startsWith('rider')
        ? 'rider'
        : 'store';
    const limit = Math.min(20, Number(req.query.limit || 10));
    const data = await ranking.top(type as any, limit);
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

/** POST /api/v1/ai/rankings/refresh — admin only */
aiRouter.post(
  '/rankings/refresh',
  authenticateToken,
  requireAdmin,
  async (_req, res: Response) => {
    try {
      const data = await ranking.refreshAll();
      res.json({ status: 'success', data });
    } catch (error: any) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }
);

/** POST /api/v1/ai/chat */
aiRouter.post('/chat', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const message = String(req.body?.message || '').trim();
    if (!message) {
      return res.status(400).json({ status: 'error', message: 'message is required' });
    }
    const data = await ai.chat({
      message,
      sessionId: req.body?.sessionId,
      userId: req.user?.id,
      countryCode: req.body?.countryCode,
      lat: req.body?.lat != null ? Number(req.body.lat) : undefined,
      lng: req.body?.lng != null ? Number(req.body.lng) : undefined,
    });
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message || 'Movr AI failed' });
  }
});

/** POST /api/v1/ai/escalate */
aiRouter.post('/escalate', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const transcript = Array.isArray(req.body?.transcript) ? req.body.transcript : [];
    const subject = String(req.body?.subject || 'Live agent requested').slice(0, 240);
    const guestEmail = req.body?.email ? String(req.body.email).slice(0, 255) : null;
    const guestName = req.body?.name ? String(req.body.name).slice(0, 120) : null;
    const channel = String(req.body?.channel || 'in_app').slice(0, 32);
    const triage = await triageTranscript(transcript, subject);

    const ticket = await db.query(
      `INSERT INTO support_tickets
         (subject, status, priority, user_id, channel, source, transcript, guest_email, guest_name,
          triage_category, triage_priority, suggested_reply, triage_json)
       VALUES ($1, 'open', $2, $3, $4, 'ai_escalate', $5::jsonb, $6, $7, $8, $9, $10, $11::jsonb)
       RETURNING id, created_at`,
      [
        subject,
        triage.priority === 'urgent' ? 'urgent' : triage.priority === 'high' ? 'high' : 'medium',
        req.user?.id || null,
        channel,
        JSON.stringify(transcript),
        guestEmail,
        guestName,
        triage.category,
        triage.priority,
        triage.suggestedReply,
        JSON.stringify(triage),
      ]
    ).catch(async () =>
      db.query(
        `INSERT INTO support_tickets
           (subject, status, priority, user_id, channel, source, transcript, guest_email, guest_name)
         VALUES ($1, 'open', 'high', $2, $3, 'ai_escalate', $4::jsonb, $5, $6)
         RETURNING id, created_at`,
        [subject, req.user?.id || null, channel, JSON.stringify(transcript), guestEmail, guestName]
      )
    );
    const ticketId = ticket.rows[0]?.id;
    for (const m of transcript.slice(-20)) {
      const body = String(m?.content || m?.text || '').trim();
      if (!body) continue;
      await db
        .query(`INSERT INTO support_ticket_messages (ticket_id, sender, body) VALUES ($1, $2, $3)`, [
          ticketId,
          m?.role === 'assistant' || m?.from === 'bot' ? 'ai' : 'user',
          body,
        ])
        .catch(() => undefined);
    }

    res.status(201).json({
      status: 'success',
      data: {
        ticketId,
        triage,
        reply: 'A live Movr specialist has been notified. Typical reply time is under 2 minutes.',
        channels: channelLinks(),
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message || 'Escalation failed' });
  }
});

/** Admin AI support inbox */
aiAdminRouter.use(authenticateToken, requireAdmin);

aiAdminRouter.get('/tickets', async (req: AuthRequest, res: Response) => {
  try {
    const status = String(req.query.status || '').toLowerCase();
    const params: any[] = [];
    let filter = `WHERE COALESCE(source, 'ai_escalate') IN ('ai_escalate', 'ai', 'chat')`;
    if (status && status !== 'all') {
      params.push(status);
      filter += ` AND LOWER(status) = $${params.length}`;
    }
    const rows = await db.query(
      `SELECT t.*,
              COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'') AS customer_name,
              u.email AS customer_email, u.phone AS customer_phone
       FROM support_tickets t
       LEFT JOIN users u ON u.id = t.user_id
       ${filter}
       ORDER BY t.created_at DESC
       LIMIT 100`,
      params
    );
    res.json({ status: 'success', data: rows.rows });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

aiAdminRouter.get('/tickets/:id', async (req: AuthRequest, res: Response) => {
  try {
    const ticket = await db.query(`SELECT * FROM support_tickets WHERE id = $1`, [req.params.id]);
    if (!ticket.rows[0]) return res.status(404).json({ status: 'error', message: 'Not found' });
    const messages = await db
      .query(
        `SELECT * FROM support_ticket_messages WHERE ticket_id = $1 ORDER BY created_at ASC`,
        [req.params.id]
      )
      .catch(() => ({ rows: [] as any[] }));
    res.json({
      status: 'success',
      data: { ...ticket.rows[0], messages: messages.rows },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

aiAdminRouter.patch('/tickets/:id', async (req: AuthRequest, res: Response) => {
  try {
    const status = req.body.status ? String(req.body.status) : null;
    const opsNote = req.body.opsNote != null ? String(req.body.opsNote) : null;
    const reply = req.body.reply ? String(req.body.reply).trim() : '';
    if (reply) {
      await db.query(
        `INSERT INTO support_ticket_messages (ticket_id, sender, body) VALUES ($1, 'agent', $2)`,
        [req.params.id, reply]
      );
    }
    const row = await db.query(
      `UPDATE support_tickets SET
         status = COALESCE($1, status),
         ops_note = COALESCE($2, ops_note),
         resolved_at = CASE WHEN $1 IN ('resolved','closed') THEN NOW() ELSE resolved_at END
       WHERE id = $3
       RETURNING *`,
      [status, opsNote, req.params.id]
    );
    if (!row.rows[0]) return res.status(404).json({ status: 'error', message: 'Not found' });
    res.json({ status: 'success', data: row.rows[0] });
  } catch (error: any) {
    res.status(400).json({ status: 'error', message: error.message });
  }
});

aiAdminRouter.post('/rankings/refresh', async (_req, res: Response) => {
  try {
    const data = await ranking.refreshAll();
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});
