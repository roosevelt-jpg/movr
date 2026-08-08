import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import AdminShell from '../layouts/AdminShell';
import { adminBtn } from '../styles/adminButtons';
import { formatCurrency } from '../lib/currency';

const API = process.env.REACT_APP_API_URL || '/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}` });

type Activity = { date: string; service: string; amount: number; status: string };

type CustomerProfile = {
  id: string;
  ref: string;
  name: string;
  initials: string;
  city: string;
  phone: string;
  email: string;
  tier: string;
  active: boolean;
  lastActive: string;
  metrics: { rides: number; points: number; spend: number; dvt: number };
  wallet: { fiat: number; dvt: number; referrals: number };
  usage: { rides: number; orders: number; parcels: number; rentals: number };
  rewardProgress: {
    points: number;
    currentTier: string;
    nextTier: string;
    pointsToNext: number;
    progressPct: number;
    platinumAt: number;
  };
  activity: Activity[];
  activityTotal: number;
};

function tierStyle(tier: string): React.CSSProperties {
  const t = tier.toLowerCase();
  if (t === 'platinum') return { background: 'rgba(168,85,247,0.25)', color: '#e9d5ff' };
  if (t === 'gold') return { background: 'rgba(234,179,8,0.25)', color: '#facc15' };
  if (t === 'silver') return { background: 'rgba(148,163,184,0.3)', color: '#e2e8f0' };
  return { background: 'rgba(180,83,9,0.25)', color: '#fdba74' };
}

function formatDate(d: string) {
  try {
    return new Date(d).toLocaleString();
  } catch {
    return d || '—';
  }
}

