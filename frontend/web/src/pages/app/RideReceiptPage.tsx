import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

const API = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000/api/v1';

function authHeaders() {
  const token =
    localStorage.getItem('movr_token') ||
    localStorage.getItem('token') ||
    localStorage.getItem('accessToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function naira(n: number) {
  return `₦${Number(n || 0).toLocaleString()}`;
}

/** Payment Successful ride receipt. */
export default function RideReceiptPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) {
      setError('Receipt not found');
      setLoading(false);
      return;
    }
    fetch(`${API}/rides/${id}/receipt`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (j?.data) setData(j.data);
      })
      .catch(() => setError('Could not load receipt'))
      .finally(() => setLoading(false));
  }, [id]);

  const rows: [string, string][] = [
    ['Transaction ID', data?.txnRef || ''],
    ['Service', data?.service || ''],
    ['Driver', data?.driverName || ''],
    ['From', data?.from || ''],
    ['To', data?.to || ''],
    ['Distance', data?.distanceLabel || ''],
    ['Base fare', naira(data?.baseFare)],
    ['Distance charge', naira(data?.distanceFare)],
  ];

  return (
    <div className="mx-auto max-w-lg text-white">
      <div className="mb-4 h-0.5 bg-gradient-to-r from-violet-500 to-blue-500" />
      {loading ? <p className="text-center text-zinc-400">Loading receipt…</p> : null}
      {error ? <p className="text-center text-red-400">{error}</p> : null}
      {!data ? null : (
      <>
      <div className="mb-6 flex items-center justify-between px-1">
        <button type="button" onClick={() => navigate(-1)} className="text-xl">
          ←
        </button>
        <h1 className="text-lg font-bold">Receipt</h1>
        <span className="w-6" />
      </div>

      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500 text-3xl font-black text-black">
        ✓
      </div>
      <p className="mt-4 text-center text-2xl font-extrabold">{data.statusLabel}</p>
      <p className="mt-2 text-center text-4xl font-extrabold">{naira(data.totalPaid)}</p>
      <p className="mt-1 mb-6 text-center text-sm text-white/40">{data.paidAtLabel}</p>

      <div className="space-y-3 rounded-2xl bg-zinc-900 p-4">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 text-sm">
            <span className="text-white/45">{k}</span>
            <span className="text-right font-semibold">{v}</span>
          </div>
        ))}
        <div className="flex justify-between text-sm">
          <span className="text-white/45">Platform fee</span>
          <span className="font-bold text-green-400">{naira(data.platformFee ?? 0)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-white/45">DVT discount</span>
          <span className="font-bold text-green-400">-{naira(data.dvtDiscount)}</span>
        </div>
        <div className="border-t border-zinc-800 pt-3 flex justify-between">
          <span className="font-extrabold">Total</span>
          <span className="text-lg font-extrabold">{naira(data.totalPaid)}</span>
        </div>
      </div>

      <div className="mt-3 rounded-xl bg-emerald-950/80 border border-emerald-800/50 p-4">
        <p className="font-bold text-emerald-300 text-sm">
          {data.driverKeepsLabel || 'Driver keeps 100% of this fare'}
        </p>
        <p className="text-xs text-emerald-200/70 mt-1">
          {data.fairFareNote ||
            'No commission — Movr is funded by driver subscriptions, not your fare.'}
        </p>
      </div>

      <div className="mt-4 flex items-center gap-3 rounded-xl bg-zinc-950 p-4">
        <span className="text-2xl text-violet-400">⚭</span>
        <div>
          <p className="font-bold">+{Number(data.dvtEarned || 0)} DVT tokens earned</p>
          <p className="text-sm text-white/45">Paid with: {data.paymentMethod}</p>
        </div>
      </div>

      <div className="mt-8 flex gap-3">
        <button
          type="button"
          className="flex-1 rounded-full border border-zinc-700 py-3 font-bold"
          onClick={() => navigator.clipboard?.writeText(String(data.txnRef || ''))}
        >
          Share
        </button>
        <Link
          to="/refer"
          className="flex-1 rounded-full border border-violet-700 py-3 text-center font-bold text-violet-300"
        >
          Refer
        </Link>
        <Link
          to="/history"
          className="flex-1 rounded-full bg-violet-600 py-3 text-center font-bold"
        >
          Done
        </Link>
      </div>
      </>
      )}
    </div>
  );
}
