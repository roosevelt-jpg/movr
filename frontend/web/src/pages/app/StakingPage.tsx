import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const API =
  (import.meta as any).env?.VITE_API_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3000/api/v1';
const ICONS: Record<string, string> = { sprout: '🌱', bolt: '⚡', lock: '🔒' };

function authHeaders() {
  const t = localStorage.getItem('movr_token') || localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  };
}

/** DVT Staking dashboard (mockup). */
const StakingPage: React.FC = () => {
  const [data, setData] = useState<any>({
    staked: 500,
    apy: 14.5,
    rewardsEarned: 72.5,
    lockPeriodDays: 30,
    pools: [],
  });
  const [selected, setSelected] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => {
    fetch(`${API}/staking/dashboard`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (j?.data) {
          setData(j.data);
          setSelected(j.data.yourPoolId || '');
        }
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    load();
  }, []);

  const stakeMore = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${API}/staking/stake`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ poolId: selected || data.yourPoolId, amount: 100 }),
      });
      const json = await res.json();
      setMsg(json.message || (res.ok ? 'Staked +100 DVT' : 'Stake queued'));
      load();
    } catch (e: any) {
      setMsg(e.message || 'Stake queued');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[70vh] bg-black text-white max-w-xl mx-auto p-4 pb-28" data-force-dark>
      <div className="rounded-2xl bg-[#1A1028] p-5 mb-5">
        <p className="text-[11px] tracking-wider text-violet-300 font-bold">YOUR STAKED TOKENS</p>
        <p className="text-4xl font-extrabold mt-2">{Number(data.staked || 0).toLocaleString()} DVT</p>
        <div className="grid grid-cols-3 gap-2 mt-5 text-sm">
          <div>
            <p className="text-zinc-500 text-xs">APY</p>
            <p className="text-green-400 font-extrabold mt-1">{Number(data.apy || 0)}%</p>
          </div>
          <div>
            <p className="text-zinc-500 text-xs">Rewards Earned</p>
            <p className="font-bold mt-1">{Number(data.rewardsEarned || 0)} DVT</p>
          </div>
          <div>
            <p className="text-zinc-500 text-xs">Lock Period</p>
            <p className="font-bold mt-1">{Number(data.lockPeriodDays || 30)} days</p>
          </div>
        </div>
      </div>

      <div className="space-y-2.5 mb-6">
        {(data.pools || []).map((p: any) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setSelected(p.id)}
            className={`w-full flex items-center gap-3 rounded-2xl bg-zinc-900 p-3 text-left border relative ${
              p.isYourPool || selected === p.id ? 'border-purple-500' : 'border-transparent'
            }`}
          >
            {p.isYourPool ? (
              <span className="absolute right-3 top-2 rounded-full bg-purple-500 px-2 py-0.5 text-[10px] font-extrabold">
                YOUR POOL
              </span>
            ) : null}
            <span className="w-10 h-10 rounded-xl bg-violet-950 flex items-center justify-center text-lg">
              {ICONS[p.icon] || '🔒'}
            </span>
            <div className="flex-1">
              <p className="font-extrabold">{p.name}</p>
              <p className="text-xs text-zinc-500 mt-1">{p.subtitle}</p>
            </div>
            <div className="text-right">
              <p className="text-green-400 font-extrabold">{Number(p.apy)}%</p>
              <p className="text-xs text-zinc-500">APY</p>
            </div>
          </button>
        ))}
      </div>

      {msg ? <p className="text-center text-zinc-400 mb-3 text-sm">{msg}</p> : null}

      <div className="fixed bottom-4 left-0 right-0 max-w-xl mx-auto px-4 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={stakeMore}
          className="flex-1 rounded-2xl py-3.5 font-extrabold bg-gradient-to-r from-blue-500 to-purple-600"
        >
          {busy ? 'Staking…' : 'Stake More'}
        </button>
        <Link
          to="/token"
          className="w-14 rounded-2xl border-2 border-white"
          aria-label="Token"
        />
      </div>
    </div>
  );
};

export default StakingPage;
