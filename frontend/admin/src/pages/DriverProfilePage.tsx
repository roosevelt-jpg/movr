import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import axios from 'axios';
import AdminShell from '../layouts/AdminShell';
import { adminBtn } from '../styles/adminButtons';
import { formatCurrency } from '../lib/currency';

const API = process.env.REACT_APP_API_URL || '/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}` });

type RatingBar = { stars: number; pct: number };
type Trip = {
  id: string;
  rideId: string;
  from: string;
  to: string;
  fare: number;
  dvt: number;
  date: string;
  status: string;
};

type DriverProfile = {
  id: string;
  ref: string;
  name: string;
  initials: string;
  city: string;
  phone: string;
  online: boolean;
  suspended: boolean;
  subscription: string;
  tier: string;
  trips: number;
  rating: number;
  acceptanceRate: number;
  ratingBreakdown: RatingBar[];
  performance: {
    onTimePickups: number;
    cancellations: number;
    complaints: number;
    compliments: number;
  };
  vehicle: string;
  plate: string;
  licenseVerified: boolean;
  ninVerified: boolean;
  earnings: {
    rideRevenue: number;
    dvt: number;
    subscriptionPaid: number;
    subscriptionStatus?: string;
  };
  recentTrips: Trip[];
};

/** Driver detail — profile, ratings, earnings, trips. */
export default function DriverProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<DriverProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/drivers/${id}`, { headers: headers() });
      setData(res.data?.data || null);
      setError('');
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Failed to load driver');
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
    const body = window.prompt('Message to driver:');
    if (!body?.trim()) return;
    setBusy(true);
    try {
      await axios.post(`${API}/admin/drivers/${id}/message`, { body: body.trim() }, { headers: headers() });
      setError('');
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Message failed');
    } finally {
      setBusy(false);
    }
  };

  const suspend = async () => {
    if (!id) return;
    if (!window.confirm('Suspend this driver?')) return;
    setBusy(true);
    try {
      await axios.post(`${API}/admin/drivers/${id}/suspend`, {}, { headers: headers() });
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Suspend failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <AdminShell activeLabel="Drivers" hidePageTitle>
        <p style={styles.muted}>Loading driver…</p>
      </AdminShell>
    );
  }

  if (!data) {
    return (
      <AdminShell activeLabel="Drivers" hidePageTitle>
        <p style={styles.error}>{error || 'Driver not found'}</p>
        <Link to="/drivers" style={styles.viewLink}>
          ← Back to drivers
        </Link>
      </AdminShell>
    );
  }

  const breakdown = data.ratingBreakdown?.length
    ? data.ratingBreakdown
    : [5, 4, 3, 2, 1].map((stars) => ({ stars, pct: 0 }));

  return (
    <AdminShell activeLabel="Drivers" hidePageTitle>
      <div style={styles.headerRow}>
        <div>
          <p style={styles.crumb}>
            <Link to="/drivers" style={styles.crumbLink}>
              Drivers
            </Link>{' '}
            / Profile
          </p>
          <h1 style={styles.h1}>
            Driver Profile · {data.name} · {data.ref}
          </h1>
        </div>
        <div style={styles.actions} className="admin-actions">
          <button type="button" style={styles.secondaryBtn} onClick={sendMessage} disabled={busy}>
            Message
          </button>
          <button type="button" style={styles.dangerBtn} onClick={suspend} disabled={busy || data.suspended}>
            {data.suspended ? 'Suspended' : 'Suspend Driver'}
          </button>
        </div>
      </div>

      {error ? <p style={styles.error}>{error}</p> : null}

      <div style={styles.layout} data-admin-grid="profile" className="admin-split-grid">
        <div style={styles.leftCol}>
          <div style={styles.card}>
            <div style={styles.avatarLg}>{data.initials || 'D'}</div>
            <h2 style={styles.name}>{data.name}</h2>
            <p style={styles.city}>{data.city}</p>
            <div style={styles.badgeRow}>
              <span style={{ ...styles.badge, ...(data.online ? styles.badgeGreen : styles.badgeMuted) }}>
                {data.online ? 'Online' : 'Offline'}
              </span>
              <span style={{ ...styles.badge, ...styles.badgePurple }}>{data.subscription || '—'}</span>
              <span style={{ ...styles.badge, ...styles.badgeGold }}>{data.tier || 'Gold'}</span>
            </div>
            <div style={styles.metricRow}>
              <div style={styles.metric}>
                <div style={styles.metricVal}>{data.trips}</div>
                <div style={styles.metricLabel}>Trips</div>
              </div>
              <div style={styles.metric}>
                <div style={styles.metricVal}>{Number(data.rating || 0).toFixed(1)}</div>
                <div style={styles.metricLabel}>Rating</div>
              </div>
              <div style={styles.metric}>
                <div style={styles.metricVal}>{Number(data.acceptanceRate || 0).toFixed(0)}%</div>
                <div style={styles.metricLabel}>Acceptance</div>
              </div>
            </div>
          </div>

          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>Rating breakdown</h3>
            {breakdown.map((b) => (
              <div key={b.stars} style={styles.barRow}>
                <span style={styles.barLabel}>{b.stars}★</span>
                <div style={styles.barTrack}>
                  <div style={{ ...styles.barFill, width: `${Math.min(100, b.pct)}%` }} />
                </div>
                <span style={styles.barPct}>{b.pct}%</span>
              </div>
            ))}
          </div>

          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>Performance</h3>
            <div style={styles.perfGrid}>
              <div style={styles.perfItem}>
                <span style={styles.metricLabel}>On-time pickups</span>
                <span style={styles.metricVal}>{Number(data.performance?.onTimePickups || 0).toFixed(0)}%</span>
              </div>
              <div style={styles.perfItem}>
                <span style={styles.metricLabel}>Cancellations</span>
                <span style={{ ...styles.metricVal, color: '#f87171' }}>
                  {Number(data.performance?.cancellations || 0).toFixed(1)}%
                </span>
              </div>
              <div style={styles.perfItem}>
                <span style={styles.metricLabel}>Complaints</span>
                <span style={styles.metricVal}>{data.performance?.complaints ?? 0}</span>
              </div>
              <div style={styles.perfItem}>
                <span style={styles.metricLabel}>Compliments</span>
                <span style={{ ...styles.metricVal, color: '#4ade80' }}>
                  {data.performance?.compliments ?? 0}
                </span>
              </div>
            </div>
          </div>

          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>Info</h3>
            <dl style={styles.dl}>
              <div style={styles.dlRow}>
                <dt style={styles.dt}>Phone</dt>
                <dd style={styles.dd}>{data.phone}</dd>
              </div>
              <div style={styles.dlRow}>
                <dt style={styles.dt}>Vehicle</dt>
                <dd style={styles.dd}>{data.vehicle}</dd>
              </div>
              <div style={styles.dlRow}>
                <dt style={styles.dt}>Plate</dt>
                <dd style={styles.dd}>{data.plate}</dd>
              </div>
              <div style={styles.dlRow}>
                <dt style={styles.dt}>License</dt>
                <dd style={styles.dd}>{data.licenseVerified ? 'Verified' : 'Unverified'}</dd>
              </div>
              <div style={styles.dlRow}>
                <dt style={styles.dt}>NIN</dt>
                <dd style={styles.dd}>{data.ninVerified ? 'Verified' : 'Unverified'}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div style={styles.rightCol}>
          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>Earnings this month</h3>
            <div style={styles.earnGrid}>
              <div>
                <div style={styles.metricLabel}>Ride revenue</div>
                <div style={styles.metricVal}>{formatCurrency(data.earnings?.rideRevenue || 0)}</div>
              </div>
              <div>
                <div style={styles.metricLabel}>DVT</div>
                <div style={{ ...styles.metricVal, color: '#c4b5fd' }}>
                  {Number(data.earnings?.dvt || 0).toLocaleString()}
                </div>
              </div>
              <div>
                <div style={styles.metricLabel}>Subscription paid</div>
                <div style={styles.metricVal}>{formatCurrency(data.earnings?.subscriptionPaid || 0)}</div>
              </div>
            </div>
          </div>

          <div style={styles.tableWrap}>
            <h3 style={{ ...styles.sectionTitle, padding: '16px 14px 0' }}>Recent trips</h3>
            <div className="admin-table-scroll">
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Ride</th>
                  <th style={styles.th}>From</th>
                  <th style={styles.th}>To</th>
                  <th style={styles.th}>Fare</th>
                  <th style={styles.th}>DVT</th>
                  <th style={styles.th}>When</th>
                  <th style={styles.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {(data.recentTrips || []).length === 0 ? (
                  <tr>
                    <td colSpan={7} style={styles.tdMuted}>
                      No recent trips
                    </td>
                  </tr>
                ) : (
                  data.recentTrips.map((t) => (
                    <tr key={t.id}>
                      <td style={styles.td}>
                        <Link to={`/rides/${t.id}`} style={styles.viewLink}>
                          {t.rideId}
                        </Link>
                      </td>
                      <td style={styles.td}>{t.from}</td>
                      <td style={styles.td}>{t.to}</td>
                      <td style={styles.td}>{formatCurrency(t.fare)}</td>
                      <td style={styles.td}>{t.dvt}</td>
                      <td style={styles.td}>{t.date}</td>
                      <td style={styles.td}>{t.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
          </div>

          <div style={styles.footerActions}>
            <button type="button" style={styles.dangerBtn} onClick={suspend} disabled={busy || data.suspended}>
              Suspend
            </button>
            <button type="button" style={styles.secondaryBtn} onClick={sendMessage} disabled={busy}>
              Message
            </button>
            <Link to="/live-map" style={styles.primaryLink}>
              View Live Location
            </Link>
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
  primaryBtn: { ...adminBtn.primary },
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
  },
  badgeGreen: { background: 'rgba(34,197,94,0.2)', color: '#4ade80' },
  badgeMuted: { background: 'rgba(148,163,184,0.2)', color: '#94a3b8' },
  badgePurple: { background: 'rgba(142,45,226,0.25)', color: '#c4b5fd' },
  badgeGold: { background: 'rgba(234,179,8,0.25)', color: '#facc15' },
  metricRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, textAlign: 'center' },
  metric: {},
  metricVal: { fontSize: 18, fontWeight: 700 },
  metricLabel: { color: 'var(--text-secondary)', fontSize: 12, marginTop: 2 },
  sectionTitle: { margin: '0 0 12px', fontSize: 14, fontWeight: 700 },
  barRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  barLabel: { width: 28, fontSize: 12, color: 'var(--text-secondary)' },
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
  perfGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  perfItem: { display: 'flex', flexDirection: 'column', gap: 4 },
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
  earnGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 },
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
  footerActions: { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' },
  primaryLink: {
    ...adminBtn.primary,
    textDecoration: 'none',
    display: 'inline-block',
  },
};
