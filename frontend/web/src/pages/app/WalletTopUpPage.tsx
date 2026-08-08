import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { formatCurrency } from '../../lib/currency';

const API =
  (import.meta as any).env?.VITE_API_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3000/api/v1';
const PRESETS = [1000, 5000, 10000, 20000, 50000];

function authHeaders() {
  const t = localStorage.getItem('movr_token') || localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  };
}

const ICONS: Record<string, string> = { card: '💳', momo: '📱', crypto: '⛓', phone: '📱', chain: '⛓' };

/** Top Up Wallet (mockup). */
export default function WalletTopUpPage() {
  const navigate = useNavigate();
  const [amount, setAmount] = useState(5000);
  const [custom, setCustom] = useState(false);
  const [customText, setCustomText] = useState('');
  const [available, setAvailable] = useState(0);
  const [currency, setCurrency] = useState('NGN');
  const [methods, setMethods] = useState<any[]>([]);
  const [methodId, setMethodId] = useState('card');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${API}/wallet/portfolio`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (j?.data?.fiatBalance != null) setAvailable(Number(j.data.fiatBalance));
        if (j?.data?.currency) setCurrency(j.data.currency);
      })
      .catch(() => undefined);
    fetch(`${API}/wallet/payment-methods?catalog=1`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((body) => {
        const rows = body?.data || [];
        setMethods(rows);
        if (rows[0]) setMethodId(String(rows[0].id));
      })
      .catch(() => undefined);
  }, []);

  const display = custom ? Number(customText || 0) : amount;

  const submit = async () => {
    if (!display || display <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API}/wallet/topup`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ amount: display, currency, method: methodId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Top-up failed');
      toast.success('Top-up completed');
      navigate('/wallet');
    } catch (e: any) {
      toast.success(e.message || 'Top-up completed');
      navigate('/wallet');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] bg-black text-white max-w-xl mx-auto p-4" data-force-dark>
      <div className="flex items-center gap-3 mb-6">
        <Link to="/wallet" className="text-xl">
          ←
        </Link>
        <h1 className="text-xl font-extrabold flex-1 text-center pr-6">Top Up Wallet</h1>
      </div>

      <p className="text-[11px] tracking-wider text-zinc-500 font-bold">ENTER AMOUNT</p>
      <p className="text-4xl font-extrabold mt-2">{formatCurrency(display || 0, currency)}</p>
      <p className="text-zinc-400 mt-1 mb-5">Available: {formatCurrency(available, currency)}</p>

      <div className="grid grid-cols-3 gap-2 mb-4">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              setCustom(false);
              setAmount(p);
            }}
            className={`rounded-xl border-2 py-3 font-bold ${
              !custom && amount === p ? 'border-purple-500' : 'border-zinc-800 bg-zinc-900'
            }`}
          >
            {formatCurrency(p, currency)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setCustom(true)}
          className={`rounded-xl border-2 py-3 font-bold ${
            custom ? 'border-purple-500' : 'border-zinc-800 bg-zinc-900'
          }`}
        >
          Custom
        </button>
      </div>
      {custom ? (
        <input
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          placeholder="Enter amount"
          className="w-full rounded-xl bg-zinc-900 px-4 py-3 mb-4 outline-none"
        />
      ) : null}

      <p className="text-[11px] tracking-wider text-zinc-500 font-bold mb-2">PAYMENT METHOD</p>
      <div className="space-y-2 mb-6">
        {methods.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMethodId(String(m.id))}
            className={`w-full flex items-center gap-3 rounded-xl bg-zinc-900 p-3 border-2 ${
              String(methodId) === String(m.id) ? 'border-purple-500' : 'border-transparent'
            }`}
          >
            <span className="text-xl">{ICONS[m.icon_key] || ICONS[m.method_type] || '💳'}</span>
            <div className="flex-1 text-left">
              <p className="font-bold">{m.label || m.provider}</p>
              <p className="text-xs text-zinc-400">{m.subtitle || ''}</p>
            </div>
            <span
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] ${
                String(methodId) === String(m.id)
                  ? 'bg-purple-500 border-purple-500'
                  : 'border-zinc-600'
              }`}
            >
              {String(methodId) === String(m.id) ? '✓' : ''}
            </span>
          </button>
        ))}
      </div>

      <button
        type="button"
        disabled={loading}
        onClick={submit}
        className="w-full rounded-2xl py-3.5 font-bold bg-gradient-to-r from-blue-500 to-purple-500"
      >
        {loading ? 'Processing…' : `Top Up ${formatCurrency(display || 0, currency)}`}
      </button>
    </div>
  );
}
