import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const API =
  (import.meta as any).env?.VITE_API_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3000/api/v1';
const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'ride', label: 'Ride', icon: '🚗' },
  { id: 'shop', label: 'Shop', icon: '🛍' },
  { id: 'deliver', label: 'Deliver', icon: '📦' },
];

function authHeaders() {
  const t = localStorage.getItem('movr_token') || localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

/** Search Explore (mockup). */
export default function ExplorePage() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [merchants, setMerchants] = useState<any[]>([]);

  useEffect(() => {
    const params = new URLSearchParams({ filter });
    if (q) params.set('q', q);
    fetch(`${API}/me/explore?${params}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => setMerchants(j?.data?.merchants || []))
      .catch(() => undefined);
  }, [q, filter]);

  const showGrid = filter === 'all' || filter === 'shop';

  return (
    <div className="min-h-[70vh] bg-black text-white max-w-xl mx-auto p-4 pb-28" data-force-dark>
      <div className="flex items-center gap-2 rounded-2xl border-2 border-purple-500 bg-zinc-950 px-3 mb-4">
        <span>🔍</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search rides, stores, parcels..."
          className="flex-1 bg-transparent py-3 outline-none text-sm"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto mb-5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-full px-4 py-2 text-sm font-bold whitespace-nowrap ${
              filter === f.id ? 'bg-purple-500' : 'bg-zinc-900'
            }`}
          >
            {f.icon ? `${f.icon} ` : ''}
            {f.label}
          </button>
        ))}
      </div>

      {showGrid ? (
        <div className="grid grid-cols-2 gap-2.5">
          {merchants.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => navigate(`/store/${m.storeId || m.id}`)}
              className="rounded-2xl bg-zinc-900 p-3 text-left"
            >
              <p className="text-2xl mb-2">{m.emoji}</p>
              <p className="font-extrabold text-sm">{m.name}</p>
              <p className="text-xs text-zinc-500 mt-1">{m.meta}</p>
              <p className="text-sm mt-2">★ {Number(m.rating || 4.5).toFixed(1)}</p>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-zinc-500 text-center mt-10">Use the actions below to continue</p>
      )}

      <div className="fixed bottom-4 left-0 right-0 max-w-xl mx-auto px-4 flex gap-2">
        <Link
          to="/"
          className="flex-1 rounded-xl bg-purple-200 py-3 text-center text-purple-900 font-extrabold text-xs"
        >
          🚗 Book Ride
        </Link>
        <Link
          to="/marketplace"
          className="flex-1 rounded-xl bg-blue-200 py-3 text-center text-amber-900 font-extrabold text-xs"
        >
          📦 Send Parcel
        </Link>
        <Link
          to="/rentals"
          className="flex-1 rounded-xl bg-green-200 py-3 text-center text-green-900 font-extrabold text-xs"
        >
          🚙 Rent Car
        </Link>
      </div>
    </div>
  );
}
