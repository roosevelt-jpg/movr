import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCmsPage } from '../../services/cms';
import { CmsSections } from '../../cms/sections';

const API = import.meta.env.VITE_API_URL || '/api/v1';

function authHeaders() {
  const t = localStorage.getItem('movr_token') || localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  };
}

const TOPIC_ICON: Record<string, string> = {
  car: '🚗',
  ride: '🚗',
  card: '💳',
  pay: '💳',
  package: '📦',
  order: '📦',
  chain: '⛓',
  dvt: '⛓',
};

/** Help Center — CMS page + live topics/tickets APIs. */
export default function HelpCentrePage() {
  const navigate = useNavigate();
  const { page, loading: cmsLoading } = useCmsPage('help');
  const [q, setQ] = useState('');
  const [topics, setTopics] = useState<{ slug: string; title: string; icon_key: string }[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const url = q.trim()
      ? `${API}/public/help/categories?q=${encodeURIComponent(q.trim())}`
      : `${API}/public/help/categories`;
    fetch(url)
      .then((r) => r.json())
      .then((body) => {
        if (Array.isArray(body?.data)) {
          setTopics(
            body.data.map((c: any) => ({
              slug: c.slug,
              title: c.title,
              icon_key: c.icon_key || c.slug,
            }))
          );
        } else {
          setTopics([]);
        }
      })
      .catch(() => setTopics([]));
  }, [q]);

  useEffect(() => {
    fetch(`${API}/me/support/tickets`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (Array.isArray(j?.data?.tickets)) setTickets(j.data.tickets);
        else setTickets([]);
      })
      .catch(() => setTickets([]))
      .finally(() => setTicketsLoading(false));
  }, []);

  const raise = async () => {
    try {
      const res = await fetch(`${API}/me/support/tickets`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ subject: 'New support request' }),
      });
      const j = await res.json();
      setMsg(j?.data?.ticketRef ? `Ticket ${j.data.ticketRef} created` : 'Ticket created');
    } catch {
      setMsg('Could not create ticket');
    }
  };

  if (cmsLoading) {
    return (
      <div className="flex-1 bg-black text-white flex items-center justify-center py-24">Loading…</div>
    );
  }

  if (page?.sections?.length) {
    return (
      <div className="bg-surface text-text-primary">
        <CmsSections sections={page.sections} pageSlug="help" />
      </div>
    );
  }

  const grid = topics.slice(0, 8);

  return (
    <div className="min-h-[70vh] bg-black text-white max-w-xl mx-auto p-4" data-force-dark>
      <h1 className="text-3xl font-extrabold mt-4">Help Center</h1>
      <p className="text-zinc-400 mt-2 mb-5">How can we help you today?</p>

      <div className="flex items-center gap-2 rounded-xl bg-zinc-900 px-4 mb-6">
        <span>🔍</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search help articles..."
          className="flex-1 bg-transparent py-3.5 outline-none"
        />
      </div>

      <p className="text-xs font-bold tracking-wider text-zinc-500 mb-2">POPULAR TOPICS</p>
      {grid.length === 0 ? (
        <p className="text-sm text-zinc-500 mb-6">No help topics available.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 mb-6">
          {grid.map((t) => (
            <button
              key={t.slug}
              type="button"
              onClick={() => navigate(`/help/${t.slug}`)}
              className="rounded-xl bg-zinc-900 p-4 text-left min-h-[88px]"
            >
              <div className="text-2xl mb-2">{TOPIC_ICON[t.icon_key] || '•'}</div>
              <div className="font-bold">{t.title}</div>
            </button>
          ))}
        </div>
      )}

      <p className="text-xs font-bold tracking-wider text-zinc-500 mb-2">YOUR TICKETS</p>
      {ticketsLoading ? <p className="text-sm text-zinc-500 mb-6">Loading tickets…</p> : null}
      {!ticketsLoading && tickets.length === 0 ? <p className="text-sm text-zinc-500 mb-6">No support tickets.</p> : null}
      {tickets.map((t) => (
        <div key={t.id || t.ticketRef} className="flex items-center gap-3 rounded-xl bg-zinc-900 p-3.5 mb-6">
          <div className="flex-1">
            <p className="font-bold">{t.subject}</p>
            <p className="text-xs text-zinc-500 mt-1">
              Ticket #{t.ticketRef} · {t.openedLabel}
            </p>
          </div>
          <span className="text-xs font-bold text-orange-400 border border-orange-500/50 bg-orange-950/40 rounded-full px-2.5 py-1">
            {t.status}
          </span>
        </div>
      ))}

      <p className="text-xs font-bold tracking-wider text-zinc-500 mb-2">CONTACT US</p>
      <div className="space-y-2">
        <Link to="/support" className="flex items-center gap-3 rounded-xl bg-zinc-900 p-3.5">
          <span className="text-xl">💬</span>
          <span className="flex-1">
            <span className="block font-bold">Live Chat</span>
            <span className="text-xs text-zinc-500">Usually replies in 5 min</span>
          </span>
          <span className="w-2 h-2 rounded-full bg-green-500" />
        </Link>
        <a href="mailto:support@mymovr.io" className="flex items-center gap-3 rounded-xl bg-zinc-900 p-3.5">
          <span className="text-xl">✉️</span>
          <span className="flex-1">
            <span className="block font-bold">Email Support</span>
            <span className="text-xs text-zinc-500">support@mymovr.io</span>
          </span>
        </a>
        <button type="button" onClick={raise} className="w-full flex items-center gap-3 rounded-xl bg-zinc-900 p-3.5 text-left">
          <span className="text-xl">✏️</span>
          <span className="flex-1">
            <span className="block font-bold">Raise a Ticket</span>
            <span className="text-xs text-zinc-500">For complex issues</span>
          </span>
        </button>
      </div>
      {msg ? <p className="text-center text-purple-300 text-sm mt-4">{msg}</p> : null}
    </div>
  );
}
