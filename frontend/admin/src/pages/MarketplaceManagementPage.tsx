import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import AdminShell from '../layouts/AdminShell';
import { adminBtn } from '../styles/adminButtons';
import { currencySymbol, formatCurrency } from '../lib/currency';

const API = process.env.REACT_APP_API_URL || '/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}` });

type FilterKey = 'all' | 'pending' | 'suspended';

type Merchant = {
  id: string;
  name: string;
  category: string;
  city: string;
  orders: number;
  revenue: number;
  rating: number;
  status: string;
};

type PendingItem = {
  id: string;
  name: string;
  category: string;
  city: string;
  createdAt?: string;
};

type CategoryBar = { category: string; count: number };

function formatCompact(n: number, currency = 'GHS') {
  const sym = currencySymbol(currency);
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `${sym}${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (v >= 1_000) return `${sym}${(v / 1_000).toFixed(0)}K`;
  return `${sym}${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function statusStyle(status: string): React.CSSProperties {
  const s = status.toLowerCase();
  if (s === 'active') return { background: 'rgba(34,197,94,0.2)', color: 'var(--success)' };
  if (s === 'suspended') return { background: 'rgba(239,68,68,0.2)', color: 'var(--error)' };
  if (s === 'kyc') return { background: 'rgba(234,179,8,0.2)', color: 'var(--accent-gold)' };
  if (s === 'review') return { background: 'rgba(59,130,246,0.25)', color: '#93c5fd' };
  return { background: 'rgba(148,163,184,0.2)', color: 'var(--text-secondary)' };
}

const TABS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'suspended', label: 'Suspended' },
];

