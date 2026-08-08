import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

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

/** DVT Token Claim (mockup). */
const ClaimPage: React.FC = () => {
  const [data, setData] = useState<any>({
    amount: 2400,
    usdValue: 48,
    breakdown: { fromRides: 1200, fromOrders: 800, fromReferral: 400 },
    wallet: { provider: 'MetaMask', address: '0x3a4F...9d2c', connected: true },
    merkle: { verified: true, network: 'Polygon' },
    eligible: true,
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch(`${API}/token/claim/eligibility`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (j?.data) setData((d: any) => ({ ...d, ...j.data }));
      })
      .catch(() => undefined);
  }, []);

  const amount = Number(data.amount || 2400);
  const usd = Number(data.usdValue ?? amount * 0.02);
  const b = data.breakdown || {};

  const claim = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${API}/token/claim/custodial`, {
        method: 'POST',
        headers: authHeaders(),
        body: '{}',
      });
      const json = await res.json();
      setMsg(json.message || (res.ok ? 'Claim submitted' : 'Claim queued'));
    } catch (e: any) {
      setMsg(e.message || 'Claim submitted');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[70vh] bg-black text-white max-w-xl mx-auto p-4" data-force-dark>
      <div className="flex items-center gap-3 mb-5">
        <Link to="/wallet" className="text-xl">
          ←
        </Link>
        <h1 className="text-xl font-extrabold flex-1 text-center pr-6">DVT Token Claim</h1>
      </div>

      <div className="rounded-2xl p-5 mb-5 bg-gradient-to-br from-purple-500 via-violet-700 to-blue-500">
        <p className="text-4xl font-extrabold">{amount.toLocaleString()} DVT</p>
        <p className="text-white/80 mt-1">≈ ${usd.toFixed(2)} USD</p>
        <div className="grid grid-cols-3 gap-2 mt-5 text-sm">
          <div>
            <p className="text-white/70 text-xs">From Rides</p>
            <p className="font-extrabold mt-1">{Number(b.fromRides || 1200).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-white/70 text-xs">From Orders</p>
            <p className="font-extrabold mt-1">{Number(b.fromOrders || 800).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-white/70 text-xs">Referral</p>
            <p className="font-extrabold mt-1">{Number(b.fromReferral || 400).toLocaleString()}</p>
          </div>
        </div>
      </div>

      <p className="text-[11px] tracking-wider text-zinc-500 font-bold mb-2">DESTINATION WALLET</p>
      <div className="flex items-center gap-3 rounded-xl bg-zinc-900 p-3 mb-4">
        <span className="text-2xl">🦊</span>
        <div className="flex-1">
          <p className="font-bold">{data.wallet?.provider || 'MetaMask'}</p>
          <p className="text-xs text-zinc-400">{data.wallet?.address || '0x3a4F...9d2c'}</p>
        </div>
        <span className="text-xs font-bold text-green-400 border border-green-500 rounded-lg px-2 py-1">
          Connected
        </span>
      </div>

      <div className="flex gap-3 rounded-xl border border-dashed border-zinc-600 p-3 mb-4">
        <span className="text-xl">🔐</span>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-bold">Merkle Proof Verified</p>
            <span className="text-[11px] font-bold text-green-400 bg-green-500/15 px-1.5 py-0.5 rounded">
              Valid
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Your eligibility confirmed on-chain. Network: {data.merkle?.network || 'Polygon'}. Gas
            covered by Movr.
          </p>
        </div>
      </div>

      <div className="rounded-xl bg-zinc-900 p-4 space-y-2 mb-5 text-sm">
        <div className="flex justify-between">
          <span className="text-zinc-400">Claiming</span>
          <span className="font-bold">{amount.toLocaleString()} DVT</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-400">Network</span>
          <span className="font-bold">{data.merkle?.network || 'Polygon'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-400">Gas fee</span>
          <span className="font-bold text-green-400">Free (Movr pays)</span>
        </div>
      </div>

      {msg ? <p className="text-center text-zinc-400 mb-3">{msg}</p> : null}

      <button
        type="button"
        disabled={busy}
        onClick={claim}
        className="w-full rounded-2xl py-3.5 font-bold bg-gradient-to-r from-purple-500 to-blue-500"
      >
        {busy ? 'Claiming…' : `Claim ${amount.toLocaleString()} DVT`}
      </button>
    </div>
  );
};

export default ClaimPage;
