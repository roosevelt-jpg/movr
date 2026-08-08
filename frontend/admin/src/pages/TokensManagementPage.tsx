import React, { useEffect, useState } from 'react';
import axios from 'axios';
import AdminShell from '../layouts/AdminShell';
import { adminBtn } from '../styles/adminButtons';

const API = process.env.REACT_APP_API_URL || '/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}` });

function formatCompactToken(n: number) {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function truncateWallet(w: string) {
  if (!w || w === '—') return '—';
  if (w.length <= 12) return w;
  return `${w.slice(0, 6)}…${w.slice(-4)}`;
}

function claimStatusStyle(status: string): React.CSSProperties {
  const s = status.toLowerCase();
  if (s === 'completed') return { background: 'rgba(34,197,94,0.2)', color: '#4ade80' };
  if (s === 'failed') return { background: 'rgba(239,68,68,0.2)', color: '#f87171' };
  return { background: 'rgba(234,179,8,0.2)', color: '#facc15' };
}

type Dist = { label: string; pct: number; color?: string; category?: string };
type Pool = { id: string; name: string; apy: number; totalStaked: number; lockDays?: number };
type Claim = {
  id: string;
  user: string;
  wallet: string;
  amount: number;
  source: string;
  network: string;
  txHash: string;
  status: string;
};

/** DVT token management — supply, staking, claims. */
export default function TokensManagementPage() {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [metrics, setMetrics] = useState({
    totalIssued: 0,
    tokensClaimed: 0,
    stakedActive: 0,
    pendingClaims: 0,
    issuedDelta: 0,
    claimedDelta: 0,
    stakedDelta: 0,
  });
  const [distribution, setDistribution] = useState<Dist[]>([]);
  const [pools, setPools] = useState<Pool[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);

  const load = async () => {
    try {
      const res = await axios.get(`${API}/admin/tokens/dashboard`, { headers: headers() });
      const d = res.data?.data || {};
      setMetrics({
        totalIssued: Number(d.totalIssued || 0),
        tokensClaimed: Number(d.tokensClaimed || 0),
        stakedActive: Number(d.stakedActive || 0),
        pendingClaims: Number(d.pendingClaims || 0),
        issuedDelta: Number(d.issuedDelta || 0),
        claimedDelta: Number(d.claimedDelta || 0),
        stakedDelta: Number(d.stakedDelta || 0),
      });
      setDistribution(d.distribution || []);
      setPools(d.pools || []);
      setClaims(d.recentClaims || []);
      setError('');
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Failed to load token dashboard');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const exportClaims = async () => {
    try {
      const res = await axios.get(`${API}/admin/tokens/claims/export`, {
        headers: headers(),
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'dvt-claims.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Export failed');
    }
  };

  const generateMerkle = async () => {
    setGenerating(true);
    try {
      const res = await axios.post(`${API}/admin/tokens/merkle-root`, {}, { headers: headers() });
      const root = res.data?.data?.merkleRoot || '';
      window.alert(`Merkle root generated:\n${root}`);
      setMessage(`Merkle root: ${root}`);
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Merkle generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const delta = (n?: number) =>
    n ? `${n >= 0 ? '+' : ''}${Number(n).toFixed(1)}%` : '';

  const cards = [
    { label: 'Total DVT Issued', value: formatCompactToken(metrics.totalIssued), meta: delta(metrics.issuedDelta) },
    { label: 'Tokens Claimed', value: formatCompactToken(metrics.tokensClaimed), meta: delta(metrics.claimedDelta) },
    { label: 'Staked (Active)', value: formatCompactToken(metrics.stakedActive), meta: delta(metrics.stakedDelta) },
    { label: 'Pending Claims', value: formatCompactToken(metrics.pendingClaims), meta: '' },
  ];

  return (
    <AdminShell activeLabel="DVT Overview" hidePageTitle>
      <div style={styles.headerRow}>
        <div>
          <h1 style={styles.h1}>DVT Token Management</h1>
          <p style={styles.sub}>DriveToken - Polygon Network</p>
        </div>
        <div style={styles.actions} className="admin-actions">
          <button type="button" style={styles.secondaryBtn} onClick={exportClaims}>
            Export Claims
          </button>
          <button type="button" style={styles.primaryBtn} onClick={generateMerkle} disabled={generating}>
            {generating ? 'Generating…' : 'Generate Merkle Root'}
          </button>
        </div>
      </div>

      {error ? <p style={styles.error}>{error}</p> : null}
      {message ? <p style={styles.message}>{message}</p> : null}

      <div style={styles.cards} className="admin-kpi-grid" data-admin-grid="kpi">
        {cards.map((c) => (
          <div key={c.label} style={styles.card}>
            <div style={styles.label}>{c.label}</div>
            <div style={styles.value}>{c.value}</div>
            {c.meta ? <div style={styles.meta}>{c.meta}</div> : null}
          </div>
        ))}
      </div>

      <div style={styles.midRow} className="admin-split-grid" data-admin-grid="split">
        <div style={styles.panel}>
          <div style={styles.panelHead}>
            <h2 style={styles.panelTitle}>Token Distribution</h2>
            <span style={styles.note}>1B DVT Total Supply</span>
          </div>
          <div style={styles.distList}>
            {distribution.length === 0 ? (
              <p style={styles.empty}>No distribution data</p>
            ) : (
              distribution.map((d) => (
                <div key={d.label || d.category} style={styles.distRow}>
                  <div style={styles.distHead}>
                    <span>{d.label || d.category}</span>
                    <strong>{Number(d.pct || 0)}%</strong>
                  </div>
                  <div style={styles.progressTrack}>
                    <div
                      style={{
                        ...styles.progressFill,
                        width: `${Math.min(100, Number(d.pct || 0))}%`,
                        background: d.color || 'var(--movr-gradient)',
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={styles.panel}>
          <h2 style={styles.panelTitle}>Staking Pools</h2>
          <div style={styles.poolList}>
            {pools.length === 0 ? (
              <p style={styles.empty}>No pools</p>
            ) : (
              pools.map((p) => (
                <div key={p.id} style={styles.poolRow}>
                  <div>
                    <div style={styles.poolName}>{p.name}</div>
                    <div style={styles.poolMeta}>{formatCompactToken(p.totalStaked)} DVT staked</div>
                  </div>
                  <div style={styles.apy}>{Number(p.apy || 0).toFixed(1)}% APY</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div style={styles.panel}>
        <h2 style={styles.panelTitle}>Recent Claims</h2>
        <div className="admin-table-scroll">
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>User</th>
              <th style={styles.th}>Wallet</th>
              <th style={styles.th}>Amount DVT</th>
              <th style={styles.th}>Source</th>
              <th style={styles.th}>Network</th>
              <th style={styles.th}>TX Hash</th>
              <th style={styles.th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {claims.length === 0 ? (
              <tr>
                <td colSpan={7} style={styles.tdMuted}>
                  No recent claims
                </td>
              </tr>
            ) : (
              claims.map((c) => (
                <tr key={c.id}>
                  <td style={styles.td}>{c.user}</td>
                  <td style={styles.td} title={c.wallet}>
                    {truncateWallet(c.wallet)}
                  </td>
                  <td style={styles.td}>{formatCompactToken(c.amount)}</td>
                  <td style={styles.td}>{c.source}</td>
                  <td style={styles.td}>{c.network}</td>
                  <td style={styles.td} title={c.txHash}>
                    {truncateWallet(c.txHash)}
                  </td>
                  <td style={styles.td}>
                    <span style={{ ...styles.badge, ...claimStatusStyle(c.status) }}>{c.status}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>
    </AdminShell>
  );
}

const styles: Record<string, React.CSSProperties> = {
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  h1: { fontSize: 28, fontWeight: 700, margin: 0 },
  sub: { color: 'var(--text-secondary)', marginTop: 6, marginBottom: 0 },
  error: { color: 'var(--error)', marginBottom: 12 },
  message: { color: 'var(--success)', marginBottom: 12, wordBreak: 'break-all' },
  actions: { display: 'flex', gap: 10 },
  primaryBtn: { ...adminBtn.primary },
  secondaryBtn: { ...adminBtn.secondary },
  cards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 12,
    marginBottom: 16,
  },
  card: {
    background: 'var(--surface-elevated)',
    borderRadius: 14,
    padding: 16,
    border: '1px solid var(--border)',
  },
  label: { color: 'var(--text-secondary)', fontSize: 13 },
  value: { fontSize: 26, fontWeight: 700, marginTop: 8 },
  meta: { color: 'var(--success)', fontSize: 12, marginTop: 6, fontWeight: 600 },
  midRow: {
    display: 'grid',
    gridTemplateColumns: '1.2fr 1fr',
    gap: 12,
    marginBottom: 16,
  },
  panel: {
    background: 'var(--surface-elevated)',
    borderRadius: 14,
    padding: 16,
    border: '1px solid var(--border)',
    marginBottom: 16,
  },
  panelHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  panelTitle: { fontSize: 16, margin: '0 0 12px', fontWeight: 700 },
  note: { color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 },
  empty: { color: 'var(--text-secondary)', margin: 0 },
  distList: { display: 'flex', flexDirection: 'column', gap: 12 },
  distRow: { display: 'flex', flexDirection: 'column', gap: 6 },
  distHead: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 13,
    color: 'var(--text-secondary)',
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    background: 'var(--surface)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  poolList: { display: 'flex', flexDirection: 'column', gap: 10 },
  poolRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 14px',
    borderRadius: 12,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
  },
  poolName: { fontWeight: 700, fontSize: 14 },
  poolMeta: { color: 'var(--text-secondary)', fontSize: 12, marginTop: 4 },
  apy: { color: '#c4b5fd', fontWeight: 700, fontSize: 14 },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left',
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontWeight: 600,
    padding: '10px 8px',
    borderBottom: '1px solid var(--border)',
  },
  td: {
    padding: '12px 8px',
    borderBottom: '1px solid var(--border)',
    fontSize: 13,
  },
  tdMuted: {
    padding: '20px 8px',
    color: 'var(--text-secondary)',
    textAlign: 'center',
  },
  badge: {
    display: 'inline-block',
    padding: '3px 8px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'capitalize',
  },
};
