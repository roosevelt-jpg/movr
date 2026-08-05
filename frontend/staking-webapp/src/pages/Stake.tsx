import React, { useEffect, useState } from 'react';
import { BrowserProvider } from 'ethers';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

/**
 * Non-custodial public stake UI.
 * Custodial driver/merchant staking stays in the main app; this page is wallet-native.
 * Contract calls wire to STAKING_POOL_ADDRESS when deployed.
 */
export default function Stake() {
  const [account, setAccount] = useState<string | null>(null);
  const [pools, setPools] = useState<any[]>([]);
  const [poolId, setPoolId] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    fetch(`${API}/public/staking/stats`)
      .then((r) => r.json())
      .then((j) => {
        const publicPools = (j.data?.pools || []).filter((p: any) => p.target_role === 'public');
        setPools(publicPools.length ? publicPools : j.data?.pools || []);
        if (j.data?.pools?.[0]) setPoolId(j.data.pools[0].id);
      })
      .catch(() => undefined);
  }, []);

  const connect = async () => {
    const eth = (window as any).ethereum;
    if (!eth) {
      setStatus('No injected wallet found');
      return;
    }
    const provider = new BrowserProvider(eth);
    const accounts = await provider.send('eth_requestAccounts', []);
    setAccount(accounts[0]);
  };

  const stake = async () => {
    if (!account) {
      await connect();
      return;
    }
    // Placeholder until StakingPool.sol is deployed — record intent locally for UX demos
    setStatus(
      `Ready to stake ${amount} DVT in pool ${poolId} from ${account}. ` +
        `Set VITE_STAKING_POOL_ADDRESS and wire contract call for mainnet/testnet.`
    );
  };

  return (
    <div className="panel">
      <h1>Stake</h1>
      <p className="muted">Public non-custodial staking via your wallet (wagmi/RainbowKit-ready scaffold).</p>
      {!account ? (
        <button className="btn" onClick={connect}>
          Connect Wallet
        </button>
      ) : (
        <p className="muted" style={{ fontFamily: 'monospace' }}>
          {account}
        </p>
      )}
      <label className="muted">Pool</label>
      <select value={poolId} onChange={(e) => setPoolId(e.target.value)}>
        {pools.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <label className="muted">Amount (DVT)</label>
      <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="100" />
      <button className="btn" onClick={stake}>
        Stake
      </button>
      {status && <p className="muted">{status}</p>}
    </div>
  );
}
