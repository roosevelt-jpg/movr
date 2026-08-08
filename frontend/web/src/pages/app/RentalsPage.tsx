import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatCurrency } from '../../lib/currency';

const API =
  (import.meta as any).env?.VITE_API_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3000/api/v1';

function authHeaders() {
  const t = localStorage.getItem('movr_token') || localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function fmtShort(n: number, currency: string) {
  if (n >= 1000) return `${currency === 'NGN' ? '₦' : ''}${Math.round(n / 1000)}K`;
  return formatCurrency(n, currency);
}

/** Rentals catalog (mockup). */
export default function RentalsPage() {
  const [mode, setMode] = useState<'self_drive' | 'chauffeur'>('self_drive');
  const [cars, setCars] = useState<any[]>([]);
  const [selected, setSelected] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${API}/rentals/vehicles?mode=${mode}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        setCars(j.data || []);
        const pop = (j.data || []).find((c: any) => c.popular);
        setSelected(pop?.id || j.data?.[0]?.id || '');
      })
      .catch(() => undefined);
  }, [mode]);

  return (
    <div className="min-h-[70vh] bg-black text-white max-w-xl mx-auto p-4" data-force-dark>
      <h1 className="text-3xl font-extrabold">Rentals</h1>
      <p className="text-zinc-400 mt-1 mb-4">Self-drive & chauffeur options</p>

      <div className="flex rounded-2xl bg-zinc-900 p-1 mb-4">
        {(['self_drive', 'chauffeur'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 rounded-xl py-2.5 font-bold ${
              mode === m ? 'bg-gradient-to-r from-blue-500 to-purple-500' : ''
            }`}
          >
            {m === 'self_drive' ? 'Self-Drive' : 'Chauffeur'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 mb-5">
        {[
          ['PICKUP DATE', 'Apr 10, 9:00 AM'],
          ['RETURN DATE', 'Apr 11, 9:00 AM'],
        ].map(([l, v]) => (
          <div key={l} className="rounded-xl bg-zinc-900 p-3">
            <p className="text-[11px] tracking-wider text-zinc-500 font-bold">{l}</p>
            <p className="font-bold mt-1">{v}</p>
          </div>
        ))}
      </div>

      <p className="text-xs tracking-wider text-zinc-500 font-bold mb-3">AVAILABLE CARS</p>
      <div className="space-y-3 mb-6">
        {cars.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setSelected(c.id)}
            className={`w-full text-left flex gap-3 rounded-2xl bg-zinc-900 p-3 border ${
              c.popular || selected === c.id ? 'border-purple-500' : 'border-transparent'
            } relative overflow-hidden`}
          >
            {c.popular ? (
              <span className="absolute left-0 top-0 text-[10px] font-extrabold px-2 py-0.5 rounded-br-lg bg-gradient-to-r from-blue-500 to-purple-500">
                POPULAR
              </span>
            ) : null}
            <div className="w-14 h-14 rounded-xl bg-zinc-800 flex items-center justify-center text-2xl mt-2">
              {c.emoji || '🚗'}
            </div>
            <div className="flex-1">
              <p className="font-bold">{c.name}</p>
              <p className="text-xs text-zinc-400 mt-1">{c.meta}</p>
              <p className="text-xs text-amber-400 mt-1">
                ★ {Number(c.rating || 4.8).toFixed(1)}{' '}
                <span className="ml-2 rounded-full bg-green-900 text-green-300 px-2 py-0.5 font-bold">
                  Available
                </span>
              </p>
            </div>
            <div className="text-right">
              <p className="font-extrabold text-lg">{fmtShort(Number(c.dailyRate || 0), c.currency || 'NGN')}</p>
              <p className="text-xs text-zinc-500">/day</p>
            </div>
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={!selected}
        onClick={() =>
          navigate(`/rentals/confirm?vehicleId=${selected}&mode=${mode}`)
        }
        className="w-full rounded-2xl py-4 font-extrabold bg-gradient-to-r from-blue-500 to-purple-500 disabled:opacity-50 mb-3"
      >
        Continue to confirm
      </button>
      <Link
        to="/rentals/active"
        className="block text-center text-purple-400 font-bold text-sm"
      >
        View active rental →
      </Link>
    </div>
  );
}