/** Marketplace management — merchants, GMV, approvals. */
export default function MarketplaceManagementPage() {
  const [filter, setFilter] = useState<FilterKey>('all');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [currency, setCurrency] = useState('GHS');
  const [stats, setStats] = useState({
    activeStores: 0,
    orders7d: 0,
    gmv: 0,
    aov: 0,
    pendingCount: 0,
    storesDelta: 0,
    ordersDelta: 0,
    gmvDelta: 0,
    aovDelta: 0,
  });
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [byCategory, setByCategory] = useState<CategoryBar[]>([]);
  const [pendingApproval, setPendingApproval] = useState<PendingItem[]>([]);
  const [form, setForm] = useState({
    businessName: '',
    category: 'Food',
    city: '',
    email: '',
    phone: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/marketplace/management`, { headers: headers() });
      const d = res.data?.data || {};
      setCurrency(d.currency || 'GHS');
      setStats({
        activeStores: Number(d.activeStores || 0),
        orders7d: Number(d.orders7d || 0),
        gmv: Number(d.gmv || 0),
        aov: Number(d.aov || 0),
        pendingCount: Number(d.pendingCount || 0),
        storesDelta: Number(d.storesDelta || 0),
        ordersDelta: Number(d.ordersDelta || 0),
        gmvDelta: Number(d.gmvDelta || 0),
        aovDelta: Number(d.aovDelta || 0),
      });
      setMerchants(d.merchants || []);
      setByCategory(d.byCategory || []);
      setPendingApproval(d.pendingApproval || []);
      setError('');
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Failed to load marketplace');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'all') return merchants;
    if (filter === 'suspended') {
      return merchants.filter((m) => m.status.toLowerCase() === 'suspended');
    }
    return merchants.filter((m) => ['pending', 'review', 'kyc'].includes(m.status.toLowerCase()));
  }, [merchants, filter]);

  const catMax = Math.max(1, ...byCategory.map((c) => c.count));

  const delta = (n?: number) =>
    n ? `${n >= 0 ? '+' : ''}${Number(n).toFixed(1)}%` : '';

  const exportCsv = () => {
    const header = 'name,category,city,orders,revenue,rating,status\n';
    const lines = merchants.map(
      (m) =>
        `"${String(m.name).replace(/"/g, '""')}",${m.category},${m.city},${m.orders},${m.revenue},${m.rating},${m.status}`
    );
    const blob = new Blob([header + lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'merchants.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const submitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.businessName.trim()) {
      setError('Business name is required');
      return;
    }
    setSaving(true);
    try {
      await axios.post(
        `${API}/admin/marketplace/merchants`,
        {
          businessName: form.businessName.trim(),
          category: form.category.trim(),
          city: form.city.trim() || undefined,
          email: form.email.trim() || undefined,
          phone: form.phone.trim() || undefined,
        },
        { headers: headers() }
      );
      setShowAdd(false);
      setForm({ businessName: '', category: 'Food', city: '', email: '', phone: '' });
      setMessage('Merchant added');
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Add merchant failed');
    } finally {
      setSaving(false);
    }
  };

  const approve = async (id: string) => {
    setActing(id);
    try {
      await axios.post(`${API}/admin/marketplace/merchants/${id}/approve`, {}, { headers: headers() });
      setMessage('Merchant approved');
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Approve failed');
    } finally {
      setActing(null);
    }
  };

  const reject = async (id: string) => {
    setActing(id);
    try {
      await axios.post(`${API}/admin/marketplace/merchants/${id}/reject`, {}, { headers: headers() });
      setMessage('Merchant rejected');
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Reject failed');
    } finally {
      setActing(null);
    }
  };

  const cards = [
    { label: 'Active Stores', value: String(stats.activeStores), meta: delta(stats.storesDelta) },
    { label: 'Orders (7D)', value: String(stats.orders7d), meta: delta(stats.ordersDelta) },
    { label: 'Marketplace GMV', value: formatCompact(stats.gmv, currency), meta: delta(stats.gmvDelta) },
    { label: 'Avg Order Value', value: formatCurrency(stats.aov, currency), meta: delta(stats.aovDelta) },
  ];

  return (
    <AdminShell activeLabel="Stores" hidePageTitle>
      <div style={styles.headerRow}>
        <div>
          <h1 style={styles.h1}>Marketplace Management</h1>
          <p style={styles.sub}>
            {stats.activeStores} active merchants · {stats.pendingCount} pending approval
          </p>
        </div>
        <div style={styles.actions} className="admin-actions">
          <button type="button" style={styles.secondaryBtn} onClick={exportCsv}>
            Export
          </button>
          <button type="button" style={styles.primaryBtn} onClick={() => setShowAdd(true)}>
            + Add Merchant
          </button>
        </div>
      </div>

      {error ? <p style={styles.error}>{error}</p> : null}
      {message ? <p style={styles.message}>{message}</p> : null}

      <div style={styles.cards}>
        {cards.map((c) => (
          <div key={c.label} style={styles.card}>
            <div style={styles.label}>{c.label}</div>
            <div style={styles.value}>{c.value}</div>
            {c.meta ? <div style={styles.meta}>{c.meta}</div> : null}
          </div>
        ))}
      </div>

      <div style={styles.layout}>
        <div style={styles.mainCol}>
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

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Store</th>
                  <th style={styles.th}>Category</th>
                  <th style={styles.th}>City</th>
                  <th style={styles.th}>Orders</th>
                  <th style={styles.th}>Revenue</th>
                  <th style={styles.th}>Rating</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th} />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={styles.tdMuted}>
                      Loading merchants…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={styles.tdMuted}>
                      No merchants found
                    </td>
                  </tr>
                ) : (
                  filtered.map((m) => (
                    <tr key={m.id}>
                      <td style={styles.td}>{m.name}</td>
                      <td style={styles.td}>{m.category}</td>
                      <td style={styles.td}>{m.city}</td>
                      <td style={styles.td}>{m.orders}</td>
                      <td style={styles.td}>{formatCurrency(m.revenue, currency)}</td>
                      <td style={styles.td}>{Number(m.rating || 0).toFixed(1)}</td>
                      <td style={styles.td}>
                        <span style={{ ...styles.badge, ...statusStyle(m.status) }}>{m.status}</span>
                      </td>
                      <td style={styles.td}>
                        <Link to="/merchants" style={styles.viewLink}>
                          Manage
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div style={styles.sideCol}>
          <div style={styles.panel}>
            <h2 style={styles.panelTitle}>By Category</h2>
            <div style={styles.catList}>
              {byCategory.length === 0 ? (
                <p style={styles.empty}>No category data</p>
              ) : (
                byCategory.map((c) => {
                  const pct = Math.round((c.count / catMax) * 100);
                  return (
                    <div key={c.category} style={styles.catRow}>
                      <div style={styles.catHead}>
                        <span>{c.category}</span>
                        <strong>{c.count}</strong>
                      </div>
                      <div style={styles.progressTrack}>
                        <div style={{ ...styles.progressFill, width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div style={styles.panel}>
            <h2 style={styles.panelTitle}>Pending Approval</h2>
            <div style={styles.pendingList}>
              {pendingApproval.length === 0 ? (
                <p style={styles.empty}>No pending merchants</p>
              ) : (
                pendingApproval.map((p) => (
                  <div key={p.id} style={styles.pendingItem}>
                    <div>
                      <div style={styles.pendingName}>{p.name}</div>
                      <div style={styles.pendingMeta}>
                        {p.category} · {p.city}
                      </div>
                    </div>
                    <div style={styles.pendingActions}>
                      <button
                        type="button"
                        style={styles.approveBtn}
                        disabled={acting === p.id}
                        onClick={() => approve(p.id)}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        style={styles.rejectBtn}
                        disabled={acting === p.id}
                        onClick={() => reject(p.id)}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {showAdd ? (
        <div style={styles.modalBackdrop} onClick={() => setShowAdd(false)}>
          <form
            style={styles.modal}
            onClick={(e) => e.stopPropagation()}
            onSubmit={submitAdd}
          >
            <h2 style={styles.modalTitle}>Add Merchant</h2>
            <div style={styles.formGrid}>
              {(
                [
                  ['businessName', 'Business name'],
                  ['category', 'Category'],
                  ['city', 'City'],
                  ['email', 'Email'],
                  ['phone', 'Phone'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} style={styles.field}>
                  <span style={styles.fieldLabel}>{label}</span>
                  <input
                    value={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    style={styles.input}
                    required={key === 'businessName'}
                  />
                </label>
              ))}
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
  message: { color: 'var(--success)', marginBottom: 12 },
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
  layout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.7fr) minmax(260px, 1fr)',
    gap: 16,
    alignItems: 'start',
  },
  mainCol: { minWidth: 0 },
  sideCol: { display: 'flex', flexDirection: 'column', gap: 12 },
  tabs: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 },
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
  badge: {
    display: 'inline-block',
    padding: '3px 8px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'capitalize',
  },
  viewLink: { color: 'var(--motion-blue)', fontWeight: 600, textDecoration: 'none' },
  panel: {
    background: 'var(--surface-elevated)',
    borderRadius: 14,
    padding: 16,
    border: '1px solid var(--border)',
  },
  panelTitle: { fontSize: 16, margin: '0 0 12px', fontWeight: 700 },
  empty: { color: 'var(--text-secondary)', margin: 0, fontSize: 13 },
  catList: { display: 'flex', flexDirection: 'column', gap: 12 },
  catRow: { display: 'flex', flexDirection: 'column', gap: 6 },
  catHead: {
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
    background: 'var(--movr-gradient)',
  },
  pendingList: { display: 'flex', flexDirection: 'column', gap: 10 },
  pendingItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
  },
  pendingName: { fontWeight: 700, fontSize: 14 },
  pendingMeta: { color: 'var(--text-secondary)', fontSize: 12, marginTop: 2 },
  pendingActions: { display: 'flex', gap: 8 },
  approveBtn: {
    border: 'none',
    borderRadius: 8,
    padding: '6px 10px',
    background: 'rgba(34,197,94,0.25)',
    color: 'var(--success)',
    fontWeight: 700,
    fontSize: 12,
    cursor: 'pointer',
  },
  rejectBtn: {
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '6px 10px',
    background: 'transparent',
    color: 'var(--error)',
    fontWeight: 700,
    fontSize: 12,
    cursor: 'pointer',
  },
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
