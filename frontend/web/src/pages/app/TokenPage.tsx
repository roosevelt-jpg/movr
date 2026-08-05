import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const API = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000/api/v1';

function authHeaders() {
  const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/**
 * Phase 5B — DVT balance, history, redeem.
 * Real token deployment has securities/regulatory implications; this is the technical UX only.
 */
const TokenPage: React.FC = () => {
  const [balance, setBalance] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [amount, setAmount] = useState('');
  const [msg, setMsg] = useState('');

  const load = () => {
    Promise.all([
      fetch(`${API}/token/balance`, { headers: authHeaders() }).then((r) => r.json()),
      fetch(`${API}/token/history`, { headers: authHeaders() }).then((r) => r.json()),
    ]).then(([b, h]) => {
      if (b?.data) setBalance(b.data);
      if (h?.data) setHistory(h.data);
    });
  };

  useEffect(() => {
    load();
  }, []);

  const redeem = async () => {
    setMsg('');
    const res = await fetch(`${API}/token/redeem`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ amount: Number(amount) }),
    });
    const json = await res.json();
    if (!res.ok) setMsg(json.message || 'Redeem failed');
    else {
      setMsg(`Redeemed ${json.data.dvtBurned} DVT → ${json.data.fiatCredit} ${json.data.currency}`);
      setAmount('');
      load();
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl p-8 text-pure-white bg-gradient-to-br from-surface via-electric-violet to-motion-blue">
        <h1 className="text-3xl font-bold mb-2">DriveToken (DVT)</h1>
        <p className="text-pure-white/80 text-sm mb-6">Utility rewards balance — pending vs on-chain</p>
        <p className="text-5xl font-bold">{balance?.total?.toFixed?.(2) ?? '—'}</p>
        <div className="mt-4 flex gap-6 text-sm text-pure-white/90">
          <span>Pending: {balance?.pending ?? 0}</span>
          <span>On-chain: {balance?.onchain ?? 0}</span>
        </div>
        {balance?.address && (
          <p className="mt-3 text-xs text-pure-white/60 font-mono truncate">{balance.address}</p>
        )}
        {!balance?.enabled && (
          <p className="mt-4 text-amber-200 text-sm">
            TOKEN_SYSTEM_ENABLED is off — ledger credits still accrue; on-chain mint is paused.
          </p>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-lg mb-3">Redeem for wallet credit</h2>
        <div className="flex gap-3">
          <input
            className="border rounded-lg px-3 py-2 flex-1"
            placeholder="DVT amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <button
            onClick={redeem}
            className="bg-electric-violet text-pure-white px-5 py-2 rounded-lg font-semibold"
          >
            Redeem
          </button>
        </div>
        {msg && <p className="mt-2 text-sm text-gray-700">{msg}</p>}
        <p className="mt-4 text-sm">
          <Link className="text-motion-blue font-medium" to="/claim">
            Claim airdrop →
          </Link>
          {' · '}
          <Link className="text-motion-blue font-medium" to="/staking">
            Stake DVT →
          </Link>
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-lg mb-3">Activity</h2>
        <ul className="divide-y">
          {history.map((row) => (
            <li key={row.id} className="py-3 flex justify-between text-sm">
              <span>
                {row.activity_type}{' '}
                <span className="text-gray-400">({row.status})</span>
              </span>
              <span className="font-semibold">{Number(row.dvt_amount).toFixed(2)} DVT</span>
            </li>
          ))}
          {!history.length && <li className="py-3 text-gray-500">No activity yet</li>}
        </ul>
      </div>
    </div>
  );
};

export default TokenPage;
