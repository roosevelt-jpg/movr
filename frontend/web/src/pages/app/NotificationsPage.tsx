import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const API =
  (import.meta as any).env?.VITE_API_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3000/api/v1';

function authHeaders() {
  const t = localStorage.getItem('movr_token') || localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  };
}

const TABS = ['all', 'rides', 'orders', 'rewards'] as const;
const ICONS: Record<string, { bg: string; glyph: string }> = {
  order: { bg: 'bg-green-900', glyph: '🍔' },
  orders: { bg: 'bg-green-900', glyph: '🍔' },
  ride: { bg: 'bg-zinc-800', glyph: '🚗' },
  rides: { bg: 'bg-zinc-800', glyph: '🚗' },
  promo: { bg: 'bg-zinc-800', glyph: '🏷' },
  rating: { bg: 'bg-zinc-800', glyph: '⭐' },
  rewards: { bg: 'bg-amber-900', glyph: '★' },
  points: { bg: 'bg-amber-900', glyph: '★' },
};

function rel(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  if (d < 3600000) return `${Math.max(1, Math.round(d / 60000))} min ago`;
  if (d < 86400000) return `${Math.round(d / 3600000)} hours ago`;
  if (d < 172800000) return 'Yesterday';
  return `${Math.round(d / 86400000)} days ago`;
}

/** Notifications inbox (mockup). */
export default function NotificationsPage() {
  const [category, setCategory] = useState('all');
  const [items, setItems] = useState<any[]>([]);

  const load = () => {
    const q = category !== 'all' ? `?category=${category}` : '';
    fetch(`${API}/notifications${q}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => setItems(j.data || []))
      .catch(() => undefined);
  };

  useEffect(() => {
    load();
  }, [category]);

  const markAll = async () => {
    await fetch(`${API}/notifications/mark-all-read`, {
      method: 'PATCH',
      headers: authHeaders(),
    }).catch(() => undefined);
    load();
  };

  return (
    <div className="min-h-[70vh] bg-black text-white max-w-xl mx-auto p-4" data-force-dark>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-extrabold">Notifications</h1>
        <button type="button" onClick={markAll} className="text-purple-400 font-bold">
          Mark all read
        </button>
      </div>

      <div className="flex gap-2 mb-4 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setCategory(t)}
            className={`rounded-full px-4 py-2 text-sm font-semibold capitalize ${
              category === t ? 'bg-purple-500' : 'border border-zinc-700 text-zinc-400'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <ul className="space-y-2">
        {items.map((n) => {
          const icon = ICONS[n.icon] || ICONS[n.category] || { bg: 'bg-zinc-800', glyph: '•' };
          return (
            <li
              key={n.id}
              className={`relative flex gap-3 rounded-xl p-3 ${
                n.unread ? 'bg-purple-500/10' : ''
              }`}
            >
              {n.unread ? <span className="absolute left-0 top-2 bottom-2 w-1 rounded bg-purple-500" /> : null}
              <div className={`w-10 h-10 rounded-xl ${icon.bg} flex items-center justify-center`}>
                {icon.glyph}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold">{n.title}</p>
                <p className="text-sm text-zinc-400 mt-1">{n.body}</p>
                <p className="text-xs text-zinc-500 mt-2">{n.createdAt ? rel(n.createdAt) : ''}</p>
              </div>
              {(n.category === 'rewards' || n.category === 'points') && (
                <Link to="/rewards" className="text-purple-400 text-sm font-bold self-center">
                  View
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
