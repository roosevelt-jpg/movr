import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import AdminShell from '../layouts/AdminShell';
import { adminBtn } from '../styles/adminButtons';
import { formatCurrency } from '../lib/currency';

const API = process.env.REACT_APP_API_URL || '/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}` });

type FilterKey = 'all' | 'active' | 'inactive' | 'gold' | 'platinum';

type CustomerRow = {
  id: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  rides: number;
  spend: number;
  points: number;
  tier: string;
  lastActive: string;
  initials: string;
};

type Stats = {
  total: number;
  active30: number;
  avgOrders: number;
  dvtHolders: number;
  totalDelta?: number;
  activeDelta?: number;
  ordersDelta?: number;
  dvtDelta?: number;
};

const TABS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'inactive', label: 'Inactive' },
  { key: 'gold', label: 'Gold' },
  { key: 'platinum', label: 'Platinum' },
];

function tierStyle(tier: string): React.CSSProperties {
  const t = tier.toLowerCase();
  if (t === 'platinum') return { background: 'rgba(168,85,247,0.25)', color: '#e9d5ff' };
  if (t === 'gold') return { background: 'rgba(234,179,8,0.25)', color: '#facc15' };
  if (t === 'silver') return { background: 'rgba(148,163,184,0.3)', color: '#e2e8f0' };
  return { background: 'rgba(180,83,9,0.25)', color: '#fdba74' };
}

/** Customer management — stats, tiers, add, export. */
export default function CustomersManagementPage() {
  const [filter, setFilter] = useState<FilterKey>('all');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, active30: 0, avgOrders: 0, dvtHolders: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    city: '',
    email: '',
    tier: 'bronze',
  });

  const load = async () => {
    setLoading(true);
    try {
      const [statsRes, listRes] = await Promise.all([
        axios.get(`${API}/admin/customers/stats`, { headers: headers() }),
        axios.get(`${API}/admin/customers`, {
          headers: headers(),
          params: { filter, q: q || undefined },
        }),
      ]);
      if (statsRes.data?.data) setStats(statsRes.data.data);
      setRows(listRes.data?.data || []);
      setError('');
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Failed to load customers');
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
      const res = await axios.get(`${API}/admin/customers/export`, {
        headers: headers(),
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'customers.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Export failed');
    }
  };

  const submitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.phone.trim()) {
      setError('Phone is required');
      return;
    }
    setSaving(true);
    try {
      await axios.post(
        `${API}/admin/customers`,
        {
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          phone: form.phone.trim(),
          city: form.city.trim(),
          email: form.email.trim() || undefined,
          tier: form.tier,
        },
        { headers: headers() }
      );
      setShowAdd(false);
      setForm({ firstName: '', lastName: '', phone: '', city: '', email: '', tier: 'bronze' });
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Add customer failed');
    } finally {
      setSaving(false);
    }
  };

  const delta = (n?: number) =>
    n == null ? '' : `${n >= 0 ? '+' : ''}${Number(n).toFixed(1)}%`;

  const cards = [
    { label: 'Total Customers', value: String(stats.total), meta: delta(stats.totalDelta) },
    { label: 'Active (30D)', value: String(stats.active30), meta: delta(stats.activeDelta) },
    {
      label: 'Avg Orders',
      value: Number(stats.avgOrders || 0).toFixed(1),
      meta: delta(stats.ordersDelta),
    },
    { label: 'DVT Holders', value: String(stats.dvtHolders), meta: delta(stats.dvtDelta) },
  ];

  return (
    <AdminShell activeLabel="Customers" hidePageTitle>
      <div style={styles.headerRow}>
        <div>
          <h1 style={styles.h1}>Customer Management</h1>
          <p style={styles.sub}>{stats.total.toLocaleString()} total customers</p>
        </div>
        <div style={styles.actions} className="admin-actions">
          <button type="button" style={styles.secondaryBtn} onClick={exportCsv}>
            Export CSV
          </button>
          <button type="button" style={styles.primaryBtn} onClick={() => setShowAdd(true)}>
            + Add Customer
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
            placeholder="Search name, phone, email…"
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
              <th style={styles.th}>Customer</th>
              <th style={styles.th}>Phone</th>
              <th style={styles.th}>City</th>
              <th style={styles.th}>Rides</th>
              <th style={styles.th}>Total Spend</th>
              <th style={styles.th}>Points</th>
              <th style={styles.th}>Tier</th>
              <th style={styles.th}>Last Active</th>
              <th style={styles.th} />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} style={styles.tdMuted}>
                  Loading customers…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9} style={styles.tdMuted}>
                  No customers found
                </td>
              </tr>
            ) : (
              rows.map((c) => (
                <tr key={c.id}>
                  <td style={styles.td}>
                    <div style={styles.personCell}>
                      <span style={styles.avatar}>{c.initials || 'C'}</span>
                      <span>{c.name}</span>
                    </div>
                  </td>
                  <td style={styles.td}>{c.phone}</td>
                  <td style={styles.td}>{c.city}</td>
                  <td style={styles.td}>{c.rides}</td>
                  <td style={styles.td}>{formatCurrency(c.spend)}</td>
                  <td style={{ ...styles.td, color: '#c4b5fd', fontWeight: 600 }}>
                    {Number(c.points || 0).toLocaleString()}
                  </td>
                  <td style={styles.td}>
                    <span style={{ ...styles.badge, ...tierStyle(c.tier) }}>{c.tier}</span>
                  </td>
                  <td style={styles.td}>{c.lastActive}</td>
                  <td style={styles.td}>
                    <Link to={`/customers/${c.id}`} style={styles.viewLink}>
                      View
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showAdd ? (
        <div style={styles.modalBackdrop} onClick={() => setShowAdd(false)}>
          <form
            style={styles.modal}
            onClick={(e) => e.stopPropagation()}
            onSubmit={submitAdd}
          >
            <h2 style={styles.modalTitle}>Add Customer</h2>
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
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Tier</span>
                <select
                  value={form.tier}
                  onChange={(e) => setForm((f) => ({ ...f, tier: e.target.value }))}
                  style={styles.input}
                >
                  <option value="bronze">Bronze</option>
                  <option value="silver">Silver</option>
                  <option value="gold">Gold</option>
                  <option value="platinum">Platinum</option>
                </select>
              </label>
            </div>
            <div style={styles.modalActions}>
              <button type="button" style={styles.secondaryBtn} onClick={() => setShowAdd(false)}>
                Cancel
              </button>
              <button type="submit" style={styles.primaryBtn} disabled={saving}>
                {saving ? 'Saving…' : 'Create'}
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
  personCell: { display: 'flex', alignItems: 'center', gap: 10 },
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
