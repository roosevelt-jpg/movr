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
    if (!eth) {
      alert('Install a Web3 wallet (e.g. MetaMask) to connect');
      return;
    }
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
      id: live?.id || card.id,
      title: live?.name || card.title,
      subtitle: live?.apy_or_benefit_desc || card.subtitle,
      apy:
        live?.base_apy_pct > 0
          ? `${Number(live.base_apy_pct).toFixed(1)}%`
          : card.apy,
    };
  });

  const total = Number(stats?.totalStaked || 0);

  return (
    <div style={{ minHeight: '100vh', background: '#000', color: '#fff', padding: '28px 32px 64px' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 72,
        }}
      >
        <div style={{ fontSize: 20 }}>
          <strong>Movr</strong>
          <span style={{ color: '#A0A0A0' }}> · Stake</span>
        </div>
        <button
          onClick={connect}
          style={{
            background: 'transparent',
            border: '1px solid #2A2A2A',
            color: '#fff',
            borderRadius: 999,
            padding: '10px 16px',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          {account ? `${account.slice(0, 6)}…${account.slice(-4)}` : '💳  Connect wallet'}
        </button>
      </header>

      <section style={{ textAlign: 'center', marginBottom: 56 }}>
        <p style={{ color: '#A0A0A0', marginBottom: 8 }}>Total value staked</p>
        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.2rem)', margin: 0, fontWeight: 800 }}>
          {total.toLocaleString()} DVT
        </h1>
      </section>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 16,
          maxWidth: 960,
          margin: '0 auto',
        }}
      >
        {pools.map((p) => (
          <div
            key={p.id}
            style={{
              background: '#121212',
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
                  background: 'transparent',
                  color: '#888',
                  fontWeight: 700,
                }}
              >
                {p.cta}
              </button>
            ) : (
              <Link
                to={`/stake?pool=${encodeURIComponent(String(p.id))}`}
                style={{
                  display: 'block',
                  textAlign: 'center',
                  borderRadius: 999,
                  padding: '12px 16px',
                  background: 'linear-gradient(90deg, #2dd4bf, #6A00FF)',
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
