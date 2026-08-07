import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MessageCircle, X, Send, Sparkles, Headphones, Minimize2 } from 'lucide-react';
import { useAuthStore } from '../store/auth.store';
import { useLocalCurrency } from '../hooks/useLocalCurrency';

const API =
  (import.meta as any).env?.VITE_API_URL ||
  process.env.REACT_APP_API_URL ||
  '/api/v1';

type Bubble = { id: string; from: 'user' | 'bot' | 'agent'; text: string };

/**
 * Floating homepage / site-wide live chat.
 * Uses Movr AI first; escalates to live agents when the request is beyond AI.
 */
export default function LiveChatWidget() {
  const location = useLocation();
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const { country } = useLocalCurrency();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [sessionId, setSessionId] = useState<string>();
  const [escalated, setEscalated] = useState(false);
  const [messages, setMessages] = useState<Bubble[]>([
    {
      id: '0',
      from: 'bot',
      text: 'Hi! I’m Movr AI. Ask about rides, rates, or stores — or say “talk to a human” for a live agent.',
    },
  ]);
  const seq = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);

  // Hide on full AI page (dedicated UI) and auth-heavy app shells that already have support
  const hide =
    location.pathname.startsWith('/ai') ||
    location.pathname.startsWith('/bot') ||
    location.pathname.startsWith('/support') ||
    location.pathname.startsWith('/merchant/dashboard') ||
    location.pathname.startsWith('/admin');

  useEffect(() => {
    if (open && !minimized) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open, minimized, busy]);

  if (hide) return null;

  const push = (m: Omit<Bubble, 'id'>) => {
    setMessages((prev) => [...prev, { ...m, id: String(seq.current++) }]);
  };

  const escalate = async () => {
    setBusy(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      await fetch(`${API}/ai/escalate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          channel: 'live_widget',
          subject: 'Homepage live chat escalation',
          transcript: messages.map((m) => ({
            role: m.from === 'user' ? 'user' : 'assistant',
            content: m.text,
          })),
        }),
      });
      setEscalated(true);
      push({
        from: 'agent',
        text: 'A live Movr specialist has been notified. You can also continue in Support.',
      });
    } catch {
      push({ from: 'bot', text: 'Could not reach agents — open Support from the menu.' });
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    push({ from: 'user', text });

    if (/\b(human|agent|real person|specialist)\b/i.test(text)) {
      await escalate();
      return;
    }

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
      const data = json.data || {};
      if (data.sessionId) setSessionId(data.sessionId);
      if (data.escalated) setEscalated(true);
      push({
        from: data.escalated ? 'agent' : 'bot',
        text: data.reply || 'Done.',
      });
    } catch {
      push({
        from: 'bot',
        text: 'I hit a snag. Try again, or ask for a live agent.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-3 pointer-events-none">
      {open && !minimized ? (
        <div className="pointer-events-auto w-[min(100vw-1.5rem,22rem)] h-[min(70vh,28rem)] rounded-2xl border border-border bg-surface shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-3.5 py-3 bg-movr-gradient text-white">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles size={18} />
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">Movr AI</p>
                <p className="text-[11px] text-white/85">
                  {escalated ? 'Live agent queue' : 'Always on · can escalate'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="p-1.5 rounded-lg hover:bg-white/15"
                aria-label="Minimize"
                onClick={() => setMinimized(true)}
              >
                <Minimize2 size={16} />
              </button>
              <button
                type="button"
                className="p-1.5 rounded-lg hover:bg-white/15"
                aria-label="Close chat"
                onClick={() => setOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-surface">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <p
                  className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    m.from === 'user'
                      ? 'bg-movr-gradient text-white rounded-br-md'
                      : m.from === 'agent'
                        ? 'bg-success/15 border border-success/25 text-text-primary rounded-bl-md'
                        : 'bg-surface-elevated border border-border text-text-primary rounded-bl-md'
                  }`}
                >
                  {m.from === 'agent' ? (
                    <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-success mb-1">
                      <Headphones size={10} /> Agent
                    </span>
                  ) : null}
                  {m.text}
                </p>
              </div>
            ))}
            {busy ? <p className="text-xs text-text-secondary animate-pulse px-1">Typing…</p> : null}
            <div ref={endRef} />
          </div>

          <div className="border-t border-border p-2.5 flex gap-1.5 bg-surface">
            <button
              type="button"
              onClick={() => escalate()}
              className="shrink-0 h-10 w-10 rounded-full border border-border flex items-center justify-center text-text-secondary hover:text-text-primary"
              title="Live agent"
              aria-label="Talk to live agent"
            >
              <Headphones size={16} />
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Message Movr AI…"
              className="input-base flex-1 rounded-full !min-h-10 py-2 text-sm"
              disabled={busy}
            />
            <button
              type="button"
              onClick={send}
              disabled={busy || !input.trim()}
              className="shrink-0 h-10 w-10 rounded-full bg-movr-gradient text-white flex items-center justify-center disabled:opacity-50"
              aria-label="Send"
            >
              <Send size={16} />
            </button>
          </div>
          <button
            type="button"
            className="text-[11px] text-center text-motion-blue py-1.5 border-t border-border bg-surface"
            onClick={() => navigate('/ai')}
          >
            Open full Movr AI →
          </button>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => {
          if (minimized) {
            setMinimized(false);
            setOpen(true);
            return;
          }
          setOpen((v) => !v);
        }}
        className="pointer-events-auto h-14 w-14 rounded-full bg-movr-gradient text-white shadow-lg shadow-motion-blue/30 flex items-center justify-center hover:scale-105 transition-transform"
        aria-label={open ? 'Close live chat' : 'Open live chat'}
      >
        {open && !minimized ? <X size={22} /> : <MessageCircle size={24} />}
      </button>
    </div>
  );
}
