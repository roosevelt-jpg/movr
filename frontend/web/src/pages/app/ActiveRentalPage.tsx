import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '../../lib/currency';

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

function fmt(ms: number) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(h)}:${p(m)}:${p(s)}`;
}

/** Active Rental (mockup). */
export default function ActiveRentalPage() {
  const [data, setData] = useState<any>(null);
  const [remaining, setRemaining] = useState(0);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API}/rentals/active`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (j?.data) {
          setData(j.data);
          if (j.data.remainingMs != null) setRemaining(Number(j.data.remainingMs));
        }
      })
      .catch(() => setError('Could not load active rental'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const t = setInterval(() => setRemaining((ms) => Math.max(0, ms - 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  const d = data;

  const extend = async () => {
    if (!d?.id) return;
    const res = await fetch(`${API}/rentals/${d.id}/extend`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ days: 1 }),
    }).catch(() => null);
    const j = res ? await res.json() : null;
    setMsg(j?.data?.message || 'Extended');
  };

  return (
    <div className="min-h-[70vh] bg-black text-white max-w-xl mx-auto p-4 pb-28" data-force-dark>
      {loading ? <p className="text-zinc-400">Loading rental…</p> : null}
      {error ? <p className="text-red-400">{error}</p> : null}
      {!d ? null : (
      <>
      <div className="flex items-center justify-between mb-5">
        <Link to="/rentals" className="w-9 h-9 rounded-full bg-zinc-900 flex items-center justify-center font-bold">
          ←
        </Link>
        <h1 className="text-lg font-extrabold">Active Rental</h1>
        <span className="rounded-full bg-green-950 text-green-400 text-xs font-extrabold px-2.5 py-1">
          ● Active
        </span>
      </div>

      <div className="rounded-2xl bg-violet-950/80 p-4 mb-3">
        <div className="flex gap-3 mb-4">
          <div className="w-16 h-16 rounded-xl bg-violet-900 flex items-center justify-center text-3xl">
            {d.vehicle?.emoji || '🚙'}
          </div>
          <div>
            <p className="text-xl font-extrabold">{d.vehicle?.name}</p>
            <p className="text-zinc-400 text-sm">{d.vehicle?.meta}</p>
            <p className="text-amber-400 font-bold text-sm mt-1">
              ★ {Number(d.vehicle?.rating || 0).toFixed(1)} {d.vehicle?.mode}
            </p>
          </div>
        </div>
        <p className="text-[11px] tracking-wider text-zinc-500 font-bold">TIME REMAINING</p>
        <p className="text-4xl font-extrabold mt-1">{fmt(remaining)}</p>
        <p className="text-zinc-400 text-sm mt-1 mb-3">{d.returnBy}</p>
        <div className="h-1.5 rounded bg-zinc-700 overflow-hidden">
          <div className="h-1.5 bg-purple-500" style={{ width: `${d.elapsedPct || 0}%` }} />
        </div>
        <div className="flex justify-between text-xs text-zinc-500 mt-2">
          <span>{d.startedLabel}</span>
          <span>{d.elapsedPct || 0}% elapsed</span>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-2xl bg-zinc-900 p-3.5 mb-3">
        <span>📍</span>
        <div className="flex-1">
          <p className="font-extrabold">Return Location</p>
          <p className="text-sm text-zinc-400">{d.returnLocation?.address}</p>
        </div>
        <a
          className="text-purple-400 font-extrabold"
          href={`https://maps.google.com/?q=${encodeURIComponent(d.returnLocation?.address || '')}`}
          target="_blank"
          rel="noreferrer"
        >
          Navigate
        </a>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { label: 'Support', icon: '📞', to: '/support' },
          { label: 'Map View', icon: '🗺', to: `https://maps.google.com/?q=${encodeURIComponent(d.returnLocation?.address || '')}` },
          { label: 'Receipt', icon: '📋', to: '/rentals' },
        ].map((a) =>
          a.to.startsWith('http') ? (
            <a key={a.label} href={a.to} className="rounded-xl bg-zinc-900 py-4 text-center">
              <div className="text-xl mb-1">{a.icon}</div>
              <div className="text-xs font-bold">{a.label}</div>
            </a>
          ) : (
            <Link key={a.label} to={a.to} className="rounded-xl bg-zinc-900 py-4 text-center">
              <div className="text-xl mb-1">{a.icon}</div>
              <div className="text-xs font-bold">{a.label}</div>
            </Link>
          )
        )}
      </div>

      <div className="rounded-xl border border-orange-500/60 bg-orange-950/40 p-3 mb-4 flex gap-2">
        <span>⛽</span>
        <div>
          <p className="font-extrabold">Fuel reminder</p>
          <p className="text-sm text-orange-200/80">{d.fuelReminder}</p>
        </div>
      </div>

      {msg ? <p className="text-center text-purple-300 text-sm mb-3">{msg}</p> : null}

      <button
        type="button"
        onClick={extend}
        className="sticky bottom-4 w-full rounded-2xl py-4 font-extrabold border border-red-500 bg-red-950 text-red-300"
      >
        Extend Rental · {formatCurrency(Number(d.extendDailyRate || 0), d.currency || 'NGN')}/day
      </button>
      </>
      )}
    </div>
  );
}
