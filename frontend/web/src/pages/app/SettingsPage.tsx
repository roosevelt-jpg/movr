import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

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

/** Settings preferences (mockup). */
export default function SettingsPage() {
  const navigate = useNavigate();
  const [prefs, setPrefs] = useState<any>({
    language: 'English',
    currencyLabel: 'NGN (₦)',
    darkMode: true,
    locationEnabled: true,
    rideNotifications: true,
    shoppingNotifications: true,
    dvtEnabled: true,
    walletPaymentEnabled: false,
  });

  useEffect(() => {
    fetch(`${API}/me/settings`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (j?.data) setPrefs((p: any) => ({ ...p, ...j.data }));
      })
      .catch(() => undefined);
  }, []);

  const patch = async (partial: Record<string, any>) => {
    setPrefs((p: any) => ({ ...p, ...partial }));
    await fetch(`${API}/me/settings`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(partial),
    }).catch(() => undefined);
  };

  const Toggle = ({
    icon,
    value,
    onChange,
  }: {
    icon: string;
    value: boolean;
    onChange: (v: boolean) => void;
  }) => (
    <div className="flex items-center gap-3 px-3 py-3.5 border-b border-zinc-200">
      <span className="text-xl w-9">{icon}</span>
      <div className="flex-1" />
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`w-12 h-7 rounded-full relative transition ${
          value ? 'bg-purple-600' : 'bg-zinc-400'
        }`}
      >
        <span
          className={`absolute top-0.5 w-6 h-6 rounded-full bg-white transition ${
            value ? 'left-5' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  );

  return (
    <div className="min-h-[70vh] bg-white text-zinc-900 max-w-xl mx-auto p-4">
      <div className="flex items-center gap-3 mb-5">
        <Link to="/profile" className="text-xl">
          ←
        </Link>
        <h1 className="text-2xl font-extrabold">Settings</h1>
      </div>

      <div className="rounded-2xl bg-zinc-50 overflow-hidden">
        <button
          type="button"
          className="w-full flex items-center gap-3 px-3 py-3.5 border-b border-zinc-200 text-left"
          onClick={() =>
            patch({ language: prefs.language === 'English' ? 'Français' : 'English' })
          }
        >
          <span className="text-xl w-9">🌐</span>
          <span className="flex-1 font-semibold">{prefs.language}</span>
          <span className="text-zinc-400">›</span>
        </button>
        <button
          type="button"
          className="w-full flex items-center gap-3 px-3 py-3.5 border-b border-zinc-200 text-left"
          onClick={() =>
            patch(
              String(prefs.currencyLabel || '').includes('GHS')
                ? { currency: 'NGN', currencyLabel: 'NGN (₦)' }
                : { currency: 'GHS', currencyLabel: 'GHS (GH₵)' }
            )
          }
        >
          <span className="text-xl w-9">💰</span>
          <span className="flex-1 font-semibold">{prefs.currencyLabel || 'NGN (₦)'}</span>
          <span className="text-zinc-400">›</span>
        </button>
        <Toggle icon="🌙" value={!!prefs.darkMode} onChange={(v) => patch({ darkMode: v })} />
        <Toggle
          icon="📍"
          value={!!prefs.locationEnabled}
          onChange={(v) => patch({ locationEnabled: v })}
        />
        <Toggle
          icon="🚗"
          value={!!prefs.rideNotifications}
          onChange={(v) => patch({ rideNotifications: v })}
        />
        <Toggle
          icon="🛍"
          value={!!prefs.shoppingNotifications}
          onChange={(v) => patch({ shoppingNotifications: v })}
        />
        <Toggle
          icon="💳"
          value={!!prefs.walletPaymentEnabled}
          onChange={(v) => patch({ walletPaymentEnabled: v })}
        />
        <button
          type="button"
          className="w-full flex items-center gap-3 px-3 py-3.5 text-left"
          onClick={async () => {
            if (!confirm('Delete your Movr account?')) return;
            await fetch(`${API}/me/account/delete`, {
              method: 'POST',
              headers: authHeaders(),
              body: '{}',
            }).catch(() => undefined);
            navigate('/login');
          }}
        >
          <span className="text-xl w-9">🗑</span>
          <span className="flex-1 font-bold text-red-600">Delete Account</span>
          <span className="text-zinc-400">›</span>
        </button>
      </div>
    </div>
  );
}
