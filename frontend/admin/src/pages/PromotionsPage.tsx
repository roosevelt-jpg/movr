import React, { useEffect, useState } from 'react';
import axios from 'axios';
import AdminShell from '../layouts/AdminShell';
import { adminBtn } from '../styles/adminButtons';
import { formatCurrency } from '../lib/currency';

const API = process.env.REACT_APP_API_URL || '/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}` });

type FilterKey = 'all' | 'active' | 'scheduled' | 'expired';

type PromoRow = {
  id: string;
  code: string;
  type: string;
  discount: string;
  minOrder: number | null;
  redemptions: string;
  expires: string;
  status: string;
};

type Stats = {
  active: number;
  redemptions: number;
  revenueImpact: number;
  dvtBonuses: number;
  redemptionsDelta?: number;
};

const TABS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'expired', label: 'Expired' },
];

function statusStyle(status: string): React.CSSProperties {
  const s = status.toLowerCase();
  if (s === 'active' || s === 'permanent') return { background: 'rgba(34,197,94,0.2)', color: '#4ade80' };
  if (s === 'scheduled') return { background: 'rgba(59,130,246,0.25)', color: '#93c5fd' };
  if (s === 'expired') return { background: 'rgba(148,163,184,0.2)', color: '#94a3b8' };
  return { background: 'rgba(142,45,226,0.25)', color: '#c4b5fd' };
}

