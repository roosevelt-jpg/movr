import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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

/** Driver web home — today earnings + deep links to destination / guarantee. */
const DriverHomePage: React.FC = () => {
  const [earnings, setEarnings] = useState<any>(null);
  const [guarantees, setGuarantees] = useState<any[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch(`${API}/drivers/me/earnings`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => setEarnings(j?.data || j))
      .catch(() =>
        fetch(`${API}/platform/driver/earnings`, { headers: authHeaders() })
          .then((r) => r.json())
          .then((j) => setEarnings(j?.data || null))
          .catch(() => setErr('Earnings API unavailable — use the mobile driver app for live offers'))
      );
    fetch(`${API}/rails/driver/guarantee`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => setGuarantees(Array.isArray(j?.data) ? j.data : []))
      .catch(() => undefined);
  }, []);

  const currency = earnings?.currency || 'GHS';
  const today = Number(earnings?.today ?? earnings?.todayEarnings ?? earnings?.balance ?? 0);

  return (
    <div className="space-y-6">
      <section
        className="rounded-2xl p-6 text-white"
        style={{
          background: 'linear-gradient(145deg, #0f172a 0%, #134e4a 55%, #042f2e 100%)',
        }}
      >
        <p className="text-sm text-white/70">Today</p>
        <p className="text-3xl font-bold mt-1">{formatCurrency(today, currency)}</p>
        <p className="text-sm text-white/60 mt-2">0% take-rate · keep what you earn</p>
      </section>

      {err ? <p className="text-sm text-amber-700">{err}</p> : null}

      <div className="grid gap-3">
        <Link
          to="/driver/destination"
          className="block rounded-xl border border-black/10 px-4 py-3 hover:bg-black/[0.03]"
        >
          <p className="font-semibold">Destination mode</p>
          <p className="text-sm opacity-60">Prefer trips toward home or the airport</p>
        </Link>
        <Link
          to="/driver/guarantee"
          className="block rounded-xl border border-black/10 px-4 py-3 hover:bg-black/[0.03]"
        >
          <p className="font-semibold">Income floor</p>
          <p className="text-sm opacity-60">
            {guarantees[0]
              ? `Active · ${guarantees[0].status}`
              : 'Enroll in a shift guarantee'}
          </p>
        </Link>
      </div>

      <p className="text-xs opacity-50">
        Live ride offers and navigation stay on the Movr Driver mobile app. This web surface covers
        earnings preferences and guarantees.
      </p>
    </div>
  );
};

export default DriverHomePage;