/** Customer detail — wallet, usage, rewards, activity. */
export default function CustomerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/customers/${id}`, { headers: headers() });
      setData(res.data?.data || null);
      setError('');
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Failed to load customer');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const sendMessage = async () => {
    if (!id) return;
    const body = window.prompt('Message to customer:');
    if (!body?.trim()) return;
    setBusy(true);
    try {
      await axios.post(`${API}/admin/customers/${id}/message`, { body: body.trim() }, { headers: headers() });
      setError('');
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Message failed');
    } finally {
      setBusy(false);
    }
  };

  const blockCustomer = async () => {
    if (!id) return;
    if (!window.confirm('Block this customer?')) return;
    setBusy(true);
    try {
      await axios.post(`${API}/admin/customers/${id}/block`, {}, { headers: headers() });
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Block failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <AdminShell activeLabel="Customers" hidePageTitle>
        <p style={styles.muted}>Loading customer…</p>
      </AdminShell>
    );
  }

  if (!data) {
    return (
      <AdminShell activeLabel="Customers" hidePageTitle>
        <p style={styles.error}>{error || 'Customer not found'}</p>
        <Link to="/customers" style={styles.viewLink}>
          ← Back to customers
        </Link>
      </AdminShell>
    );
  }

  const usage = data.usage || { rides: 0, orders: 0, parcels: 0, rentals: 0 };
  const usageMax = Math.max(usage.rides, usage.orders, usage.parcels, usage.rentals, 1);
  const usageBars = [
    { label: 'Rides', value: usage.rides },
    { label: 'Orders', value: usage.orders },
    { label: 'Parcels', value: usage.parcels },
    { label: 'Rentals', value: usage.rentals },
  ];
  const progress = data.rewardProgress;
  const tierLabel = `${(data.tier || 'bronze').replace(/^./, (c) => c.toUpperCase())} Tier`;

  return (
    <AdminShell activeLabel="Customers" hidePageTitle>
      <div style={styles.headerRow}>
        <div>
          <p style={styles.crumb}>
            <Link to="/customers" style={styles.crumbLink}>
              Customers
            </Link>{' '}
            / Profile
          </p>
          <h1 style={styles.h1}>
            Customer Profile · {data.name} · {data.ref}
          </h1>
        </div>
        <div style={styles.actions} className="admin-actions">
          <button type="button" style={styles.secondaryBtn} onClick={sendMessage} disabled={busy}>
            Message
          </button>
          <button type="button" style={styles.dangerBtn} onClick={blockCustomer} disabled={busy || !data.active}>
            {data.active ? 'Block Customer' : 'Blocked'}
          </button>
        </div>
      </div>

      {error ? <p style={styles.error}>{error}</p> : null}

      <div style={styles.layout} data-admin-grid="profile" className="admin-split-grid">
        <div style={styles.leftCol}>
          <div style={styles.card}>
            <div style={styles.avatarLg}>{data.initials || 'C'}</div>
            <h2 style={styles.name}>{data.name}</h2>
            <p style={styles.city}>{data.city}</p>
            <div style={styles.badgeRow}>
              <span style={{ ...styles.badge, ...tierStyle(data.tier) }}>{tierLabel}</span>
              <span style={{ ...styles.badge, ...(data.active ? styles.badgeGreen : styles.badgeMuted) }}>
                {data.active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div style={styles.metricRow}>
              <div style={styles.metric}>
                <div style={styles.metricVal}>{data.metrics?.rides ?? 0}</div>
                <div style={styles.metricLabel}>Rides</div>
              </div>
              <div style={styles.metric}>
                <div style={{ ...styles.metricVal, color: '#c4b5fd' }}>
                  {Number(data.metrics?.points || 0).toLocaleString()}
                </div>
                <div style={styles.metricLabel}>Points</div>
              </div>
              <div style={styles.metric}>
                <div style={styles.metricVal}>{formatCurrency(data.metrics?.spend || 0)}</div>
                <div style={styles.metricLabel}>Spend</div>
              </div>
              <div style={styles.metric}>
                <div style={{ ...styles.metricVal, color: '#c4b5fd' }}>
                  {Number(data.metrics?.dvt || 0).toLocaleString()}
                </div>
                <div style={styles.metricLabel}>DVT</div>
              </div>
            </div>
          </div>

          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>Contact</h3>
            <dl style={styles.dl}>
              <div style={styles.dlRow}>
                <dt style={styles.dt}>Phone</dt>
                <dd style={styles.dd}>{data.phone}</dd>
              </div>
              <div style={styles.dlRow}>
                <dt style={styles.dt}>Email</dt>
                <dd style={styles.dd}>{data.email || '—'}</dd>
              </div>
              <div style={styles.dlRow}>
                <dt style={styles.dt}>Last active</dt>
                <dd style={styles.dd}>{data.lastActive}</dd>
              </div>
            </dl>
          </div>

          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>Wallet</h3>
            <dl style={styles.dl}>
              <div style={styles.dlRow}>
                <dt style={styles.dt}>Fiat balance</dt>
                <dd style={styles.dd}>{formatCurrency(data.wallet?.fiat || 0)}</dd>
              </div>
              <div style={styles.dlRow}>
                <dt style={styles.dt}>DVT</dt>
                <dd style={{ ...styles.dd, color: '#c4b5fd' }}>
                  {Number(data.wallet?.dvt || 0).toLocaleString()}
                </dd>
              </div>
              <div style={styles.dlRow}>
                <dt style={styles.dt}>Referrals</dt>
                <dd style={styles.dd}>{data.wallet?.referrals ?? 0}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div style={styles.rightCol}>
          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>Service usage</h3>
            {usageBars.map((b) => (
              <div key={b.label} style={styles.barRow}>
                <span style={styles.barLabel}>{b.label}</span>
                <div style={styles.barTrack}>
                  <div
                    style={{
                      ...styles.barFill,
                      width: `${Math.round((b.value / usageMax) * 100)}%`,
                    }}
                  />
                </div>
                <span style={styles.barPct}>{b.value}</span>
              </div>
            ))}
          </div>

          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>Reward progress</h3>
            <p style={styles.progressCopy}>
              {Number(progress?.points || 0).toLocaleString()} pts · {progress?.pointsToNext ?? 0} to{' '}
              {(progress?.nextTier || 'platinum').replace(/^./, (c) => c.toUpperCase())} (Platinum at{' '}
              {progress?.platinumAt ?? 1000})
            </p>
            <div style={styles.barTrack}>
              <div
                style={{
                  ...styles.barFill,
                  width: `${Math.min(100, progress?.progressPct || 0)}%`,
                }}
              />
            </div>
            <p style={{ ...styles.metricLabel, marginTop: 8 }}>{progress?.progressPct ?? 0}% toward next tier</p>
          </div>

          <div style={styles.tableWrap}>
            <h3 style={{ ...styles.sectionTitle, padding: '16px 14px 0' }}>
              Activity history
              <span style={{ ...styles.metricLabel, marginLeft: 8, fontWeight: 500 }}>
                ({data.activityTotal ?? data.activity?.length ?? 0} total)
              </span>
            </h3>
            <div className="admin-table-scroll">
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Service</th>
                  <th style={styles.th}>Amount</th>
                  <th style={styles.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {(data.activity || []).length === 0 ? (
                  <tr>
                    <td colSpan={4} style={styles.tdMuted}>
                      No activity yet
                    </td>
                  </tr>
                ) : (
                  data.activity.map((a, i) => (
                    <tr key={`${a.date}-${i}`}>
                      <td style={styles.td}>{formatDate(a.date)}</td>
                      <td style={styles.td}>{a.service}</td>
                      <td style={styles.td}>{formatCurrency(a.amount)}</td>
                      <td style={styles.td}>{a.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
          </div>
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
  crumb: { margin: '0 0 6px', color: 'var(--text-secondary)', fontSize: 13 },
  crumbLink: { color: 'var(--motion-blue)', textDecoration: 'none', fontWeight: 600 },
  h1: { fontSize: 24, fontWeight: 700, margin: 0 },
  muted: { color: 'var(--text-secondary)' },
  error: { color: 'var(--error)', marginBottom: 12 },
  actions: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  secondaryBtn: { ...adminBtn.secondary },
  dangerBtn: { ...adminBtn.dangerSoft },
  layout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(260px, 320px) 1fr',
    gap: 16,
    alignItems: 'start',
  },
  leftCol: { display: 'flex', flexDirection: 'column', gap: 12 },
  rightCol: { display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 },
  card: {
    background: 'var(--surface-elevated)',
    borderRadius: 14,
    padding: 16,
    border: '1px solid var(--border)',
  },
  avatarLg: {
    width: 72,
    height: 72,
    borderRadius: '50%',
    display: 'grid',
    placeItems: 'center',
    fontSize: 22,
    fontWeight: 700,
    background: 'var(--movr-gradient)',
    color: 'var(--brand-white)',
    margin: '0 auto 12px',
  },
  name: { margin: 0, textAlign: 'center', fontSize: 18, fontWeight: 700 },
  city: { margin: '6px 0 12px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 },
  badgeRow: { display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 14 },
  badge: {
    display: 'inline-block',
    padding: '3px 8px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'capitalize',
  },
  badgeGreen: { background: 'rgba(34,197,94,0.2)', color: '#4ade80' },
  badgeMuted: { background: 'rgba(148,163,184,0.2)', color: '#94a3b8' },
  metricRow: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, textAlign: 'center' },
  metric: {},
  metricVal: { fontSize: 16, fontWeight: 700 },
  metricLabel: { color: 'var(--text-secondary)', fontSize: 12, marginTop: 2 },
  sectionTitle: { margin: '0 0 12px', fontSize: 14, fontWeight: 700 },
  progressCopy: { margin: '0 0 10px', fontSize: 13, color: 'var(--text-secondary)' },
  barRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  barLabel: { width: 64, fontSize: 12, color: 'var(--text-secondary)' },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    background: 'var(--surface)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
    background: 'var(--movr-gradient)',
  },
  barPct: { width: 36, textAlign: 'right', fontSize: 12, color: 'var(--text-secondary)' },
  dl: { margin: 0 },
  dlRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    padding: '8px 0',
    borderBottom: '1px solid var(--border)',
  },
  dt: { margin: 0, color: 'var(--text-secondary)', fontSize: 13 },
  dd: { margin: 0, fontSize: 13, fontWeight: 600, textAlign: 'right' },
  tableWrap: {
    background: 'var(--surface-elevated)',
    borderRadius: 14,
    border: '1px solid var(--border)',
    overflow: 'auto',
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left',
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontWeight: 600,
    padding: '12px 14px',
    borderBottom: '1px solid var(--border)',
  },
  td: {
    padding: '12px 14px',
    borderBottom: '1px solid var(--border)',
    fontSize: 13,
  },
  tdMuted: {
    padding: '24px 14px',
    color: 'var(--text-secondary)',
    textAlign: 'center',
  },
  viewLink: { color: 'var(--motion-blue)', fontWeight: 600, textDecoration: 'none' },
};
