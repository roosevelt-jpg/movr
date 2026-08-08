import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

type Pool = {
  id: string;
  display_name?: string;
  name?: string;
  tagline?: string;
  apy_or_benefit_desc?: string;
  base_apy_pct?: number;
  min_stake?: number;
  min_amount?: number;
  participants?: number;
  is_popular?: boolean;
};

const FALLBACK_POOLS: Pool[] = [
  {
    id: 'flexible',
    display_name: 'Flexible Pool',
    tagline: 'No lock - Withdraw anytime',
    base_apy_pct: 8.5,
    min_stake: 100,
    participants: 0,
    is_popular: false,
  },
  {
    id: '30-day',
    display_name: '30-Day Lock',
    tagline: 'Best balance of risk & reward',
    base_apy_pct: 12.0,
    min_stake: 500,
    participants: 0,
    is_popular: true,
  },
  {
    id: '90-day',
    display_name: '90-Day Lock',
    tagline: 'Maximum yield',
    base_apy_pct: 18.5,
    min_stake: 1000,
    participants: 0,
    is_popular: false,
  },
];

function fmt(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function fmtUsd(n: number) {
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

/** DVT staking protocol landing — hero, stats, pool cards. */
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

  const livePools: Pool[] = Array.isArray(stats?.pools) && stats.pools.length ? stats.pools : FALLBACK_POOLS;

  const navLink = (to: string, label: string, active?: boolean) => (
    <Link
      to={to}
      style={{
        color: active ? '#fff' : 'rgba(255,255,255,0.55)',
        textDecoration: 'none',
        fontWeight: active ? 600 : 500,
        fontSize: 14,
      }}
    >
      {label}
    </Link>
  );

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(1200px 600px at 20% -10%, rgba(88,28,135,0.45), transparent), radial-gradient(900px 500px at 90% 10%, rgba(37,99,235,0.35), transparent), #05050a',
        color: '#fff',
        fontFamily: 'Poppins, Montserrat, system-ui, sans-serif',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 24,
          padding: '20px 32px',
          maxWidth: 1200,
          margin: '0 auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <Link to="/" style={{ fontWeight: 800, fontSize: 22, color: '#fff', textDecoration: 'none' }}>
            Movr
          </Link>
          <nav style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            {navLink('/', 'Home')}
            {navLink('/', 'Staking', true)}
            {navLink('/governance', 'Governance')}
            {navLink('/docs', 'Docs')}
          </nav>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link
            to="/stake"
            style={{
              color: 'rgba(255,255,255,0.7)',
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 600,
              padding: '8px 12px',
            }}
          >
            DVT Token
          </Link>
          <Link
            to="/docs"
            style={{
              color: 'rgba(255,255,255,0.7)',
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 600,
              padding: '8px 12px',
            }}
          >
            Learn More
          </Link>
          <button
            type="button"
            onClick={connect}
            style={{
              background: 'linear-gradient(90deg, #7c3aed, #2563eb)',
              border: 'none',
              color: '#fff',
              borderRadius: 999,
              padding: '10px 18px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            {account ? `${account.slice(0, 6)}…${account.slice(-4)}` : 'Connect Wallet'}
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 32px 80px' }}>
        <section style={{ textAlign: 'center', marginBottom: 56 }}>
          <p
            style={{
              margin: 0,
              fontSize: 12,
              letterSpacing: 2.4,
              fontWeight: 700,
              color: '#a78bfa',
            }}
          >
            DVT STAKING PROTOCOL
          </p>
          <h1
            style={{
              margin: '16px 0 0',
              fontSize: 'clamp(2.2rem, 5vw, 3.4rem)',
              fontWeight: 800,
              lineHeight: 1.15,
              letterSpacing: '-0.02em',
            }}
          >
            Stake DVT. Earn Rewards.
            <br />
            Power Movr.
          </h1>
          <p
            style={{
              margin: '18px auto 0',
              maxWidth: 520,
              color: 'rgba(255,255,255,0.55)',
              fontSize: 16,
              lineHeight: 1.55,
            }}
          >
            Lock DVT to earn yield and unlock platform benefits across rides, deliveries, and merchant staking.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 28, flexWrap: 'wrap' }}>
            <Link
              to="/stake"
              style={{
                display: 'inline-block',
                padding: '14px 28px',
                borderRadius: 999,
                background: 'linear-gradient(90deg, #7c3aed, #2563eb)',
                color: '#fff',
                fontWeight: 700,
                textDecoration: 'none',
              }}
            >
              Start Staking
            </Link>
            <Link
              to="/docs"
              style={{
                display: 'inline-block',
                padding: '14px 28px',
                borderRadius: 999,
                border: '1px solid rgba(255,255,255,0.2)',
                color: '#fff',
                fontWeight: 600,
                textDecoration: 'none',
                background: 'rgba(255,255,255,0.04)',
              }}
            >
              View Docs
            </Link>
          </div>
        </section>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: 14,
            marginBottom: 64,
          }}
        >
          {[
            { label: 'Total Staked', value: `${fmt(Number(stats?.totalStaked || 0))} DVT` },
            {
              label: 'APY Highest',
              value: `${Number(stats?.highestApy || 0).toFixed(1)}%`,
              accent: true,
            },
            { label: 'Total Stakers', value: fmt(Number(stats?.participantCount || 0)) },
            { label: 'TVL', value: fmtUsd(Number(stats?.tvlUsd || 0)) },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16,
                padding: '20px 18px',
              }}
            >
              <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>
                {s.label}
              </p>
              <p
                style={{
                  margin: '10px 0 0',
                  fontSize: 22,
                  fontWeight: 800,
                  color: s.accent ? '#4ade80' : '#fff',
                }}
              >
                {s.value}
              </p>
            </div>
          ))}
        </section>

        <section>
          <h2 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 800 }}>Staking Pools</h2>
          <p style={{ margin: '0 0 24px', color: 'rgba(255,255,255,0.5)', fontSize: 15 }}>
            Choose a lock period that matches your strategy.
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 16,
            }}
          >
            {livePools.map((p) => {
              const popular = Boolean(p.is_popular);
              const title = p.display_name || p.name || 'Pool';
              const tagline = p.tagline || p.apy_or_benefit_desc || '';
              const apy = Number(p.base_apy_pct || 0);
              const min = Number(p.min_stake ?? p.min_amount ?? 100);
              const participants = Number(p.participants || 0);
              return (
                <div
                  key={String(p.id)}
                  style={{
                    position: 'relative',
                    background: popular
                      ? 'linear-gradient(160deg, rgba(124,58,237,0.35), rgba(37,99,235,0.25))'
                      : 'rgba(255,255,255,0.04)',
                    border: popular
                      ? '1px solid rgba(167,139,250,0.45)'
                      : '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 20,
                    padding: 24,
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 280,
                  }}
                >
                  {popular ? (
                    <span
                      style={{
                        position: 'absolute',
                        top: 16,
                        right: 16,
                        fontSize: 10,
                        fontWeight: 800,
                        letterSpacing: 1,
                        padding: '4px 8px',
                        borderRadius: 999,
                        background: 'linear-gradient(90deg, #7c3aed, #2563eb)',
                        color: '#fff',
                      }}
                    >
                      POPULAR
                    </span>
                  ) : null}
                  <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{title}</h3>
                  <p style={{ margin: '8px 0 0', color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>{tagline}</p>
                  <p style={{ margin: '28px 0 0' }}>
                    <span style={{ fontSize: 36, fontWeight: 800, color: '#4ade80' }}>
                      {apy.toFixed(1)}%
                    </span>
                    <span style={{ marginLeft: 8, color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>
                      APY
                    </span>
                  </p>
                  <div
                    style={{
                      marginTop: 16,
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 13,
                      color: 'rgba(255,255,255,0.45)',
                    }}
                  >
                    <span>Min {fmt(min)} DVT</span>
                    <span>{fmt(participants)} stakers</span>
                  </div>
                  <div style={{ flex: 1 }} />
                  <Link
                    to={`/stake?pool=${encodeURIComponent(String(p.id))}`}
                    style={{
                      display: 'block',
                      textAlign: 'center',
                      borderRadius: 999,
                      padding: '12px 16px',
                      background: popular
                        ? 'linear-gradient(90deg, #7c3aed, #2563eb)'
                        : 'rgba(255,255,255,0.08)',
                      border: popular ? 'none' : '1px solid rgba(255,255,255,0.15)',
                      color: '#fff',
                      fontWeight: 700,
                      textDecoration: 'none',
                    }}
                  >
                    Stake Now
                  </Link>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <style>{`
        @media (max-width: 900px) {
          main section:nth-of-type(2),
          main section:nth-of-type(3) > div {
            grid-template-columns: 1fr 1fr !important;
          }
        }
        @media (max-width: 640px) {
          header nav { display: none !important; }
          main section:nth-of-type(2),
          main section:nth-of-type(3) > div {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
