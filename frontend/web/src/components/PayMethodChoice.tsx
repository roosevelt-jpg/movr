import React, { useEffect, useState } from 'react';

const API =
  (import.meta as any).env?.VITE_API_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3000/api/v1';

export type PayChoice = {
  id: string;
  label: string;
  subtitle?: string;
  methodId?: string | null;
};

function authHeaders(extraToken?: string | null) {
  const t =
    extraToken ||
    localStorage.getItem('movr_token') ||
    localStorage.getItem('token') ||
    localStorage.getItem('movr_merchant_token');
  return {
    'Content-Type': 'application/json',
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  };
}

const FALLBACK: PayChoice[] = [
  { id: 'wallet', label: 'Wallet balance', subtitle: 'Pay from balance' },
  { id: 'card', label: 'Card', subtitle: 'Visa / Mastercard' },
  { id: 'momo', label: 'Mobile Money', subtitle: 'MTN / Airtel / Vodafone' },
];

/** Wallet / saved card / MoMo picker for web. */
export default function PayMethodChoice({
  value,
  onChange,
  token,
  className = '',
}: {
  value: string;
  onChange: (id: string, option?: PayChoice) => void;
  token?: string | null;
  className?: string;
}) {
  const [options, setOptions] = useState<PayChoice[]>(FALLBACK);
  useEffect(() => {
    fetch(`${API}/me/checkout-methods`, { headers: authHeaders(token) })
      .then((r) => r.json())
      .then((j) => {
        if (Array.isArray(j?.data?.options) && j.data.options.length) setOptions(j.data.options);
      })
      .catch(() => undefined);
  }, [token]);

  return (
    <div className={`space-y-2 ${className}`}>
      <p className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">Pay with</p>
      {options.map((o) => {
        const on = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id, o)}
            className={`w-full text-left rounded-xl px-3 py-2.5 border text-sm ${
              on
                ? 'border-violet-500 bg-violet-500/10'
                : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-600'
            }`}
          >
            <span className="font-semibold block">{o.label}</span>
            <span className="text-xs text-zinc-500">{o.subtitle}</span>
          </button>
        );
      })}
    </div>
  );
}
