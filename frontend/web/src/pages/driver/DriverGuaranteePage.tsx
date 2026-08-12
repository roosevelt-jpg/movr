import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { formatCurrency } from '../../lib/currency';

const API =
  (import.meta as any).env?.VITE_API_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3000/api/v1';

function authHeaders() {
  const token =
    localStorage.getItem('movr_token') ||
    localStorage.getItem('token') ||
    localStorage.getItem('accessToken');
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

const DriverGuaranteePage: React.FC = () => {
  const [minAmount, setMinAmount] = useState('80');
  const [windowHours, setWindowHours] = useState('8');
  const [currency, setCurrency] = useState('GHS');
  const [rows, setRows] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  const load = () => {
    fetch(`${API}/rails/driver/guarantee`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => setRows(Array.isArray(j?.data) ? j.data : []))
      .catch(() => setRows([]));
  };

  useEffect(() => {
    load();
  }, []);

  const enroll = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/rails/driver/guarantee`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          minAmount: Number(minAmount),
          windowHours: Number(windowHours),
          currency,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message || 'Failed');
      toast.success('Guarantee enrolled');
      load();
    } catch (e: any) {
      toast.error(e.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Income floor</h2>
        <p className="text-sm opacity-60 mt-1">
          Platform tops up if you miss the floor after online hours.
        </p>
      </div>
      {(
        [
          ['Min amount', minAmount, setMinAmount],
          ['Window hours', windowHours, setWindowHours],
          ['Currency', currency, setCurrency],
        ] as const
      ).map(([name, value, set]) => (
        <label key={name} className="block text-sm">
          <span className="opacity-70">{name}</span>
          <input
            className="mt-1 w-full rounded-lg border border-black/15 px-3 py-2 bg-white"
            value={value}
            onChange={(e) => set(e.target.value)}
          />
        </label>
      ))}
      <button
        type="button"
        disabled={saving}
        onClick={enroll}
        className="w-full rounded-xl bg-emerald-800 text-white py-3 font-semibold disabled:opacity-60"
      >
        {saving ? 'Enrolling…' : 'Enroll guarantee'}
      </button>
      <div className="space-y-2 pt-2">
        <p className="font-semibold text-sm">Your guarantees</p>
        {rows.length === 0 ? (
          <p className="text-sm opacity-50">None yet</p>
        ) : (
          rows.slice(0, 8).map((r) => (
            <div key={r.id} className="rounded-xl border border-black/10 px-3 py-2 text-sm">
              {r.status} · {formatCurrency(Number(r.min_amount || 0), r.currency || currency)} /{' '}
              {r.window_hours}h
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default DriverGuaranteePage;
