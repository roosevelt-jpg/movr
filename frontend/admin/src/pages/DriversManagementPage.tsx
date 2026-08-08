import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import AdminShell from '../layouts/AdminShell';
import { adminBtn } from '../styles/adminButtons';

const API = process.env.REACT_APP_API_URL || '/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}` });

type FilterKey = 'all' | 'online' | 'offline' | 'suspended' | 'kyc';

type DriverRow = {
  id: string;
  name: string;
  phone: string;
  city: string;
  trips: number;
  rating: number;
  subscription: string;
  status: string;
  dvt: number;
  initials: string;
};

type Stats = {
  total: number;
  online: number;
  avgRating: number;
  subscribed: number;
  totalDelta?: number;
  onlineDelta?: number;
  ratingDelta?: number;
  subscribedDelta?: number;
};

const TABS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All Drivers' },
  { key: 'online', label: 'Online' },
  { key: 'offline', label: 'Offline' },
  { key: 'suspended', label: 'Suspended' },
  { key: 'kyc', label: 'KYC Pending' },
];

function statusStyle(status: string): React.CSSProperties {
  const s = status.toLowerCase();
  if (s === 'online') return { background: 'rgba(34,197,94,0.2)', color: '#4ade80' };
  if (s === 'suspended') return { background: 'rgba(239,68,68,0.2)', color: '#f87171' };
  if (s === 'kyc') return { background: 'rgba(234,179,8,0.2)', color: '#facc15' };
  return { background: 'rgba(148,163,184,0.2)', color: '#94a3b8' };
}

function subStyle(sub: string): React.CSSProperties {
  const s = sub.toLowerCase();
  if (s === 'monthly' || s === 'weekly') return { background: 'rgba(142,45,226,0.25)', color: '#c4b5fd' };
  if (s === 'trial') return { background: 'rgba(59,130,246,0.25)', color: '#93c5fd' };
  if (s === 'expired') return { background: 'rgba(239,68,68,0.2)', color: '#f87171' };
  return { background: 'var(--surface)', color: 'var(--text-secondary)' };
}

