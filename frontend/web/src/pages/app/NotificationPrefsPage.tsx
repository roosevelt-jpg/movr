import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API =
  (import.meta as any).env?.VITE_API_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3000/api/v1';

type Prefs = {
  driver_assigned: boolean;
  order_status_updates: boolean;
  points_earned: boolean;
  referral_updates: boolean;
  promotions_offers: boolean;
};

const DEFAULT: Prefs = {
  driver_assigned: true,
  order_status_updates: true,
  points_earned: true,
  referral_updates: false,
  promotions_offers: false,
};

const SECTIONS: { title: string; keys: { key: keyof Prefs; label: string }[] }[] = [
  {
    title: 'RIDES & ORDERS',
    keys: [
      { key: 'driver_assigned', label: 'Driver assigned' },
      { key: 'order_status_updates', label: 'Order status updates' },
    ],
  },
  {
    title: 'REWARDS',
    keys: [
      { key: 'points_earned', label: 'Points earned' },
      { key: 'referral_updates', label: 'Referral updates' },
    ],
  },
  {
    title: 'MARKETING',
    keys: [{ key: 'promotions_offers', label: 'Promotions & offers' }],
  },
];

function authHeaders() {
  const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** Notification preference toggles. */
export default function NotificationPrefsPage() {
  const navigate = useNavigate();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT);

  useEffect(() => {
    fetch(`${API}/users/notification-prefs`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (j?.data) setPrefs({ ...DEFAULT, ...j.data });
      })
      .catch(() => undefined);
  }, []);

  const toggle = async (key: keyof Prefs) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    await fetch(`${API}/users/notification-prefs`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(next),
    }).catch(() => undefined);
  };

  return (
    <div className="min-h-[70vh] bg-jet-black text-pure-white p-6 md:p-8 max-w-lg font-[Poppins,Montserrat,sans-serif]">
      <button type="button" onClick={() => navigate('/profile')} className="text-text-secondary text-sm mb-4">
        ← Profile
      </button>
      <h1 className="text-3xl font-bold mb-8">Notifications</h1>

      {SECTIONS.map((sec) => (
        <div key={sec.title} className="mb-8">
          <p className="text-xs tracking-wider text-text-secondary mb-2">{sec.title}</p>
          {sec.keys.map((row) => (
            <div
              key={row.key}
              className="flex items-center justify-between py-4 border-b border-border"
            >
              <span className="font-medium">{row.label}</span>
              <button
                type="button"
                aria-label={row.label}
                onClick={() => toggle(row.key)}
                className={`w-12 h-7 rounded-full p-0.5 flex ${
                  prefs[row.key]
                    ? 'bg-movr-gradient justify-end'
                    : 'bg-border justify-start'
                }`}
              >
                <span className="w-6 h-6 rounded-full bg-white block" />
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
