import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

const API = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000/api/v1';
const DEMO = 'f3000000-0000-4000-8000-000000004821';

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

/** Payment Successful ride receipt (mockup). */
export default function RideReceiptPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<any>({
    statusLabel: 'Payment Successful',
    totalPaid: 1200,
    paidAtLabel: 'Apr 8, 2026 · 9:12 AM',
    txnRef: 'MVR-TXN-48219',
    service: 'Standard Ride',
    driverName: 'Emeka Okafor',
    from: 'Victoria Island',
    to: 'Lekki Phase 1',
    distanceLabel: '8.4 km · 18 min',
    baseFare: 900,
    distanceFare: 360,
    dvtDiscount: 60,
    dvtEarned: 120,
    paymentMethod: 'Movr Wallet',
  });

  useEffect(() => {
    fetch(`${API}/rides/${id || DEMO}/receipt`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (j?.data) setData((d: any) => ({ ...d, ...j.data }));
      })
      .catch(() => undefined);
  }, [id]);

  const rows: [string, string][] = [
    ['Transaction ID', data.txnRef],
    ['Service', data.service],
    ['Driver', data.driverName],
    ['From', data.from],
    ['To', data.to],
    ['Distance', data.distanceLabel],
    ['Base fare', naira(data.baseFare)],
    ['Distance charge', naira(data.distanceFare)],
  ];

  return (
    <div className="mx-auto max-w-lg text-white">
      <div className="mb-4 h-0.5 bg-gradient-to-r from-violet-500 to-blue-500" />
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
          <span className="text-white/45">DVT discount</span>
          <span className="font-bold text-green-400">-{naira(data.dvtDiscount)}</span>
        </div>
        <div className="border-t border-zinc-800 pt-3 flex justify-between">
          <span className="font-extrabold">Total</span>
          <span className="text-lg font-extrabold">{naira(data.totalPaid)}</span>
        </div>
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
          to="/history"
          className="flex-1 rounded-full bg-violet-600 py-3 text-center font-bold"
        >
          Done
        </Link>
      </div>
    </div>
  );
}
