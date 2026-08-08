import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
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

/** Confirm Rental (mockup). */
export default function RentalConfirmPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const vehicleId = params.get('vehicleId') || '';
  const mode = (params.get('mode') as 'self_drive' | 'chauffeur') || 'self_drive';
  const [quote, setQuote] = useState<any>(null);
  const [hubs, setHubs] = useState<any[]>([]);
  const [hubId, setHubId] = useState<string | null>(null);
  const [showHubs, setShowHubs] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!vehicleId) {
      setError('Vehicle not found');
      setLoading(false);
      return;
    }
    fetch(
      `${API}/rentals/confirm-quote?vehicleId=${vehicleId}&mode=${mode}&days=1`,
      { headers: authHeaders() }
    )
      .then((r) => r.json())
      .then((j) => {
        if (j?.data) {
          setQuote(j.data);
          if (j.data.location?.hubId) setHubId(j.data.location.hubId);
        }
      })
      .catch(() => setError('Could not load rental quote'))
      .finally(() => setLoading(false));
    fetch(`${API}/rentals/hubs`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => setHubs(j.data || []))
      .catch(() => undefined);
  }, [vehicleId, mode]);

  const pay = async () => {
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch(`${API}/rentals/confirm`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          rentalVehicleId: vehicleId,
          rentalType: mode,
          days: 1,
          hubId,
          pickupAddress: quote?.location?.address,
          pickupAt: quote?.period?.pickupAt,
          returnAt: quote?.period?.returnAt,
        }),
      });
      const j = await res.json();
      setMsg(j?.data?.message || (res.ok ? 'Rental confirmed & paid' : j.message));
      if (res.ok) setTimeout(() => navigate('/rentals'), 800);
    } catch {
      setMsg('Could not confirm rental');
    } finally {
      setBusy(false);
    }
  };

  const v = quote?.vehicle;
  const p = quote?.period;
  const pricing = quote?.pricing;
  const currency = pricing?.currency || 'NGN';
  const total = Number(pricing?.total || 0);

  return (
    <div className="min-h-[70vh] bg-black text-white max-w-xl mx-auto p-4 pb-28" data-force-dark>
      <div className="flex items-center justify-between mb-5">
        <Link to="/rentals" className="w-9 h-9 rounded-full bg-zinc-900 flex items-center justify-center font-bold">
          ←
        </Link>
        <h1 className="text-lg font-extrabold">Confirm Rental</h1>
        <span className="w-9" />
      </div>
      {loading ? <p className="text-zinc-400">Loading rental quote…</p> : null}
      {error ? <p className="text-red-400">{error}</p> : null}
      {!quote ? null : (
      <>

      <div className="flex gap-3 rounded-2xl bg-zinc-900 p-3.5 mb-3">
        <div className="w-16 h-16 rounded-xl bg-zinc-800 flex items-center justify-center text-3xl">
          {v.emoji || '🚙'}
        </div>
        <div>
          <p className="font-extrabold text-lg">{v.name}</p>
          <p className="text-sm text-zinc-400 mt-0.5">{v.meta}</p>
          <p className="text-sm text-amber-400 font-bold mt-1">
            ★ {Number(v.rating || 0).toFixed(1)} · {v.mode || ''}
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-zinc-900 p-3.5 mb-3">
        <p className="text-[11px] tracking-wider text-zinc-500 font-bold mb-3">RENTAL PERIOD</p>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <p className="text-[11px] text-zinc-500 font-bold">PICKUP</p>
            <p className="font-extrabold mt-1">{p.pickupDate}</p>
            <p className="text-purple-400 font-bold text-sm">{p.pickupTime}</p>
          </div>
          <span className="text-zinc-500 font-bold">→</span>
          <div className="flex-1 text-right">
            <p className="text-[11px] text-zinc-500 font-bold">RETURN</p>
            <p className="font-extrabold mt-1">{p.returnDate}</p>
            <p className="text-purple-400 font-bold text-sm">{p.returnTime}</p>
          </div>
        </div>
        <div className="mt-4 flex justify-center">
          <span className="rounded-full bg-violet-950 text-violet-300 text-xs font-bold px-3 py-1.5">
            {p.label || ''}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-2xl bg-zinc-900 p-3.5 mb-3">
        <span className="text-xl">📍</span>
        <div className="flex-1">
          <p className="font-extrabold">Pickup Location</p>
          <p className="text-sm text-zinc-400 mt-0.5">
            {quote?.location?.address || ''}
          </p>
        </div>
        <button type="button" className="text-purple-400 font-extrabold" onClick={() => setShowHubs((s) => !s)}>
          Change
        </button>
      </div>

      {showHubs ? (
        <div className="space-y-2 mb-3">
          {hubs.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => {
                setHubId(h.id);
                setQuote((q: any) => ({
                  ...q,
                  location: { ...q?.location, hubId: h.id, address: h.address },
                }));
                setShowHubs(false);
              }}
              className={`w-full text-left rounded-xl p-3 border ${
                hubId === h.id ? 'border-purple-500 bg-zinc-900' : 'border-zinc-800 bg-zinc-950'
              }`}
            >
              {h.address || h.name}
            </button>
          ))}
        </div>
      ) : null}

      <div className="rounded-2xl bg-zinc-900 p-3.5 mb-4 space-y-2.5">
        {(pricing?.lines || []).map((line: any) => (
          <div key={line.label} className="flex justify-between">
            <span className="text-zinc-400">{line.label}</span>
            <span className={`font-bold ${Number(line.amount) < 0 ? 'text-green-400' : ''}`}>
              {Number(line.amount) < 0 ? '−' : ''}
              {formatCurrency(Math.abs(Number(line.amount)), currency)}
            </span>
          </div>
        ))}
        <div className="border-t border-zinc-800 pt-3 flex justify-between">
          <span className="font-extrabold">Total</span>
          <span className="font-extrabold text-lg">{formatCurrency(total, currency)}</span>
        </div>
      </div>

      {msg ? <p className="text-center text-purple-300 text-sm mb-3">{msg}</p> : null}

      <button
        type="button"
        disabled={busy}
        onClick={pay}
        className="sticky bottom-4 w-full rounded-2xl py-4 font-extrabold bg-indigo-500 disabled:opacity-60"
      >
        {busy ? 'Processing…' : `Confirm & Pay ${formatCurrency(total, currency)}`}
      </button>
      </>
      )}
    </div>
  );
}
