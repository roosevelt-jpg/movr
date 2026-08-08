import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '../../lib/currency';

const API =
  (import.meta as any).env?.VITE_API_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3000/api/v1';

function authHeaders() {
  const token =
    localStorage.getItem('token') ||
    localStorage.getItem('accessToken') ||
    localStorage.getItem('movr_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** Customer Withdraw — amount chips + SEND TO (mockup). */
const WithdrawPage: React.FC = () => {
  const [available, setAvailable] = useState(18400);
  const [currency, setCurrency] = useState('NGN');
  const [amount, setAmount] = useState('10000');
  const [minAmount, setMinAmount] = useState(500);
  const [feeLabel, setFeeLabel] = useState('Free');
  const [chips, setChips] = useState([2000, 5000, 10000]);
  const [methods, setMethods] = useState<any[]>([]);
  const [methodId, setMethodId] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [kycMsg, setKycMsg] = useState('');

  useEffect(() => {
    fetch(`${API}/wallet/withdraw/options`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        const d = j?.data;
        if (!d) return;
        setAvailable(Number(d.available || 18400));
        setCurrency(d.currency || 'NGN');
        setMinAmount(Number(d.minAmount || 500));
        setFeeLabel(d.feeLabel || 'Free');
        if (d.chips?.length) setChips(d.chips);
        if (d.methods?.length) {
          setMethods(d.methods);
          setMethodId((d.methods.find((m: any) => m.selected) || d.methods[0]).id);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const amt = Number(amount) || 0;
    if (!amt) {
      setKycMsg('');
      return;
    }
    fetch(`${API}/trust/kyc-gate?amount=${amt}&role=driver`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        const d = j?.data;
        if (d && d.allowed === false) setKycMsg(d.message || 'KYC required for this payout');
        else setKycMsg('');
      })
      .catch(() => setKycMsg(''));
  }, [amount]);

  const n = Number(amount) || 0;
  const selected = methods.find((m) => m.id === methodId);
  const chipActive = useMemo(() => {
    if (n === Math.floor(available)) return 'all';
    return chips.includes(n) ? n : null;
  }, [n, available, chips]);

  const withdraw = async () => {
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch(`${API}/wallet/withdraw`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          amount: n,
          methodId: selected?.id,
          methodLabel: selected?.title,
        }),
      });
      const j = await res.json();
      setMsg(res.ok ? j?.data?.message || 'Withdrawal requested' : j?.message || 'Failed');
      if (res.ok && j?.data?.available != null) setAvailable(Number(j.data.available));
    } catch {
      setMsg('Network error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[70vh] bg-black text-white max-w-xl mx-auto p-4" data-force-dark>
      <div className="flex items-center gap-3 mb-5">
        <Link to="/wallet" className="text-xl font-bold">
          ←
        </Link>
        <h1 className="text-xl font-extrabold">Withdraw</h1>
      </div>

      <div className="rounded-2xl p-6 mb-6 bg-gradient-to-br from-violet-700 to-indigo-600">
        <p className="text-xs font-bold tracking-wide text-violet-200">AVAILABLE TO WITHDRAW</p>
        <p className="text-4xl font-extrabold mt-2">{formatCurrency(available, currency)}</p>
        <p className="text-violet-100 text-sm mt-2">Wallet balance · Instant payout available</p>
      </div>

      <p className="text-xs font-bold tracking-wider text-zinc-500 mb-2">ENTER AMOUNT</p>
      <div className="flex items-center gap-2 rounded-xl border-2 border-purple-500 bg-zinc-900 px-4 h-14 mb-2">
        <span className="text-zinc-500 font-bold text-xl">₦</span>
        <input
          className="flex-1 bg-transparent text-2xl font-extrabold outline-none"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
        />
        <button type="button" className="text-purple-400 font-extrabold" onClick={() => setAmount(String(Math.floor(available)))}>
          MAX
        </button>
      </div>
      <div className="flex justify-between text-xs text-zinc-500 mb-3">
        <span>Min: {formatCurrency(minAmount, currency)}</span>
        <span>Fee: {feeLabel}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
        {chips.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setAmount(String(c))}
            className={`rounded-xl py-2.5 text-sm font-bold border ${
              chipActive === c ? 'border-purple-500 bg-zinc-900' : 'border-zinc-800 bg-zinc-900 text-zinc-400'
            }`}
          >
            ₦{c / 1000}K
          </button>
        ))}
        <button
          type="button"
          onClick={() => setAmount(String(Math.floor(available)))}
          className={`rounded-xl py-2.5 text-sm font-bold border ${
            chipActive === 'all' ? 'border-purple-500 bg-zinc-900' : 'border-zinc-800 bg-zinc-900 text-zinc-400'
          }`}
        >
          All
        </button>
      </div>

      <p className="text-xs font-bold tracking-wider text-zinc-500 mb-2">SEND TO</p>
      <div className="space-y-2 mb-6">
        {(methods.length
          ? methods
          : [
              {
                id: 'visa',
                type: 'card',
                title: 'VISA •••• 4821',
                subtitle: 'Instant · Kwame Asante',
              },
              { id: 'momo', type: 'momo', title: 'MTN MoMo', subtitle: '+234 801 234 5678' },
            ]
        ).map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMethodId(m.id)}
            className={`w-full flex items-center gap-3 rounded-xl p-3.5 border text-left ${
              methodId === m.id ? 'border-purple-500 bg-zinc-900' : 'border-zinc-800 bg-zinc-900'
            }`}
          >
            <span>{m.type === 'momo' ? '📱' : '💳'}</span>
            <span className="flex-1">
              <span className="block font-bold">{m.title}</span>
              <span className="text-xs text-zinc-500">{m.subtitle}</span>
            </span>
            <span
              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs ${
                methodId === m.id ? 'bg-purple-500 border-purple-500' : 'border-zinc-600'
              }`}
            >
              {methodId === m.id ? '✓' : ''}
            </span>
          </button>
        ))}
      </div>

      {kycMsg ? <p className="text-center text-amber-400 mb-3 text-sm">{kycMsg}</p> : null}
      {msg ? <p className="text-center text-purple-300 mb-3 text-sm">{msg}</p> : null}

      <button
        type="button"
        disabled={busy || Boolean(kycMsg)}
        onClick={withdraw}
        className="w-full rounded-2xl py-4 font-extrabold bg-indigo-500 hover:bg-indigo-400 disabled:opacity-60"
      >
        {busy ? 'Processing…' : `Withdraw ${formatCurrency(n || 0, currency)}`}
      </button>
    </div>
  );
};

export default WithdrawPage;