/** Drivers management — stats, filters, onboard, export. */
export default function DriversManagementPage() {
  const [filter, setFilter] = useState<FilterKey>('all');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<DriverRow[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, online: 0, avgRating: 0, subscribed: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [onboarding, setOnboarding] = useState(false);
  const [showOnboard, setShowOnboard] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    city: '',
    email: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const [statsRes, listRes] = await Promise.all([
        axios.get(`${API}/admin/drivers/stats`, { headers: headers() }),
        axios.get(`${API}/admin/drivers`, {
          headers: headers(),
          params: { filter, q: q || undefined },
        }),
      ]);
      if (statsRes.data?.data) setStats(statsRes.data.data);
      setRows(listRes.data?.data || []);
      setError('');
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Failed to load drivers');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filter]);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    load();
  };

  const exportCsv = async () => {
    try {
      const res = await axios.get(`${API}/admin/drivers/export`, {
        headers: headers(),
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'drivers.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Export failed');
    }
  };

  const submitOnboard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.phone.trim()) {
      setError('Phone is required');
      return;
    }
    setOnboarding(true);
    try {
      await axios.post(
        `${API}/admin/drivers/onboard`,
        {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          phone: form.phone.trim(),
          city: form.city.trim(),
          email: form.email.trim() || undefined,
        },
        { headers: headers() }
      );
      setShowOnboard(false);
      setForm({ firstName: '', lastName: '', phone: '', city: '', email: '' });
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Onboard failed');
    } finally {
      setOnboarding(false);
    }
  };

  const delta = (n?: number) =>
    n == null ? '' : `${n >= 0 ? '+' : ''}${Number(n).toFixed(1)}%`;

  const cards = [
    { label: 'Total Drivers', value: String(stats.total), meta: delta(stats.totalDelta) },
    { label: 'Online Now', value: String(stats.online), meta: delta(stats.onlineDelta) },
    {
      label: 'Avg Rating',
      value: Number(stats.avgRating || 0).toFixed(2),
      meta: delta(stats.ratingDelta),
    },
    { label: 'Subscribed', value: String(stats.subscribed), meta: delta(stats.subscribedDelta) },
  ];

  return (
    <AdminShell activeLabel="Drivers" hidePageTitle>
      <div style={styles.headerRow}>
        <div>
          <h1 style={styles.h1}>Drivers</h1>
          <p style={styles.sub}>Manage onboarding, status, and subscriptions</p>
        </div>
        <div style={styles.actions} className="admin-actions">
          <button type="button" style={styles.secondaryBtn} onClick={exportCsv}>
            Export CSV
          </button>
          <button type="button" style={styles.primaryBtn} onClick={() => setShowOnboard(true)}>
            + Onboard Driver
          </button>
        </div>
      </div>

      {error ? <p style={styles.error}>{error}</p> : null}

      <div style={styles.cards}>
        {cards.map((c) => (
          <div key={c.label} style={styles.card}>
            <div style={styles.label}>{c.label}</div>
            <div style={styles.value}>{c.value}</div>
            {c.meta ? <div style={styles.meta}>{c.meta}</div> : null}
          </div>
        ))}
      </div>

      <div style={styles.toolbar}>
        <div style={styles.tabs}>
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              style={{ ...styles.tab, ...(filter === t.key ? styles.tabOn : {}) }}
              onClick={() => setFilter(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <form onSubmit={onSearch} style={styles.searchForm}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, phone, city…"
            style={styles.search}
          />
          <button type="submit" style={styles.secondaryBtn}>
            Search
          </button>
        </form>
      </div>

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Driver</th>
              <th style={styles.th}>Phone</th>
              <th style={styles.th}>City</th>
              <th style={styles.th}>Trips</th>
              <th style={styles.th}>Rating</th>
              <th style={styles.th}>Subscription</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>DVT</th>
              <th style={styles.th} />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} style={styles.tdMuted}>
                  Loading drivers…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9} style={styles.tdMuted}>
                  No drivers found
                </td>
              </tr>
            ) : (
              rows.map((d) => (
                <tr key={d.id}>
                  <td style={styles.td}>
                    <div style={styles.driverCell}>
                      <span style={styles.avatar}>{d.initials || 'D'}</span>
                      <span>{d.name}</span>
                    </div>
                  </td>
                  <td style={styles.td}>{d.phone}</td>
                  <td style={styles.td}>{d.city}</td>
                  <td style={styles.td}>{d.trips}</td>
                  <td style={styles.td}>{Number(d.rating || 0).toFixed(1)}</td>
                  <td style={styles.td}>
                    <span style={{ ...styles.badge, ...subStyle(d.subscription) }}>{d.subscription}</span>
                  </td>
                  <td style={styles.td}>
                    <span style={{ ...styles.badge, ...statusStyle(d.status) }}>{d.status}</span>
                  </td>
                  <td style={styles.td}>{Number(d.dvt || 0).toLocaleString()}</td>
                  <td style={styles.td}>
                    <Link to={`/drivers/${d.id}`} style={styles.viewLink}>
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showOnboard ? (
        <div style={styles.modalBackdrop} onClick={() => setShowOnboard(false)}>
          <form
            style={styles.modal}
            onClick={(e) => e.stopPropagation()}
            onSubmit={submitOnboard}
          >
            <h2 style={styles.modalTitle}>Onboard Driver</h2>
            <div style={styles.formGrid}>
              {(
                [
                  ['firstName', 'First name'],
                  ['lastName', 'Last name'],
                  ['phone', 'Phone'],
                  ['city', 'City'],
                  ['email', 'Email (optional)'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} style={styles.field}>
                  <span style={styles.fieldLabel}>{label}</span>
                  <input
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    style={styles.input}
                    required={key === 'phone'}
                  />
                </label>
              ))}
            </div>
            <div style={styles.modalActions}>
              <button type="button" style={styles.secondaryBtn} onClick={() => setShowOnboard(false)}>
                Cancel
              </button>
              <button type="submit" style={styles.primaryBtn} disabled={onboarding}>
                {onboarding ? 'Saving…' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
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
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  tabs: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  tab: {
    border: '1px solid var(--border)',
    borderRadius: 999,
    padding: '8px 14px',
    background: 'var(--surface)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 13,
  },
  tabOn: {
    background: 'linear-gradient(90deg, rgba(142,45,226,0.35), rgba(74,0,224,0.35))',
    border: '1px solid #8E2DE2',
    color: 'var(--brand-white)',
  },
  searchForm: { display: 'flex', gap: 8 },
  search: {
    minWidth: 220,
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-primary)',
    padding: '10px 12px',
    fontSize: 14,
  },
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
  driverCell: { display: 'flex', alignItems: 'center', gap: 10 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    display: 'grid',
    placeItems: 'center',
    fontSize: 11,
    fontWeight: 700,
    background: 'var(--movr-gradient)',
    color: 'var(--brand-white)',
    flexShrink: 0,
  },
  badge: {
    display: 'inline-block',
    padding: '3px 8px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'capitalize',
  },
  viewLink: { color: 'var(--motion-blue)', fontWeight: 600, textDecoration: 'none' },
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.55)',
    display: 'grid',
    placeItems: 'center',
    zIndex: 100,
    padding: 16,
  },
  modal: {
    width: '100%',
    maxWidth: 440,
    background: 'var(--surface-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: { margin: '0 0 16px', fontSize: 18, fontWeight: 700 },
  formGrid: { display: 'flex', flexDirection: 'column', gap: 12 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  fieldLabel: { fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 },
  input: {
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-primary)',
    padding: '10px 12px',
    fontSize: 14,
  },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 },
};
