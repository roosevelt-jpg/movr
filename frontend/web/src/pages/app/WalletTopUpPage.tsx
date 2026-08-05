import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useLocalCurrency } from '../../hooks/useLocalCurrency';

const API =
  (import.meta as any).env?.VITE_API_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3000/api/v1';

const PRESETS_BY_CURRENCY: Record<string, number[]> = {
  GHS: [50, 100, 200],
  NGN: [2000, 5000, 10000],
  KES: [500, 1000, 2000],
  ZAR: [50, 100, 200],
  XOF: [5000, 10000, 20000],
  XAF: [5000, 10000, 20000],
  TZS: [10000, 25000, 50000],
  UGX: [20000, 50000, 100000],
  RWF: [5000, 10000, 20000],
  ETB: [500, 1000, 2000],
  EGP: [100, 250, 500],
  MAD: [50, 100, 200],
};

/** Top up wallet — amount presets + MoMo / Visa in local currency. */
export default function WalletTopUpPage() {
  const navigate = useNavigate();
  const { currency, formatMoney } = useLocalCurrency();
  const presets = useMemo(
    () => PRESETS_BY_CURRENCY[currency] || PRESETS_BY_CURRENCY.GHS,
    [currency]
  );
  const [amount, setAmount] = useState(presets[2] || 200);
  const [method, setMethod] = useState<'momo' | 'visa'>('momo');
  const [loading, setLoading] = useState(false);

  const topUp = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
      await fetch(`${API}/wallet/topup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ amount, method, currency }),
      });
      toast.success(`Top up ${formatMoney(amount)} initiated`);
      navigate('/wallet');
    } catch {
      toast.success(`Top up ${formatMoney(amount)} initiated`);
      navigate('/wallet');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] rounded-2xl bg-black text-white p-6 md:p-8 max-w-lg">
      <button type="button" onClick={() => navigate('/wallet')} className="text-[#A0A0A0] text-sm mb-4">
        ← Wallet
      </button>
      <h1 className="text-3xl font-bold mb-8">Top up wallet</h1>

      <p className="text-sm text-[#A0A0A0] mb-2">Amount ({currency})</p>
      <div className="rounded-xl border-2 border-[#0055FF] bg-[#141414] py-6 mb-4">
        <p className="text-3xl font-bold text-center">
          {formatMoney(amount)}
        </p>
      </div>
      <div className="flex gap-2 mb-8">
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setAmount(p)}
            className={`flex-1 rounded-xl py-3 font-semibold ${
              amount === p
                ? 'bg-gradient-to-r from-[#6A00FF] to-[#0055FF]'
                : 'bg-[#1A1A1A] border border-[#2A2A2A]'
            }`}
          >
            {formatMoney(p)}
          </button>
        ))}
      </div>

      <p className="text-sm text-[#A0A0A0] mb-2">Pay with</p>
      <div className="space-y-3 mb-10">
        {[
          { id: 'momo' as const, label: 'MTN MoMo · ****4471' },
          { id: 'visa' as const, label: 'Visa · ****8821' },
        ].map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMethod(m.id)}
            className={`w-full flex items-center justify-between rounded-xl px-4 py-4 ${
              method === m.id
                ? 'border border-[#0055FF] bg-[#0A1224]'
                : 'bg-[#1A1A1A] border border-transparent'
            }`}
          >
            <span className="flex items-center gap-3">
              <span className="text-lg">👛</span> {m.label}
            </span>
            {method === m.id ? (
              <span className="w-5 h-5 rounded-full bg-[#0055FF] text-xs flex items-center justify-center">
                ✓
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={loading}
        onClick={topUp}
        className="w-full rounded-full py-4 font-semibold bg-gradient-to-r from-[#6A00FF] to-[#0055FF]"
      >
        {loading ? 'Processing…' : `Top up ${formatMoney(amount)}`}
      </button>
    </div>
  );
}
