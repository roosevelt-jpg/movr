import React, { useEffect, useState } from 'react';

const API = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000/api/v1';

function authHeaders() {
  const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** Phase 7 — in-app custodial staking */
const StakingPage: React.FC = () => {
  const [pools, setPools] = useState<any[]>([]);
  const [stakes, setStakes] = useState<any[]>([]);
  const [tiers, setTiers] = useState<any>(null);
  const [poolId, setPoolId] = useState('');
  const [amount, setAmount] = useState('');
  const [msg, setMsg] = useState('');
  const [enabled, setEnabled] = useState(false);

  const load = () => {
    Promise.all([
      fetch(`${API}/staking/pools`, { headers: authHeaders() }).then((r) => r.json()),
      fetch(`${API}/staking/my-stakes`, { headers: authHeaders() }).then((r) => r.json()),
    ]).then(([p, s]) => {
      if (p?.data) {
        setPools(p.data);
        if (!poolId && p.data[0]) setPoolId(p.data[0].id);
      }
      if (s?.data) {
        setStakes(s.data.stakes || []);
        setTiers(s.data.tiers);
        setEnabled(!!s.data.enabled);
      }
    });
  };

  useEffect(() => {
    load();
  }, []);

  const stake = async () => {
    setMsg('');
    const res = await fetch(`${API}/staking/stake`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ poolId, amount: Number(amount) }),
    });
    const json = await res.json();
    setMsg(json.message || (res.ok ? 'Staked' : 'Failed'));
    if (res.ok) {
      setAmount('');
      load();
    }
  };

  const unstake = async (stakeId: string) => {
    const res = await fetch(`${API}/staking/unstake`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ stakeId }),
    });
    const json = await res.json();
    setMsg(json.message || (res.ok ? 'Unstaked' : 'Failed'));
    load();
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl p-8 text-pure-white bg-gradient-to-r from-surface to-movr-green">
        <h1 className="text-3xl font-bold">Staking</h1>
        <p className="text-pure-white/80 mt-2">Driver priority · Merchant fees · Public points APY</p>
        {!enabled && (
          <p className="mt-3 text-amber-200 text-sm">STAKING_SYSTEM_ENABLED is off — views only.</p>
        )}
        {tiers && (
          <div className="mt-4 flex gap-6 text-sm">
            <span>Driver tier: {tiers.driver?.tier || 'none'}</span>
            <span>Merchant tier: {tiers.merchant?.tier || 'none'}</span>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border p-6 space-y-3">
        <h2 className="font-semibold text-lg">Stake DVT</h2>
        <select
          className="border rounded-lg px-3 py-2 w-full"
          value={poolId}
          onChange={(e) => setPoolId(e.target.value)}
        >
          {pools.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.target_role}) — min {p.min_amount}
            </option>
          ))}
        </select>
        <div className="flex gap-3">
          <input
            className="border rounded-lg px-3 py-2 flex-1"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <button onClick={stake} className="bg-movr-green text-pure-white px-5 py-2 rounded-lg font-semibold">
            Stake
          </button>
        </div>
        {msg && <p className="text-sm text-gray-700">{msg}</p>}
      </div>

      <div className="bg-white rounded-xl border p-6">
        <h2 className="font-semibold text-lg mb-3">My stakes</h2>
        <ul className="divide-y">
          {stakes.map((s) => (
            <li key={s.id} className="py-3 flex justify-between items-center text-sm gap-4">
              <div>
                <p className="font-medium">{s.pool_name}</p>
                <p className="text-gray-500">
                  {Number(s.amount).toFixed(2)} DVT · {s.status} · unlock {new Date(s.unlock_at).toLocaleDateString()}
                </p>
              </div>
              {s.status !== 'withdrawn' && (
                <button
                  onClick={() => unstake(s.id)}
                  className="text-electric-violet font-semibold"
                >
                  Unstake
                </button>
              )}
            </li>
          ))}
          {!stakes.length && <li className="py-3 text-gray-500">No stakes yet</li>}
        </ul>
      </div>

      <div className="bg-white rounded-xl border p-6">
        <h2 className="font-semibold mb-2">Pools</h2>
        <ul className="space-y-2 text-sm">
          {pools.map((p) => (
            <li key={p.id} className="border rounded-lg p-3">
              <p className="font-medium">{p.name}</p>
              <p className="text-gray-600">{p.apy_or_benefit_desc}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default StakingPage;
