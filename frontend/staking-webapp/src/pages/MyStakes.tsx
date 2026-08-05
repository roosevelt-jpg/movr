import React, { useEffect, useState } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

export default function MyStakes() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetch(`${API}/public/staking/stats`)
      .then((r) => r.json())
      .then((j) => setStats(j.data))
      .catch(() => undefined);
  }, []);

  return (
    <div className="panel">
      <h1>My Stakes / Unstake</h1>
      <p className="muted">
        After connecting a wallet, positions are read from the StakingPool contract. Aggregate
        pool stats below are live from the API.
      </p>
      <ul>
        {(stats?.pools || []).map((p: any) => (
          <li key={p.id} style={{ marginBottom: 12 }}>
            <strong>{p.name}</strong>
            <div className="muted">
              Staked {Number(p.total_staked).toLocaleString()} · {p.participants} participants
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
