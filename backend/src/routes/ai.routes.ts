import { Router, Response } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest } from '../middleware/auth.middleware';
import { DatabaseService } from '../services/database.service';
import { MovrAiService } from '../services/movr-ai.service';
import { RankingService } from '../services/ranking.service';

const db = new DatabaseService();
const ai = new MovrAiService(db);
const ranking = new RankingService(db);

export const aiRouter = Router();

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

/** GET /api/v1/ai/channels — WhatsApp, Telegram, in-app booking entry points */
aiRouter.get('/channels', (_req, res: Response) => {
  res.json({ status: 'success', data: channelLinks() });
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

/** POST /api/v1/ai/rankings/refresh — recompute quality scores (ops/admin use) */
aiRouter.post('/rankings/refresh', async (_req, res: Response) => {
  try {
    const data = await ranking.refreshAll();
    res.json({ status: 'success', data });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

/** POST /api/v1/ai/chat — multi-domain Movr AI assistant */
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

/** POST /api/v1/ai/escalate — force live-agent handoff with transcript */
aiRouter.post('/escalate', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const transcript = Array.isArray(req.body?.transcript) ? req.body.transcript : [];
    const subject = String(req.body?.subject || 'Live agent requested').slice(0, 240);
    const guestEmail = req.body?.email ? String(req.body.email).slice(0, 255) : null;
    const guestName = req.body?.name ? String(req.body.name).slice(0, 120) : null;
    const channel = String(req.body?.channel || 'in_app').slice(0, 32);

    const ticket = await db.query(
      `INSERT INTO support_tickets
         (subject, status, priority, user_id, channel, source, transcript, guest_email, guest_name)
       VALUES ($1, 'open', 'high', $2, $3, 'ai_escalate', $4::jsonb, $5, $6)
       RETURNING id, created_at`,
      [
        subject,
        req.user?.id || null,
        channel,
        JSON.stringify(transcript),
        guestEmail,
        guestName,
      ]
    );
    const ticketId = ticket.rows[0]?.id;
    for (const m of transcript.slice(-20)) {
      const body = String(m?.content || m?.text || '').trim();
      if (!body) continue;
      await db.query(
        `INSERT INTO support_ticket_messages (ticket_id, sender, body) VALUES ($1, $2, $3)`,
        [ticketId, m?.role === 'assistant' || m?.from === 'bot' ? 'ai' : 'user', body]
      ).catch(() => undefined);
    }

    res.status(201).json({
      status: 'success',
      data: {
        ticketId,
        reply: 'A live Movr specialist has been notified. Typical reply time is under 2 minutes.',
        channels: channelLinks(),
      },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message || 'Escalation failed' });
  }
});
