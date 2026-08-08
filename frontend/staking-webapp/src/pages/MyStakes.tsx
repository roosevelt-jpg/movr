import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

function shortWallet(w?: string | null) {
  if (!w) return '0x3a4f…9d2c';
  if (w.includes('…') || w.includes('...')) return w;
  if (w.length < 12) return w;
  return `${w.slice(0, 6)}…${w.slice(-4)}`;
}

function fmtDvt(n: number) {
  return `${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })} DVT`;
}

/** My Stakes dashboard — portfolio KPIs, active positions, claim bar. */
export default function MyStakes() {
  const [account, setAccount] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async (wallet?: string | null) => {
    try {
      const q = wallet ? `?wallet=${encodeURIComponent(wallet)}` : '';
      const res = await fetch(`${API}/public/staking/positions${q}`);
      const j = await res.json();
      setData(j.data);
      setError('');
    } catch (e: any) {
      setError(e.message || 'Failed to load stakes');
    }
  };

  useEffect(() => {
    load(account);
  }, [account]);

  const connect = async () => {
    const eth = (window as any).ethereum;
    if (!eth) {
      setAccount('0x3a4f9d2c00000000000000000000000000009d2c');
      return;
    }
    const accounts = await eth.request({ method: 'eth_requestAccounts' });
    setAccount(accounts[0]);
  };

  const claim = async (stakeId?: string) => {
    if (data?.demo) {
      setMessage(stakeId ? 'Demo claim recorded locally' : 'Demo claim-all recorded locally');
      if (stakeId) {
        setData((d: any) => ({
          ...d,
          stakes: d.stakes.map((s: any) =>
            s.id === stakeId ? { ...s, claimable: 0, earned: s.earned } : s
          ),
          totalClaimable: Math.max(
            0,
            Number(d.totalClaimable) - Number(d.stakes.find((s: any) => s.id === stakeId)?.claimable || 0)
          ),
        }));
      } else {
        setData((d: any) => ({
          ...d,
          totalClaimable: 0,
          stakes: d.stakes.map((s: any) => ({ ...s, claimable: 0 })),
        }));
      }
      return;
    }
    setBusy(stakeId || 'all');
    try {
      await fetch(`${API}/public/staking/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: account, stakeId }),
      });
      setMessage('Rewards claimed');
      await load(account);
    } catch (e: any) {
      setError(e.message || 'Claim failed');
    } finally {
      setBusy(null);
    }
  };

  const walletLabel = shortWallet(account || data?.wallet);
  const stakes = data?.stakes || [];
  const claimable = Number(data?.totalClaimable || 0);
  const price = Number(data?.dvtPriceUsd || 0.02);
  const claimUsd = useMemo(() => (claimable * price).toFixed(2), [claimable, price]);

  return (
    <div style={{ maxWidth: 980, margin: '0 auto' }}>
      <div style={styles.headerRow}>
        <div>
          <h1 style={styles.h1}>My Stakes</h1>
          <p style={styles.sub}>
            Connected: {walletLabel} · Polygon Network
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {!account ? (
            <button type="button" style={styles.secondaryBtn} onClick={connect}>
              Connect Wallet
            </button>
          ) : null}
          <Link to="/stake" style={styles.primaryBtn}>
            + Stake More DVT
          </Link>
        </div>
      </div>

      {error ? <p style={{ color: '#f87171' }}>{error}</p> : null}
      {message ? <p style={{ color: '#4ade80' }}>{message}</p> : null}

      <div style={styles.kpiRow}>
        {[
          { label: 'Total Staked', value: fmtDvt(data?.totalStaked || 0), color: '#fff' },
          { label: 'Total Earned', value: fmtDvt(data?.totalEarned || 0), color: '#4ade80' },
          { label: 'Portfolio Value', value: `$${Number(data?.portfolioValueUsd || 0).toFixed(2)}`, color: '#fff' },
          { label: 'Next Unlock', value: data?.nextUnlockLabel || '—', color: '#c4b5fd' },
        ].map((c) => (
          <div key={c.label} style={styles.kpi}>
            <div style={styles.label}>{c.label}</div>
            <div style={{ ...styles.kpiValue, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      <h2 style={styles.h2}>Active Stakes</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {stakes.length === 0 ? (
          <div style={styles.card}>
            <p style={styles.sub}>No active stakes yet.</p>
            <Link to="/stake" style={{ ...styles.primaryBtn, display: 'inline-block', marginTop: 12 }}>
              Stake DVT
            </Link>
          </div>
        ) : (
          stakes.map((s: any) => (
            <div key={s.id} style={styles.stakeCard}>
              <div style={styles.stakeHead}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>{s.poolName}</div>
                  <div style={styles.sub}>
                    Since{' '}
                    {s.stakedAt
                      ? new Date(s.stakedAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : '—'}
                  </div>
                </div>
                <div style={{ color: Number(s.lock_period_days || s.daysLeft) ? '#c4b5fd' : '#60a5fa', fontWeight: 700 }}>
                  {Number(s.apy || 0)}% APY
                </div>
              </div>
              <div style={styles.stakeGrid}>
                <div>
                  <div style={styles.kpiValue}>{fmtDvt(s.amount)}</div>
                  <div style={styles.label}>Staked</div>
                </div>
                <div>
                  <div style={{ ...styles.kpiValue, color: '#4ade80' }}>{fmtDvt(s.earned)}</div>
                  <div style={styles.label}>Earned</div>
                </div>
                <div>
                  <div style={{ ...styles.kpiValue, color: '#c4b5fd' }}>{s.unlockLabel}</div>
                  <div style={styles.label}>Unlock</div>
                </div>
              </div>
              <div style={styles.actions}>
                <button
                  type="button"
                  style={{ ...styles.claimBtn, flex: 1.4 }}
                  disabled={busy === s.id || Number(s.claimable || 0) <= 0}
                  onClick={() => claim(s.id)}
                >
                  {busy === s.id ? 'Claiming…' : 'Claim Rewards'}
                </button>
                <Link to="/stake" style={{ ...styles.unstakeBtn, flex: 1, textAlign: 'center' }}>
                  Unstake
                </Link>
              </div>
            </div>
          ))
        )}
      </div>

      <div style={styles.claimBar}>
        <div>
          <div style={{ fontWeight: 600 }}>Total Claimable Rewards</div>
          <div style={styles.sub}>
            {fmtDvt(claimable)} — ~${claimUsd}
          </div>
        </div>
        <button
          type="button"
          style={styles.claimAll}
          disabled={busy === 'all' || claimable <= 0}
          onClick={() => claim()}
        >
          {busy === 'all' ? 'Claiming…' : `Claim All ${fmtDvt(claimable)}`}
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  headerRow: { display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 24 },
  h1: { margin: 0, fontSize: 36, fontWeight: 800 },
  h2: { margin: '8px 0 14px', fontSize: 20, fontWeight: 700 },
  sub: { margin: '6px 0 0', color: '#888', fontSize: 14 },
  label: { color: '#888', fontSize: 12, marginTop: 4 },
  primaryBtn: {
    background: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    padding: '12px 18px',
    fontWeight: 700,
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
  },
  secondaryBtn: {
    background: 'transparent',
    color: '#fff',
    border: '1px solid #333',
    borderRadius: 12,
    padding: '12px 18px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  kpiRow: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12, marginBottom: 28 },
  kpi: { background: '#141414', borderRadius: 16, padding: 18, border: '1px solid #222' },
  kpiValue: { fontSize: 26, fontWeight: 800, marginTop: 8 },
  card: { background: '#141414', borderRadius: 16, padding: 20, border: '1px solid #222' },
  stakeCard: {
    background: '#141414',
    borderRadius: 16,
    padding: 20,
    border: '1px solid rgba(142,45,226,0.45)',
  },
  stakeHead: { display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 18 },
  stakeGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 18 },
  actions: { display: 'flex', gap: 10 },
  claimBtn: {
    background: 'linear-gradient(90deg, #3b82f6, #6366f1)',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    padding: '12px 16px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  unstakeBtn: {
    background: '#1f1f1f',
    color: '#fff',
    border: '1px solid #333',
    borderRadius: 12,
    padding: '12px 16px',
    fontWeight: 700,
    textDecoration: 'none',
  },
  claimBar: {
    marginTop: 28,
    background: '#141414',
    border: '1px solid #222',
    borderRadius: 16,
    padding: 18,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap',
  },
  claimAll: {
    background: 'linear-gradient(90deg, #8E2DE2, #4A00E0)',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    padding: '14px 20px',
    fontWeight: 800,
    cursor: 'pointer',
  },
};
