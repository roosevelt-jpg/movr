import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

const API =
  (import.meta as any).env?.VITE_API_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3000/api/v1';
const TABS = ['all', 'rides', 'food', 'tokens'] as const;
const ICONS: Record<string, string> = {
  cart: '🛒',
  dvt: '⛓',
  car: '🚗',
  ride: '🚗',
};

function authHeaders() {
  const t = localStorage.getItem('movr_token') || localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

/** Deals & Promos (mockup). */
export default function DealsPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('all');
  const [deals, setDeals] = useState<any[]>([]);

  useEffect(() => {
    const q = tab === 'all' ? '' : `?category=${tab}`;
    fetch(`${API}/me/deals${q}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => setDeals(j.data || []))
      .catch(() => undefined);
  }, [tab]);

  return (
    <div className="min-h-[70vh] bg-black text-white max-w-xl mx-auto p-4" data-force-dark>
      <div className="flex items-center gap-3 mb-2">
        <Link to="/profile" className="text-xl">
          ←
        </Link>
        <p className="text-sm text-zinc-400">Exclusive deals for Movr users</p>
      </div>

      <div className="flex gap-2 overflow-x-auto my-4">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-2 text-sm font-bold capitalize ${
              tab === t ? 'bg-purple-500' : 'bg-zinc-900'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="h-px bg-zinc-800 mb-4" />

      <div className="space-y-3">
        {deals.map((d) => {
          if (d.featured) {
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => toast.success(`${d.code} ready`)}
                className="w-full text-left rounded-2xl p-5 bg-gradient-to-br from-indigo-500 to-purple-600"
              >
                <p className="text-[11px] tracking-wider font-bold text-indigo-100">
                  LIMITED TIME
                </p>
                <p className="text-4xl font-black mt-2">{d.title}</p>
                <p className="mt-1">{d.description}</p>
                <div className="mt-4 inline-block rounded-lg border-2 border-dashed border-white/80 px-3 py-1.5 font-extrabold tracking-wide">
                  {d.code}
                </div>
                <p className="text-right text-xs text-indigo-100 mt-2">
                  {d.expiresLabel || 'Expires soon'}
                </p>
              </button>
            );
          }
          const used = d.status === 'used';
          return (
            <div
              key={d.id}
              className={`flex gap-3 rounded-2xl p-3 ${
                used ? 'bg-zinc-800 opacity-80' : 'bg-zinc-900'
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  used ? 'bg-zinc-700' : 'bg-green-950'
                }`}
              >
                {ICONS[d.icon] || '🏷'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-extrabold">{d.title}</p>
                <p className="text-xs text-zinc-500 mt-1">{d.description}</p>
                {d.code && d.status === 'available' ? (
                  <button
                    type="button"
                    onClick={() => toast.success(d.code)}
                    className="mt-2 text-xs font-extrabold text-purple-400 border border-dashed border-purple-500 rounded-lg px-2 py-0.5"
                  >
                    {d.code}
                  </button>
                ) : null}
                {d.status === 'active' || d.autoApplied ? (
                  <p className="text-xs text-purple-400 mt-2 font-semibold">
                    Auto-applied · This weekend
                  </p>
                ) : null}
                {d.expiresLabel && d.status === 'available' ? (
                  <p className="text-[11px] text-zinc-500 mt-1">{d.expiresLabel}</p>
                ) : null}
              </div>
              {d.status === 'active' ? (
                <span className="self-start rounded-full bg-purple-700 px-2.5 py-1 text-xs font-bold">
                  Active
                </span>
              ) : null}
              {used ? (
                <span className="self-start rounded-full bg-zinc-700 px-2.5 py-1 text-xs font-bold text-zinc-400">
                  Used
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
