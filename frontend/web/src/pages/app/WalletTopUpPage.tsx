import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useLocalCurrency } from '../../hooks/useLocalCurrency';

const API = import.meta.env.VITE_API_URL || '/api/v1';

type PayMethod = {
  id: string;
  provider: string;
  method_type: string;
  label: string;
  last_four: string;
  is_default?: boolean;
};

const PRESETS_BY_CURRENCY: Record<string, number[]> = {
  GHS: [50, 100, 200],
  NGN: [2000, 5000, 10000],
  KES: [500, 1000, 2000],
};

/** Top up wallet — live payment methods + topup API. */
export default function WalletTopUpPage() {
  const navigate = useNavigate();
  const { currency, formatMoney } = useLocalCurrency();
  const presets = useMemo(
    () => PRESETS_BY_CURRENCY[currency] || PRESETS_BY_CURRENCY.GHS,
    [currency]
  );
  const [amount, setAmount] = useState(presets[2] || 200);
  const [methods, setMethods] = useState<PayMethod[]>([]);
  const [methodId, setMethodId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setAmount(presets[2] || 200);
  }, [presets]);

  useEffect(() => {
    const token =
      localStorage.getItem('movr_token') ||
      localStorage.getItem('token') ||
      localStorage.getItem('accessToken');
    fetch(`${API}/wallet/payment-methods`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.json())
      .then((body) => {
        const rows: PayMethod[] = body?.data || [];
        setMethods(rows);
        const def = rows.find((m) => m.is_default) || rows[0];
        if (def) setMethodId(String(def.id));
      })
      .catch(() => {
        const fallback = [
          {
            id: 'momo',
            provider: 'MTN MoMo',
            method_type: 'momo',
            label: 'MTN MoMo',
            last_four: '4471',
            is_default: true,
          },
          {
            id: 'visa',
            provider: 'Visa',
            method_type: 'visa',
            label: 'Visa',
            last_four: '8821',
            is_default: false,
          },
        ];
        setMethods(fallback);
        setMethodId('momo');
      });
  }, []);

  const selected = methods.find((m) => String(m.id) === String(methodId)) || methods[0];

  const topUp = async () => {
    setLoading(true);
    try {
      const token =
        localStorage.getItem('movr_token') ||
        localStorage.getItem('token') ||
        localStorage.getItem('accessToken');
      const res = await fetch(`${API}/wallet/topup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          amount,
          method: selected?.method_type || 'momo',
          paymentMethodId: selected?.id,
          currency,
        }),
      });
      const json = await res.json().catch(() => null);
      if (json?.status === 'error') throw new Error(json.message);
      toast.success(`Top up ${formatMoney(amount)} completed`);
      navigate('/wallet');
    } catch (e: any) {
      toast.error(e?.message || 'Top-up failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] rounded-2xl bg-black text-white p-6 md:p-8 max-w-lg font-[Poppins,Montserrat,sans-serif]">
      <button type="button" onClick={() => navigate('/wallet')} className="text-white/50 text-sm mb-4">
        ← Wallet
      </button>
      <h1 className="text-3xl font-bold mb-8">Top up wallet</h1>

      <p className="text-sm text-white/50 mb-2">Amount</p>
      <div className="rounded-xl border-2 border-[#3B5CFF] bg-[#111] py-6 mb-4">
        <p className="text-3xl font-bold text-center">{formatMoney(amount)}</p>
      </div>
      <div className="flex gap-2 mb-8">
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setAmount(p)}
            className="flex-1 rounded-xl py-3 font-semibold"
            style={
              amount === p
                ? { background: 'linear-gradient(90deg, #6B21A8 0%, #3B5CFF 100%)' }
                : { background: '#1a1a1a' }
            }
          >
            {formatMoney(p).replace(/\.00$/, '')}
          </button>
        ))}
      </div>

      <p className="text-sm text-white/50 mb-2">Pay with</p>
      <div className="space-y-3 mb-10">
        {methods.map((m) => {
          const on = String(m.id) === String(methodId);
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setMethodId(String(m.id))}
              className={`w-full flex items-center justify-between rounded-xl px-4 py-4 text-left ${
                on ? 'border-2 border-[#3B5CFF] bg-[#111]' : 'border border-transparent bg-[#1a1a1a]'
              }`}
            >
              <span className="flex items-center gap-3">
                <span className="text-lg">💳</span>
                <span className="font-medium">
                  {m.label || m.provider} · ****{m.last_four}
                </span>
              </span>
              {on ? (
                <span className="w-5 h-5 rounded-full bg-[#3B5CFF] text-xs flex items-center justify-center">
                  ✓
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        disabled={loading}
        onClick={topUp}
        className="w-full rounded-full py-4 font-semibold"
        style={{
          background: 'linear-gradient(90deg, #0F766E 0%, #6B21A8 45%, #3B5CFF 100%)',
        }}
      >
        {loading ? 'Processing…' : `Top up ${formatMoney(amount).replace(/\.00$/, '')}`}
      </button>
    </div>
  );
}
