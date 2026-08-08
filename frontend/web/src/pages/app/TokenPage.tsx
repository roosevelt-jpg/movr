import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

const API = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000/api/v1';
const CHIPS = [500, 1000, 2000, 'all'] as const;

function authHeaders() {
  const token =
    localStorage.getItem('movr_token') ||
    localStorage.getItem('token') ||
    localStorage.getItem('accessToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** Redeem DVT Tokens — balance card, options, chips, summary (mockup). */
const TokenPage: React.FC = () => {
  const [balance, setBalance] = useState(2400);
  const [options, setOptions] = useState<any[]>([]);
  const [optionId, setOptionId] = useState('ride_credits');
  const [chip, setChip] = useState<number | 'all'>(1000);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = () => {
    Promise.all([
      fetch(`${API}/token/balance`, { headers: authHeaders() }).then((r) => r.json()),
      fetch(`${API}/token/redeem-options`, { headers: authHeaders() }).then((r) => r.json()),
    ]).then(([b, o]) => {
      if (b?.data?.total != null) setBalance(Number(b.data.total));
      if (Array.isArray(o?.data) && o.data.length) {
        setOptions(o.data);
        if (!o.data.find((x: any) => x.id === optionId)) setOptionId(o.data[0].id);
      } else {
        setOptions([
          {
            id: 'ride_credits',
            label: 'Ride Credits',
            dvtCost: 500,
            rewardValue: 1000,
            rateLabel: '500 DVT → ₦1,000 ride credit',
            tags: ['Best value', 'Most popular'],
            tagTone: 'violet',
            rewardType: 'ride_credit',
          },
          {
            id: 'order_discount',
            label: 'Order Discount',
            dvtCost: 300,
            rewardValue: 500,
            rateLabel: '300 DVT → ₦500 off any order',
            tags: [],
            rewardType: 'order_discount',
          },
          {
            id: 'cash_withdrawal',
            label: 'Cash Withdrawal',
            dvtCost: 1000,
            rewardValue: 1800,
            rateLabel: '1,000 DVT → ₦1,800 to wallet',
            tags: ['Lower rate', 'Instant'],
            tagTone: 'amber',
            rewardType: 'wallet_cash',
          },
        ]);
      }
    });
  };

  useEffect(() => {
    load();
  }, []);

  const option = options.find((o) => o.id === optionId) || options[0];
  const amount = chip === 'all' ? balance : Number(chip);

  const youReceive = useMemo(() => {
    if (!option || !amount) return '—';
    const units = amount / Number(option.dvtCost || 1);
    const value = Math.round(units * Number(option.rewardValue || 0));
    const unit =
      option.rewardType === 'ride_credit'
        ? 'ride credit'
        : option.rewardType === 'order_discount'
          ? 'order discount'
          : 'to wallet';
    return `₦${value.toLocaleString()} ${unit}`;
  }, [option, amount]);

  const redeem = async () => {
    setMsg('');
    setBusy(true);
    try {
      const res = await fetch(`${API}/token/redeem`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ amount, optionId: option?.id }),
      });
      const json = await res.json();
      if (!res.ok) setMsg(json.message || 'Redeem failed');
      else {
        setMsg(json.data?.youReceive ? `Redeemed · ${json.data.youReceive}` : 'Redeemed');
        load();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-5 text-white">
      <div className="flex items-center gap-3">
        <Link to="/wallet" className="text-xl text-white/70">
          ←
        </Link>
        <h1 className="flex-1 text-center text-lg font-bold">Redeem DVT Tokens</h1>
        <span className="w-6" />
      </div>

      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-700 via-violet-600 to-blue-500 p-6">
        <p className="text-xs font-bold tracking-widest text-violet-100/90">YOUR DVT BALANCE</p>
        <p className="mt-2 text-4xl font-extrabold">{balance.toLocaleString()} DVT</p>
      </div>

      <p className="text-xs font-bold tracking-widest text-white/40">REDEEM FOR</p>
      <div className="space-y-3">
        {options.map((o) => {
          const on = o.id === optionId;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => setOptionId(o.id)}
              className={`flex w-full items-start gap-3 rounded-xl border-2 bg-zinc-900 p-4 text-left ${
                on ? 'border-violet-500' : 'border-zinc-800'
              }`}
            >
              <div className="flex-1">
                <p className="font-bold">{o.label}</p>
                <p className="mt-1 text-sm text-white/45">{o.rateLabel}</p>
                {o.tags?.length ? (
                  <p
                    className={`mt-1 text-xs font-semibold ${
                      o.tagTone === 'amber' ? 'text-amber-500' : 'text-violet-400'
                    }`}
                  >
                    {o.tags.join(' · ')}
                  </p>
                ) : null}
              </div>
              <span
                className={`mt-1 flex h-6 w-6 items-center justify-center rounded-full border-2 text-sm ${
                  on ? 'border-violet-500 bg-violet-500' : 'border-zinc-600'
                }`}
              >
                {on ? '✓' : ''}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-xs font-bold tracking-widest text-white/40">AMOUNT TO REDEEM</p>
      <div className="grid grid-cols-4 gap-2">
        {CHIPS.map((c) => {
          const on = chip === c;
          return (
            <button
              key={String(c)}
              type="button"
              onClick={() => setChip(c)}
              className={`rounded-full border-2 py-2.5 text-sm font-bold ${
                on ? 'border-violet-500 bg-violet-950' : 'border-zinc-800 bg-zinc-900 text-white/50'
              }`}
            >
              {c === 'all' ? 'All' : Number(c).toLocaleString()}
            </button>
          );
        })}
      </div>

      <div className="space-y-2 rounded-xl bg-zinc-900 p-4">
        <div className="flex justify-between text-sm">
          <span className="text-white/50">Redeeming</span>
          <span className="font-semibold">{amount.toLocaleString()} DVT</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-white/50">You receive</span>
          <span className="font-extrabold text-green-400">{youReceive}</span>
        </div>
      </div>

      <button
        type="button"
        disabled={busy || amount <= 0}
        onClick={redeem}
        className="w-full rounded-full bg-gradient-to-r from-violet-600 to-blue-500 py-3.5 font-bold disabled:opacity-40"
      >
        {busy ? 'Redeeming…' : `Redeem ${amount.toLocaleString()} DVT`}
      </button>
      {msg ? <p className="text-center text-sm text-green-400">{msg}</p> : null}
    </div>
  );
};

export default TokenPage;
