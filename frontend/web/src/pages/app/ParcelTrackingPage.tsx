import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

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

/** Parcel tracking (mockup). */
export default function ParcelTrackingPage() {
  const { ref = 'MVR-P-8821' } = useParams();
  const [data, setData] = useState<any>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch(`${API}/deliveries/track/${encodeURIComponent(ref)}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => setData(j.data))
      .catch(() => undefined);
  }, [ref]);

  const d = data || {
    label: 'Parcel #MVR-P-8821',
    statusLabel: 'En Route',
    scheduledLabel: 'Scheduled · 2 min ago',
    etaLabel: 'Courier is 12 min away',
    courier: { name: 'Tunde Adeyemi', title: 'Movr Courier', rating: 4.7 },
    pickup: '24 Admiralty Way, Lekki',
    dropoff: 'Marina Square, Lagos Island',
    timeline: [
      { id: '1', label: 'Parcel picked up', state: 'done' },
      { id: '2', label: 'In transit · 12 min away', state: 'active' },
      { id: '3', label: 'Delivered & signed', state: 'pending' },
    ],
    shareUrl: 'https://movr.app/track/MVR-P-8821',
  };

  const share = async () => {
    const res = await fetch(`${API}/deliveries/${d.id || 'demo'}/share-link`, {
      method: 'POST',
      headers: authHeaders(),
      body: '{}',
    }).catch(() => null);
    const j = res ? await res.json() : null;
    const url = j?.data?.shareUrl || d.shareUrl;
    try {
      await navigator.clipboard.writeText(url);
      setMsg('Tracking link copied');
    } catch {
      setMsg(url);
    }
  };

  return (
    <div className="min-h-[70vh] bg-black text-white max-w-xl mx-auto p-4 pb-24" data-force-dark>
      <div className="relative h-40 rounded-2xl bg-zinc-950 mb-4 flex flex-col items-center justify-center overflow-hidden">
        <p className="absolute top-3 rounded-lg bg-black px-3 py-1 text-xs font-bold">{d.etaLabel}</p>
        <p className="text-3xl mb-6">🛵</p>
        <div className="absolute bottom-4 left-5 right-5 flex items-center gap-2">
          <span>📦</span>
          <div className="flex-1 h-1 rounded bg-zinc-700">
            <div className="h-1 rounded bg-purple-500 w-2/3" />
          </div>
          <span>📍</span>
        </div>
      </div>

      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-xl font-extrabold">{d.label}</h1>
          <p className="text-zinc-400 text-sm mt-1">{d.scheduledLabel}</p>
        </div>
        <span className="rounded-full bg-purple-900 text-purple-200 text-xs font-extrabold px-3 py-1.5">
          {d.statusLabel}
        </span>
      </div>

      <div className="rounded-2xl bg-zinc-900 p-3.5 mb-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-11 h-11 rounded-full bg-zinc-800 flex items-center justify-center">🛵</div>
          <div className="flex-1">
            <p className="font-extrabold">{d.courier?.name}</p>
            <p className="text-xs text-zinc-400">
              {d.courier?.title} · ★ {Number(d.courier?.rating || 4.7).toFixed(1)}
            </p>
          </div>
          <button type="button" className="w-10 h-10 rounded-xl bg-zinc-800">📞</button>
          <button type="button" className="w-10 h-10 rounded-xl bg-zinc-800">💬</button>
        </div>
        <p className="text-sm flex gap-2 mb-1">
          <span className="text-purple-400">●</span> {d.pickup}
        </p>
        <p className="text-sm flex gap-2">
          <span className="text-blue-400">●</span> {d.dropoff}
        </p>
      </div>

      <ul className="space-y-3 mb-6 pl-1">
        {(d.timeline || []).map((t: any) => (
          <li key={t.id} className="flex items-center gap-3">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                t.state === 'done' ? 'bg-green-500' : t.state === 'active' ? 'bg-purple-400' : 'bg-zinc-600'
              }`}
            />
            <span
              className={
                t.state === 'active'
                  ? 'text-purple-300 font-extrabold'
                  : t.state === 'pending'
                    ? 'text-zinc-500'
                    : 'font-semibold'
              }
            >
              {t.label}
            </span>
          </li>
        ))}
      </ul>

      {msg ? <p className="text-center text-purple-300 text-sm mb-3">{msg}</p> : null}

      <button
        type="button"
        onClick={share}
        className="fixed bottom-6 left-4 right-4 max-w-xl mx-auto rounded-xl bg-zinc-900 px-4 py-3.5 flex justify-between font-semibold"
      >
        <span className="text-zinc-400">Share tracking link</span>
        <span className="text-purple-400 font-extrabold">share ↗</span>
      </button>
    </div>
  );
}