function formatCompact(n: number) {
  const v = Math.abs(Number(n) || 0);
  const sign = n < 0 ? '-' : '';
  if (v >= 1_000_000) return `${sign}${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (v >= 1_000) return `${sign}${(v / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return `${sign}${v.toLocaleString()}`;
}

const emptyForm = {
  code: '',
  promoType: 'ride_discount',
  discountUnit: 'percent',
  discountValue: '',
  minOrder: '',
  startsAt: '',
  endsAt: '',
  maxUses: '',
  appliesTo: 'all',
  newUsersOnly: false,
};

/** Promotions / coupons — stats, list, create form. */
export default function PromotionsPage() {
  const [filter, setFilter] = useState<FilterKey>('all');
  const [rows, setRows] = useState<PromoRow[]>([]);
  const [stats, setStats] = useState<Stats>({
    active: 0,
    redemptions: 0,
    revenueImpact: 0,
    dvtBonuses: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    try {
      const [statsRes, listRes] = await Promise.all([
        axios.get(`${API}/admin/promotions/stats`, { headers: headers() }),
        axios.get(`${API}/admin/promotions`, {
          headers: headers(),
          params: { filter },
        }),
      ]);
      if (statsRes.data?.data) setStats(statsRes.data.data);
      setRows(listRes.data?.data || []);
      setError('');
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Failed to load promotions');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filter]);

  const exportCsv = async () => {
    try {
      const res = await axios.get(`${API}/admin/promotions/export`, {
        headers: headers(),
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'promotions.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Export failed');
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim()) {
      setError('Promo code is required');
      return;
    }
    setSaving(true);
    try {
      await axios.post(
        `${API}/admin/promotions`,
        {
          code: form.code.trim(),
          promoType: form.promoType,
          discountUnit: form.discountUnit,
          discountValue: Number(form.discountValue || 0),
          minOrder: Number(form.minOrder || 0),
          startsAt: form.startsAt || undefined,
          endsAt: form.endsAt || undefined,
          maxUses: form.maxUses ? Number(form.maxUses) : undefined,
          appliesTo: form.appliesTo,
          newUsersOnly: form.newUsersOnly,
        },
        { headers: headers() }
      );
      setForm(emptyForm);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  const cards = [
    { label: 'Active Promos', value: String(stats.active) },
    {
      label: 'Redemptions',
      value: Number(stats.redemptions || 0).toLocaleString(),
      meta:
        stats.redemptionsDelta != null
          ? `+${Number(stats.redemptionsDelta).toFixed(1)}%`
          : undefined,
    },
    { label: 'Revenue Impact', value: formatCurrency(stats.revenueImpact || 0) },
    { label: 'DVT Bonuses', value: formatCompact(stats.dvtBonuses || 0) },
  ];

  return (
    <AdminShell activeLabel="Coupons" hidePageTitle>
      <div style={styles.headerRow}>
        <div>
          <h1 style={styles.h1}>Promotions</h1>
          <p style={styles.sub}>Coupons, discounts, and DVT bonus campaigns</p>
        </div>
        <div style={styles.actions} className="admin-actions">
          <button type="button" className="admin-btn" style={styles.secondaryBtn} onClick={exportCsv}>
            Export
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
      </div>

      <div style={styles.split}>
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Code</th>
                <th style={styles.th}>Type</th>
                <th style={styles.th}>Discount</th>
                <th style={styles.th}>Min order</th>
                <th style={styles.th}>Redemptions</th>
                <th style={styles.th}>Expires</th>
                <th style={styles.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={styles.tdMuted}>
                    Loading promotions…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={styles.tdMuted}>
                    No promotions found
                  </td>
                </tr>
              ) : (
                rows.map((p) => (
                  <tr key={p.id}>
                    <td style={{ ...styles.td, fontWeight: 700 }}>{p.code}</td>
                    <td style={{ ...styles.td, textTransform: 'capitalize' }}>{p.type}</td>
                    <td style={styles.td}>{p.discount}</td>
                    <td style={styles.td}>
                      {p.minOrder != null ? formatCurrency(p.minOrder) : '—'}
                    </td>
                    <td style={styles.td}>{p.redemptions}</td>
                    <td style={styles.td}>{p.expires}</td>
                    <td style={styles.td}>
                      <span style={{ ...styles.badge, ...statusStyle(p.status) }}>{p.status}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <form style={styles.panel} onSubmit={submit}>
          <h2 style={styles.panelTitle}>Create New Promo</h2>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Code</span>
            <input
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              style={styles.input}
              placeholder="SUMMER25"
              required
            />
          </label>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Promo type</span>
            <select
              value={form.promoType}
              onChange={(e) => setForm((f) => ({ ...f, promoType: e.target.value }))}
              style={styles.input}
            >
              <option value="ride_discount">Ride discount</option>
              <option value="order_discount">Order discount</option>
              <option value="dvt_bonus">DVT bonus</option>
              <option value="referral">Referral</option>
            </select>
          </label>
          <div style={styles.row2}>
            <label style={styles.field}>
              <span style={styles.fieldLabel}>Unit</span>
              <select
                value={form.discountUnit}
                onChange={(e) => setForm((f) => ({ ...f, discountUnit: e.target.value }))}
                style={styles.input}
              >
                <option value="percent">Percent</option>
                <option value="fixed">Fixed</option>
                <option value="multiplier">Multiplier</option>
              </select>
            </label>
            <label style={styles.field}>
              <span style={styles.fieldLabel}>Value</span>
              <input
                type="number"
                value={form.discountValue}
                onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))}
                style={styles.input}
                required
              />
            </label>
          </div>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Min order</span>
            <input
              type="number"
              value={form.minOrder}
              onChange={(e) => setForm((f) => ({ ...f, minOrder: e.target.value }))}
              style={styles.input}
            />
          </label>
          <div style={styles.dateStack}>
            <label style={styles.field}>
              <span style={styles.fieldLabel}>Starts</span>
              <input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
                style={styles.input}
              />
            </label>
            <label style={styles.field}>
              <span style={styles.fieldLabel}>Ends</span>
              <input
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
                style={styles.input}
              />
            </label>
          </div>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Max uses</span>
            <input
              type="number"
              value={form.maxUses}
              onChange={(e) => setForm((f) => ({ ...f, maxUses: e.target.value }))}
              style={styles.input}
            />
          </label>
          <label style={styles.field}>
            <span style={styles.fieldLabel}>Applies to</span>
            <select
              value={form.appliesTo}
              onChange={(e) => setForm((f) => ({ ...f, appliesTo: e.target.value }))}
              style={styles.input}
            >
              <option value="all">All services</option>
              <option value="rides">Rides</option>
              <option value="orders">Orders</option>
              <option value="parcels">Parcels</option>
            </select>
          </label>
          <label style={styles.checkRow}>
            <input
              type="checkbox"
              checked={form.newUsersOnly}
              onChange={(e) => setForm((f) => ({ ...f, newUsersOnly: e.target.checked }))}
            />
            <span>New users only</span>
          </label>
          <button type="submit" style={styles.primaryBtn} disabled={saving}>
            {saving ? 'Creating…' : 'Create Promo'}
          </button>
        </form>
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
  actions: { display: 'flex', gap: 10 },
  primaryBtn: { ...adminBtn.block },
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
  toolbar: { marginBottom: 12 },
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
  split: {
    display: 'grid',
    gridTemplateColumns: '1fr minmax(280px, 340px)',
    gap: 16,
    alignItems: 'start',
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
  },
  panel: {
    background: 'var(--surface-elevated)',
    borderRadius: 14,
    border: '1px solid var(--border)',
    padding: 16,
    position: 'sticky',
    top: 88,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    minWidth: 0,
    overflow: 'hidden',
  },
  panelTitle: { margin: '0 0 4px', fontSize: 16, fontWeight: 700 },
  field: { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 },
  fieldLabel: { fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 },
  input: {
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-primary)',
    padding: '10px 12px',
    fontSize: 14,
    width: '100%',
    minWidth: 0,
    maxWidth: '100%',
    boxSizing: 'border-box',
  },
  row2: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
    gap: 8,
  },
  dateStack: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr)',
    gap: 10,
  },
  checkRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    color: 'var(--text-secondary)',
    marginBottom: 4,
  },
};
