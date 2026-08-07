import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Sparkles,
  Send,
  ShieldCheck,
  MessageCircle,
  Smartphone,
  Send as TelegramIcon,
  Headphones,
  Star,
  Trophy,
} from 'lucide-react';
import { useLocalCurrency } from '../../hooks/useLocalCurrency';
import { useAuthStore } from '../../store/auth.store';
import { useCmsPage } from '../../services/cms';
import { resolveCmsHeroMedia } from '../../brand/assets';

const API =
  (import.meta as any).env?.VITE_API_URL ||
  process.env.REACT_APP_API_URL ||
  '/api/v1';

type Card = {
  kind?: string;
  title: string;
  subtitle?: string;
  price?: string | number;
  badge?: string;
  href?: string;
  meta?: any;
};

type Action = {
  label: string;
  href?: string;
  action?: string;
  payload?: Record<string, any>;
};

type Msg = {
  id: string;
  from: 'user' | 'bot' | 'agent';
  text: string;
  cards?: Card[];
  actions?: Action[];
};

type Channel = {
  id: string;
  label: string;
  href: string;
  description?: string;
};

/** Advanced Movr AI — in-app bookings + WhatsApp / Telegram channels + rankings + live escalate. */
export default function MovrAiPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { formatMoney, country } = useLocalCurrency();
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [channel, setChannel] = useState<'in_app' | 'whatsapp' | 'telegram'>('in_app');
  const [channels, setChannels] = useState<Record<string, Channel>>({});
  const [leaders, setLeaders] = useState<any[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [escalated, setEscalated] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: '0',
      from: 'bot',
      text: 'Hi — I’m Movr AI. Book rides in-app, on WhatsApp, or Telegram. I also surface top merchants and drivers by ratings, activity, and reliability.',
      actions: [
        { label: 'Fare quote', action: 'suggest', payload: { text: 'How much from Osu to the airport?' } },
        { label: 'Top stores', action: 'suggest', payload: { text: 'Show me the top rated stores' } },
        { label: 'Talk to a human', action: 'escalate' },
      ],
    },
  ]);
  const seq = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ch = params.get('channel');
    if (ch === 'whatsapp' || ch === 'telegram' || ch === 'in_app') setChannel(ch);
  }, [params]);

  useEffect(() => {
    fetch(`${API}/ai/channels`)
      .then((r) => r.json())
      .then((j) => setChannels(j?.data || {}))
      .catch(() => undefined);
    fetch(`${API}/ai/rankings?type=stores&limit=5`)
      .then((r) => r.json())
      .then((j) => setLeaders(Array.isArray(j?.data) ? j.data : []))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  const push = (m: Omit<Msg, 'id'>) => {
    setMessages((prev) => [...prev, { ...m, id: String(seq.current++) }]);
  };

  const money = (n: string | number | undefined) => {
    if (n == null || n === '') return '';
    const num = typeof n === 'number' ? n : Number(String(n).replace(/[^\d.]/g, ''));
    if (!Number.isFinite(num)) return String(n);
    try {
      return formatMoney(num);
    } catch {
      return String(n);
    }
  };

  const escalate = async () => {
    setBusy(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const transcript = messages.map((m) => ({
        role: m.from === 'user' ? 'user' : 'assistant',
        content: m.text,
      }));
      const res = await fetch(`${API}/ai/escalate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ transcript, channel, subject: 'Live agent from Movr AI' }),
      });
      const json = await res.json();
      setEscalated(true);
      push({
        from: 'agent',
        text: json?.data?.reply || 'A live specialist is joining this conversation.',
        actions: [{ label: 'Open support', href: '/support' }],
      });
    } catch {
      push({
        from: 'bot',
        text: 'Could not reach the agent queue — try Support chat.',
        actions: [{ label: 'Support', href: '/support' }],
      });
    } finally {
      setBusy(false);
    }
  };

  const sendText = async (raw: string) => {
    const text = raw.trim();
    if (!text || busy) return;

    if (channel === 'whatsapp' || channel === 'telegram') {
      const link = channels[channel]?.href;
      if (link) {
        push({ from: 'user', text });
        push({
          from: 'bot',
          text: `Opening ${channels[channel]?.label || channel} with your message…`,
          actions: [{ label: `Continue on ${channels[channel]?.label}`, href: link }],
        });
        window.open(
          channel === 'whatsapp'
            ? link.includes('text=')
              ? link
              : `${link}${link.includes('?') ? '&' : '?'}text=${encodeURIComponent(text)}`
            : link,
          '_blank',
          'noreferrer'
        );
      }
      return;
    }

    setInput('');
    push({ from: 'user', text });
    setBusy(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${API}/ai/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ message: text, sessionId, countryCode: country }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Movr AI unavailable');
      const data = json.data || {};
      if (data.sessionId) setSessionId(data.sessionId);
      if (data.escalated) setEscalated(true);
      push({
        from: data.escalated ? 'agent' : 'bot',
        text: data.reply || 'Done.',
        cards: data.cards || [],
        actions: data.actions || [],
      });
    } catch (e: any) {
      push({
        from: 'bot',
        text: e?.message || 'Something went wrong. Try again or talk to a human.',
        actions: [
          { label: 'Talk to a human', action: 'escalate' },
          { label: 'Help centre', href: '/help' },
        ],
      });
    } finally {
      setBusy(false);
    }
  };

  const onAction = async (a: Action) => {
    if (a.action === 'escalate') {
      await escalate();
      return;
    }
    if (a.href) {
      if (a.href.startsWith('http')) {
        window.open(a.href, '_blank', 'noreferrer');
        return;
      }
      navigate(a.href);
      return;
    }
    if (a.action === 'suggest' && a.payload?.text) {
      await sendText(String(a.payload.text));
      return;
    }
    if (a.action === 'book_ride') {
      const tier = a.payload?.rideType || 'economy';
      if (!isAuthenticated) {
        navigate('/login', { state: { from: '/ai' } });
        return;
      }
      await sendText(`book ${tier}`);
    }
  };

  const channelTabs: Array<{ id: 'in_app' | 'whatsapp' | 'telegram'; label: string; icon: React.ReactNode }> = [
    { id: 'in_app', label: 'In-app', icon: <Smartphone size={16} /> },
    { id: 'whatsapp', label: 'WhatsApp', icon: <MessageCircle size={16} /> },
    { id: 'telegram', label: 'Telegram', icon: <TelegramIcon size={16} /> },
  ];

  const { page: aiCms } = useCmsPage('ai');
  const bannerSection = aiCms?.sections?.find((s) => s.type === 'hero' || s.type === 'choice_hero');
  const bannerMedia = resolveCmsHeroMedia(bannerSection?.payload || {}, 'ai');
  const bannerUrl = bannerMedia.imageUrl || '/brand/ride-sedan.png';

  return (
    <div className="bg-surface text-text-primary flex-1 flex flex-col">
      <div className="relative overflow-hidden border-b border-border">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-35"
          style={{ backgroundImage: `url(${bannerUrl})` }}
          aria-hidden
        />
        <div className="absolute inset-0 bg-gradient-to-r from-surface via-surface/90 to-surface/70" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 h-[2px] bg-gradient-to-r from-[#6A00FF] via-[#0055FF] to-[#3F7048]" aria-hidden />
        <div className="mkt-shell relative w-full max-w-5xl mx-auto py-8 sm:py-10 px-4 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-movr-gradient text-white">
              <Sparkles size={22} />
            </span>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">
                {bannerSection?.payload?.headline || 'Movr AI'}
              </h1>
              <p className="text-sm text-success flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                {escalated ? 'Live agent connected' : 'Online · multi-channel bookings'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {channelTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setChannel(t.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium border transition-colors ${
                  channel === t.id
                    ? 'border-motion-blue bg-motion-blue/10 text-motion-blue'
                    : 'border-border text-text-secondary hover:text-text-primary'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mkt-shell w-full max-w-5xl mx-auto flex-1 flex flex-col py-6 sm:py-8 px-4 gap-6">
        <div className="grid lg:grid-cols-[1fr_280px] gap-5 items-start">
          <div className="rounded-2xl border border-border bg-surface-elevated overflow-hidden flex flex-col min-h-[32rem]">
            {channel !== 'in_app' ? (
              <div className="px-4 py-3 border-b border-border bg-surface text-sm text-text-secondary">
                Messages open in {channels[channel]?.label || channel}. Bookings use the same Movr AI brain on that
                channel.
                {channels[channel]?.href ? (
                  <button
                    type="button"
                    className="ml-2 text-motion-blue font-medium"
                    onClick={() => window.open(channels[channel].href, '_blank', 'noreferrer')}
                  >
                    Open {channels[channel].label} →
                  </button>
                ) : null}
              </div>
            ) : null}

            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col gap-2 ${m.from === 'user' ? 'items-end' : 'items-start'}`}
                >
                  {m.from === 'agent' ? (
                    <p className="text-[11px] uppercase tracking-wide text-success flex items-center gap-1">
                      <Headphones size={12} /> Live agent
                    </p>
                  ) : null}
                  <p
                    className={
                      m.from === 'user'
                        ? 'mkt-ai-bubble-user max-w-[90%]'
                        : m.from === 'agent'
                          ? 'rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm leading-relaxed bg-success/10 border border-success/30 text-text-primary max-w-[92%]'
                          : 'rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm leading-relaxed bg-surface border border-border text-text-primary max-w-[92%]'
                    }
                  >
                    {m.text}
                  </p>
                  {m.cards?.length ? (
                    <div className="w-full max-w-md space-y-2">
                      {m.cards.map((c, i) => (
                        <button
                          key={`${c.title}-${i}`}
                          type="button"
                          onClick={() => c.href && (c.href.startsWith('http') ? window.open(c.href) : navigate(c.href))}
                          className="w-full text-left rounded-xl border border-border bg-surface p-3 hover:border-motion-blue/40 transition-colors"
                        >
                          <div className="flex justify-between gap-3">
                            <div>
                              {c.badge ? (
                                <p className="text-[11px] uppercase tracking-wide text-motion-blue mb-0.5">
                                  {c.badge}
                                </p>
                              ) : null}
                              <p className="font-semibold text-sm">{c.title}</p>
                              {c.subtitle ? (
                                <p className="text-xs text-text-secondary mt-0.5">{c.subtitle}</p>
                              ) : null}
                            </div>
                            {c.price != null ? (
                              <p className="font-bold text-sm shrink-0">{money(c.price)}</p>
                            ) : null}
                          </div>
                          {c.kind === 'fare' ? (
                            <p className="mt-2 text-xs text-success flex items-center gap-1">
                              <ShieldCheck size={12} /> Live estimate
                            </p>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {m.actions?.length ? (
                    <div className="flex flex-wrap gap-2 max-w-md">
                      {m.actions.map((a) => (
                        <button
                          key={a.label}
                          type="button"
                          onClick={() => onAction(a)}
                          className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-text-primary hover:border-motion-blue/50 hover:text-motion-blue transition-colors"
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
              {busy ? (
                <p className="text-sm text-text-secondary animate-pulse">Movr AI is thinking…</p>
              ) : null}
              <div ref={endRef} />
            </div>

            <form
              className="border-t border-border p-3 sm:p-4 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                sendText(input);
              }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  channel === 'in_app'
                    ? 'Ask about a ride, top stores, or say “talk to a human”…'
                    : `Type a message for ${channels[channel]?.label || channel}…`
                }
                className="input-base flex-1 rounded-full"
                disabled={busy}
                aria-label="Message Movr AI"
              />
              <button
                type="button"
                onClick={() => escalate()}
                disabled={busy}
                className="shrink-0 h-12 px-3 rounded-full border border-border text-text-secondary hover:text-text-primary hidden sm:inline-flex items-center gap-1.5 text-xs font-medium"
                title="Talk to a live agent"
              >
                <Headphones size={16} />
                Agent
              </button>
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="shrink-0 h-12 w-12 rounded-full bg-movr-gradient text-white flex items-center justify-center disabled:opacity-50"
                aria-label="Send"
              >
                <Send size={18} />
              </button>
            </form>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-border bg-surface-elevated p-4">
              <p className="text-[11px] uppercase tracking-wide text-text-secondary flex items-center gap-1.5 mb-3">
                <Trophy size={14} className="text-motion-blue" />
                Top merchants
              </p>
              {leaders.length ? (
                <ul className="space-y-2.5">
                  {leaders.map((l) => (
                    <li key={l.id}>
                      <button
                        type="button"
                        onClick={() => l.href && navigate(l.href)}
                        className="w-full text-left flex items-start gap-2 group"
                      >
                        <span className="text-xs font-bold text-motion-blue w-5">#{l.rank}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold group-hover:text-motion-blue truncate">
                            {l.name}
                          </span>
                          <span className="text-xs text-text-secondary flex items-center gap-1">
                            <Star size={11} className="text-warning" />
                            {Number(l.rating || 0).toFixed(1)} · {l.badge || 'Verified'}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-text-secondary">Loading rankings…</p>
              )}
              <button
                type="button"
                className="mt-4 text-sm font-medium text-motion-blue"
                onClick={() => sendText('Show me the top rated stores')}
              >
                Ask AI for rankings →
              </button>
            </div>

            <div className="rounded-2xl border border-border bg-surface-elevated p-4 space-y-2">
              <p className="text-sm font-semibold">Book anywhere</p>
              <p className="text-xs text-text-secondary leading-relaxed">
                Same AI across in-app chat, WhatsApp, and Telegram — rates, bookings, and store discovery.
              </p>
              <Link to="/marketplace" className="block text-sm text-motion-blue font-medium pt-1">
                Browse marketplace →
              </Link>
              <Link to="/support" className="block text-sm text-motion-blue font-medium">
                Classic support →
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
