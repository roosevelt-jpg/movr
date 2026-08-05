import React, { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import MerchantShell from '../../layouts/MerchantShell';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';

function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('movr_merchant_token') || ''}` };
}

/** Phase 7 — merchant portal staking section */
export default function MerchantStakingPage() {
  const [pools, setPools] = useState<any[]>([]);
  const [stakes, setStakes] = useState<any[]>([]);
  const [tier, setTier] = useState<any>(null);
  const [amount, setAmount] = useState('');
  const [poolId, setPoolId] = useState('');

  const load = async () => {
    const [p, s] = await Promise.all([
      axios.get(`${API}/staking/pools?role=merchant`, { headers: authHeaders() }),
      axios.get(`${API}/staking/my-stakes`, { headers: authHeaders() }),
    ]);
    setPools(p.data.data || []);
    if (p.data.data?.[0]) setPoolId(p.data.data[0].id);
    setStakes(s.data.data?.stakes || []);
    setTier(s.data.data?.tiers?.merchant);
  };

  useEffect(() => {
    load().catch((err) => toast.error(err.message));
  }, []);

  const stake = async () => {
    await axios.post(
      `${API}/staking/stake`,
      { poolId, amount: Number(amount) },
      { headers: authHeaders() }
    );
    toast.success('Staked');
    setAmount('');
    await load();
  };

  return (
    <MerchantShell activePath="/merchant/staking">
      <h1 className="text-3xl font-bold mb-2">Merchant staking</h1>
      <p className="text-[#A0A0A0] mb-6">
        Higher stake → lower platform fee + boosted store placement.
        {tier?.tier ? ` Current tier: ${tier.tier} (−${tier.feeDiscountPct}% fee)` : ''}
      </p>
      <div className="bg-[#121212] border border-[#2A2A2A] rounded-2xl p-5 space-y-3 mb-6 max-w-lg">
        <select
          className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-3 py-2"
          value={poolId}
          onChange={(e) => setPoolId(e.target.value)}
        >
          {pools.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} (min {p.min_amount})
            </option>
          ))}
        </select>
        <input
          className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-3 py-2"
          placeholder="DVT amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <button
          onClick={() => stake().catch((e) => toast.error(e.response?.data?.message || e.message))}
          className="rounded-xl px-5 py-2.5 font-semibold bg-gradient-to-r from-[#6A00FF] to-[#0055FF]"
        >
          Stake
        </button>
      </div>
      <ul className="space-y-2 max-w-lg">
        {stakes
          .filter((s) => s.target_role === 'merchant')
          .map((s) => (
            <li
              key={s.id}
              className="border border-[#2A2A2A] rounded-xl bg-[#121212] p-3 text-sm"
            >
              {s.pool_name}: {Number(s.amount).toFixed(2)} DVT · {s.status}
            </li>
          ))}
      </ul>
    </MerchantShell>
  );
}
