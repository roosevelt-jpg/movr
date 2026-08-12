import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API =
  (import.meta as any).env?.VITE_API_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3000/api/v1';
const TABS = ['all', 'rides', 'parcels', 'orders'] as const;

function authHeaders() {
  const t = localStorage.getItem('movr_token') || localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function relWhen(iso: string, meta?: any) {
  if (meta?.duration) {
    const d = new Date(iso);
    return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${meta.duration}`;
  }
  const d = new Date(iso);
  const now = new Date();
  const dayDiff = Math.round(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() -
      new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) /
      86400000
  );
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (dayDiff === 0) return `Today · ${time}`;
  if (dayDiff === 1) return `Yesterday · ${time}`;
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${time}`;
}

const ICONS: Record<string, { bg: string; glyph: string }> = {
  ride: { bg: 'bg-purple-950', glyph: '🚗' },
  parcel: { bg: 'bg-green-950', glyph: '📦' },
  rental: { bg: 'bg-orange-950', glyph: '🚙' },
  order: { bg: 'bg-blue-950', glyph: '🍔' },
};

/** My Trips — empty state + history list (mockup). */
const HistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<(typeof TABS)[number]>('all');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const q = tab === 'all' ? '' : `?type=${tab}`;
    fetch(`${API}/activity/history${q}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => setItems(j.data || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [tab]);

  const empty = !loading && items.length === 0;

  return (
    <div className="min-h-[70vh] bg-black text-white max-w-xl mx-auto p-4" data-force-dark>
      <div className="flex items-center justify-between mb-4">
        <button type="button" onClick={() => navigate(-1)} className="text-xl font-bold">
          ←
        </button>
        <h1 className="text-xl font-extrabold">My Trips</h1>
        <span className="w-6" />
      </div>

      <div className="flex gap-2 overflow-x-auto mb-5 pb-1">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-2 text-sm font-semibold capitalize whitespace-nowrap ${
              tab === t ? 'bg-purple-500 text-white' : 'bg-zinc-900 text-zinc-400'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {empty ? (
        <div className="flex flex-col items-center px-4 pt-10 text-center">
          <div className="relative w-28 h-28 rounded-full bg-zinc-900 flex items-center justify-center text-5xl mb-4">
            🚗
            <span className="absolute bottom-5 right-5 w-7 h-7 rounded-full bg-zinc-800 text-sm flex items-center justify-center">
              🔍
            </span>
          </div>
          <h2 className="text-2xl font-extrabold">No trips yet</h2>
          <p className="text-zinc-400 mt-2 mb-6 text-sm leading-relaxed">
            Your rides, parcels, orders and rentals will all appear here.
          </p>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="w-full rounded-xl py-3.5 font-extrabold bg-indigo-500 mb-2"
          >
            Book Your First Ride
          </button>
          <button
            type="button"
            onClick={() => navigate('/marketplace')}
            className="w-full rounded-xl py-3.5 font-bold border border-zinc-700 bg-zinc-900 mb-8"
          >
            Browse Stores
          </button>
          <p className="self-start text-xs font-bold tracking-wider text-zinc-500 mb-2">TRY THESE</p>
          <div className="grid grid-cols-3 gap-2 w-full">
            {[
              { label: 'Ride', icon: '🚗', to: '/dashboard' },
              { label: 'shop', icon: '🛍', to: '/marketplace' },
              { label: 'Deliver', icon: '📦', to: '/dashboard' },
            ].map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => navigate(t.to)}
                className="rounded-xl bg-zinc-900 py-4"
              >
                <div className="text-2xl mb-1">{t.icon}</div>
                <div className="font-bold text-sm">{t.label}</div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <ul className="space-y-5">
          {items.map((item) => {
            const icon = ICONS[item.type] || ICONS.ride;
            return (
              <li key={item.id}>
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className={`w-10 h-10 rounded-xl ${icon.bg} flex items-center justify-center text-lg`}
                  >
                    {icon.glyph}
                  </div>
                  <p className="flex-1 text-sm text-zinc-400">
                    {relWhen(item.occurredAt, item.metadata)}
                  </p>
                  {Number(item.pointsEarned || 0) > 0 ? (
                    <p className="text-green-400 font-extrabold">
                      +{Number(item.pointsEarned)} pts
                    </p>
                  ) : null}
                </div>

                {(item.pickup || item.dropoff) && (
                  <div className="ml-12 rounded-xl bg-zinc-950 p-3 space-y-1">
                    {item.pickup ? (
                      <p className="text-sm flex gap-2">
                        <span className="text-purple-400">●</span> {item.pickup}
                      </p>
                    ) : null}
                    {item.dropoff ? (
                      <p className="text-sm flex gap-2">
                        <span className="text-blue-400">●</span> {item.dropoff}
                      </p>
                    ) : null}
                  </div>
                )}

                {item.type === 'ride' && (
                  <div className="ml-12 flex gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/ride/${item.id}/receipt`)}
                      className="rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-semibold"
                    >
                      📄 Receipt
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/dashboard')}
                      className="rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-semibold"
                    >
                      ↻ Rebook
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/ride/${item.id}/rate`)}
                      className="rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-semibold"
                    >
                      ⭐ Rate
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default HistoryPage;
