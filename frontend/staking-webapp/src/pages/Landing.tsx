import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

/** Phase 9 staking landing — total staked + three pool cards. */
export default function Landing() {
  const [stats, setStats] = useState<any>(null);
  const [account, setAccount] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/public/staking/stats`)
      .then((r) => r.json())
      .then((j) => setStats(j.data))
      .catch(() => undefined);
  }, []);

  const connect = async () => {
    const eth = (window as any).ethereum;
    if (!eth) return;
    const accounts = await eth.request({ method: 'eth_requestAccounts' });
    setAccount(accounts[0]);
  };

  const pools = [
    {
      id: 'public',
      title: 'Public pool',
      subtitle: 'No lock-in required',
      apy: '6.5%',
      cta: 'Stake',
      restricted: false,
      match: (p: any) => p.target_role === 'public',
    },
    {
      id: 'driver',
      title: 'Driver pool',
      subtitle: '30-day lock · priority matching',
      apy: '9.2%',
      cta: 'Drivers only',
      restricted: true,
      match: (p: any) => p.target_role === 'driver',
    },
    {
      id: 'merchant',
      title: 'Merchant pool',
      subtitle: '30-day lock · lower platform fees',
      apy: '8.8%',
      cta: 'Merchants only',
      restricted: true,
      match: (p: any) => p.target_role === 'merchant',
    },
  ].map((card) => {
    const live = (stats?.pools || []).find(card.match);
    return {
      ...card,
      apy:
        live?.base_apy_pct > 0
          ? `${Number(live.base_apy_pct).toFixed(1)}%`
          : card.apy,
    };
  });

  return (
    <div>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 56,
        }}
      >
        <div style={{ fontSize: 20 }}>
          <strong>Movr</strong>
          <span style={{ color: '#A0A0A0' }}> · Stake</span>
        </div>
        <button
          onClick={connect}
          style={{
            background: '#1A1A1A',
            border: '1px solid #2A2A2A',
            color: '#fff',
            borderRadius: 10,
            padding: '10px 14px',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          {account ? `${account.slice(0, 6)}…${account.slice(-4)}` : '💳  Connect wallet'}
        </button>
      </header>

      <section style={{ textAlign: 'center', marginBottom: 48 }}>
        <p style={{ color: '#A0A0A0', marginBottom: 8 }}>Total value staked</p>
        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.2rem)', margin: 0, fontWeight: 800 }}>
          {(stats?.totalStaked || 2480000).toLocaleString()} DVT
        </h1>
      </section>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 16,
        }}
      >
        {pools.map((p) => (
          <div
            key={p.id}
            style={{
              background: '#121212',
              border: '1px solid #2A2A2A',
              borderRadius: 16,
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 220,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 20 }}>{p.title}</h2>
            <p style={{ color: '#A0A0A0', marginTop: 8, marginBottom: 24 }}>{p.subtitle}</p>
            <p style={{ marginTop: 'auto', marginBottom: 20 }}>
              <span style={{ fontSize: 28, fontWeight: 700 }}>{p.apy}</span>{' '}
              <span style={{ color: '#A0A0A0', fontSize: 13 }}>est. APY</span>
            </p>
            {p.restricted ? (
              <button
                disabled
                style={{
                  borderRadius: 999,
                  padding: '12px 16px',
                  border: '1px solid #2A2A2A',
                  background: '#0A0A0A',
                  color: '#888',
                  fontWeight: 700,
                }}
              >
                {p.cta}
              </button>
            ) : (
              <Link
                to="/stake"
                style={{
                  display: 'block',
                  textAlign: 'center',
                  borderRadius: 999,
                  padding: '12px 16px',
                  background: 'linear-gradient(90deg, #6A00FF, #0055FF)',
                  color: '#fff',
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                {p.cta}
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
