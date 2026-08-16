import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
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

type Pkg = { code: string; name: string; weight_label: string; base_fee: number; icon_key?: string };

function pkgIcon(key?: string) {
  if (key === 'document') return '📄';
  if (key === 'crate') return '🪑';
  return '📦';
}

/** Parcel start — pickup, drop-off, package type, then schedule. */
export default function ParcelSendPage() {
  const navigate = useNavigate();
  const [pkgs, setPkgs] = useState<Pkg[]>([]);
  const [selected, setSelected] = useState('');
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [currency, setCurrency] = useState('NGN');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${API}/deliveries/quote?packageType=${selected}`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (Array.isArray(j?.data?.packageTypes)) {
          const rows = j.data.packageTypes.map((p: any) => ({
            code: p.code,
            name: p.name,
            weight_label: p.weight_label,
            base_fee: Number(p.base_fee),
            icon_key: p.icon_key,
          }));
          setPkgs(rows);
          if (!selected && rows[0]?.code) setSelected(rows[0].code);
        }
        if (j?.data?.currency) setCurrency(j.data.currency);
      })
      .catch(() => undefined);
  }, [selected]);

  const active = pkgs.find((p) => p.code === selected) || pkgs[0];
  const fee = Number(active?.base_fee || 0);

  const schedule = async () => {
    if (!pickup.trim() || !dropoff.trim()) {
      toast.error('Enter pickup and drop-off');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API}/deliveries`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          pickupAddress: pickup,
          dropoffAddress: dropoff,
          packageType: selected,
          speedTier: 'standard',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Could not schedule');
      const id = json.data?.id || json.data?.trackingRef;
      toast.success('Pickup scheduled');
      navigate(id ? `/parcel/${id}` : '/history');
    } catch (e: any) {
      toast.error(e.message || 'Could not schedule');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] bg-black text-white max-w-xl mx-auto p-4" data-force-dark>
      <Link to="/parcel" className="text-purple-400 font-semibold">
        ← Parcel
      </Link>
      <h1 className="text-3xl font-extrabold mt-6">Send a parcel</h1>
      <p className="text-zinc-400 mt-1 mb-6">Pickup, drop-off, and package type</p>

      <label className="block text-xs text-zinc-500 mb-1">Pickup</label>
      <input
        className="w-full rounded-xl bg-zinc-900 px-4 py-3 mb-3 outline-none"
        value={pickup}
        onChange={(e) => setPickup(e.target.value)}
        placeholder="Pickup address"
      />
      <label className="block text-xs text-zinc-500 mb-1">Drop-off</label>
      <input
        className="w-full rounded-xl bg-zinc-900 px-4 py-3 mb-6 outline-none"
        value={dropoff}
        onChange={(e) => setDropoff(e.target.value)}
        placeholder="Drop-off address"
      />

      <p className="text-xs font-bold tracking-wider text-zinc-500 mb-2">PACKAGE TYPE</p>
      <div className="grid grid-cols-3 gap-2 mb-6">
        {pkgs.map((p) => (
          <button
            key={p.code}
            type="button"
            onClick={() => setSelected(p.code)}
            className={`rounded-2xl p-3 text-center border ${
              selected === p.code ? 'border-purple-500 bg-zinc-900' : 'border-zinc-800 bg-zinc-950'
            }`}
          >
            <div className="text-xl">{pkgIcon(p.icon_key)}</div>
            <div className="text-xs font-bold mt-1">{p.name}</div>
            <div className="text-[10px] text-zinc-500">{p.weight_label}</div>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-zinc-900 px-4 py-3 mb-4">
        <span className="text-sm text-zinc-400">Estimated cost</span>
        <span className="font-extrabold">{formatCurrency(fee, currency)}</span>
      </div>

      <button
        type="button"
        onClick={schedule}
        disabled={loading}
        className="w-full rounded-full py-3.5 font-bold bg-gradient-to-r from-purple-500 to-blue-500 disabled:opacity-50"
      >
        {loading ? 'Scheduling…' : 'Schedule pickup'}
      </button>
    </div>
  );
}
