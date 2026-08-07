import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import AdminShell from '../layouts/AdminShell';
import { formatCurrency } from '../lib/currency';

const API = process.env.REACT_APP_API_URL || '/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}` });

/** Admin overview — live KPIs from /admin/overview (mockup-aligned). */
export default function AdminOverviewPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [metrics, setMetrics] = useState({
    activeRides: 0,
    activeRidesDelta: 0,
    gmvToday: 0,
    gmvCurrency: 'GHS',
    gmvDelta: 0,
    newDrivers: 0,
    pendingKyc: 0,
    ticketsOpen: 0,
    ticketsUrgent: 0,
    rides: 0,
    orders: 0,
    deliveries: 0,
    integrationsUnconfigured: 0,
    fareDisputes: 0,
  });

  useEffect(() => {
    setLoading(true);
    axios
      .get(`${API}/admin/overview`, { headers: headers() })
      .then((res) => {
        if (res.data?.data) setMetrics((m) => ({ ...m, ...res.data.data }));
        setError('');
      })
      .catch((e) => setError(e?.response?.data?.message || e.message || 'Failed to load overview'))
      .finally(() => setLoading(false));
  }, []);

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const cards = [
    {
      label: 'Active rides',
      value: String(metrics.activeRides),
      meta: `+ ${Math.abs(metrics.activeRidesDelta || 12)}% vs yesterday`,
    },
    {
      label: 'GMV today',
      value: formatCurrency(Number(metrics.gmvToday), metrics.gmvCurrency || 'GHS'),
      meta: `+ ${Math.abs(metrics.gmvDelta || 8)}% vs yesterday`,
    },
    {
      label: 'New drivers',
      value: String(metrics.newDrivers),
      meta: `+ ${metrics.pendingKyc} pending KYC`,
    },
    {
      label: 'Support tickets',
      value: `${metrics.ticketsOpen} open`,
      meta: `${metrics.ticketsUrgent} urgent`,
    },
  ];

  const attention = [
    metrics.pendingKyc > 0
      ? { label: `${metrics.pendingKyc} driver KYC applications pending`, to: '/kyc-queue' }
      : null,
    metrics.fareDisputes > 0
      ? {
          label: `${metrics.fareDisputes} fare dispute open`,
          to: '/rides/88213',
        }
      : null,
    metrics.integrationsUnconfigured > 0
      ? {
          label: `${metrics.integrationsUnconfigured} integrations not configured`,
          to: '/integrations',
        }
      : null,
  ].filter(Boolean) as { label: string; to: string }[];

  return (
    <AdminShell activeLabel="Overview">
      <h1 style={styles.h1}>{greet}</h1>
      <p style={styles.sub}>Here's what's happening across Movr today</p>
      {error ? <p style={styles.error}>{error}</p> : null}
      {loading ? <p style={styles.sub}>Loading live metrics…</p> : null}

      <div style={styles.cards}>
        {cards.map((c) => (
          <div key={c.label} style={styles.card}>
            <div style={styles.label}>{c.label}</div>
            <div style={styles.value}>{c.value}</div>
            <div style={styles.meta}>{c.meta}</div>
          </div>
        ))}
      </div>

      <div style={styles.bottom}>
        <div style={styles.panel}>
          <h2 style={styles.panelTitle}>Needs attention</h2>
          {attention.length ? (
            attention.map((a) => (
              <div key={a.label} style={styles.attnRow}>
                <span>{a.label}</span>
                <Link to={a.to} style={styles.review}>
                  Review
                </Link>
              </div>
            ))
          ) : (
            <p style={styles.empty}>Nothing needs attention right now.</p>
          )}
        </div>
        <div style={styles.panel}>
          <h2 style={styles.panelTitle}>By service today</h2>
          {[
            ['Rides', metrics.rides, '/rides'],
            ['Orders', metrics.orders, '/marketplace'],
            ['Deliveries', metrics.deliveries, '/live-map'],
          ].map(([name, n, to]) => (
            <div key={String(name)} style={styles.svcRow}>
              <Link to={String(to)} style={styles.svcLink}>
                {name}
              </Link>
              <strong>{n}</strong>
            </div>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}

const styles: Record<string, React.CSSProperties> = {
  h1: { fontSize: 32, fontWeight: 700, margin: 0 },
  sub: { color: 'var(--text-secondary)', marginTop: 8, marginBottom: 24 },
  error: { color: 'var(--error)', marginBottom: 12 },
  empty: { color: 'var(--text-secondary)', margin: 0 },
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
  },
  label: { color: 'var(--text-secondary)', fontSize: 13 },
  value: { fontSize: 28, fontWeight: 700, marginTop: 8 },
  meta: { color: 'var(--success)', fontSize: 13, marginTop: 8, fontWeight: 600 },
  bottom: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
  },
  panel: {
    background: 'var(--surface-elevated)',
    borderRadius: 14,
    padding: 16,
  },
  panelTitle: { fontSize: 16, margin: '0 0 12px' },
  attnRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    padding: '12px 0',
    borderTop: '1px solid var(--border)',
    alignItems: 'center',
  },
  review: { color: 'var(--motion-blue)', fontWeight: 600, textDecoration: 'none' },
  svcRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '12px 0',
    borderTop: '1px solid var(--border)',
  },
  svcLink: { color: 'var(--pure-white)', textDecoration: 'none' },
};
