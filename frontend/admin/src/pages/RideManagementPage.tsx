import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import AdminShell from '../layouts/AdminShell';
import { formatCurrency } from '../lib/currency';
import { adminBtn } from '../styles/adminButtons';

const API = process.env.REACT_APP_API_URL || '/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}` });

type FilterKey = 'all' | 'in_progress' | 'completed' | 'cancelled' | 'sos';

type RideRow = {
  id: string;
  rideId: string;
  customer: string;
  driver: string;
  from: string;
  to: string;
  distanceKm: number;
  fare: number;
  dvt: number;
  status: string;
  time: string;
};

type Stats = {
  ridesToday: number;
  completed: number;
  cancelled: number;
  avgFare: number;
  ridesDelta?: number;
  completedDelta?: number;
  fareDelta?: number;
  currency?: string;
};

const TABS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'sos', label: 'SOS' },
];

function statusStyle(status: string): React.CSSProperties {
  const s = status.toLowerCase();
  if (s === 'done' || s.includes('complete')) {
    return { background: 'rgba(34,197,94,0.2)', color: 'var(--success)' };
  }
  if (s.includes('cancel')) {
    return { background: 'rgba(239,68,68,0.2)', color: 'var(--error)' };
  }
  if (s === 'pending' || s.includes('request')) {
    return { background: 'rgba(234,179,8,0.2)', color: 'var(--accent-gold)' };
  }
  if (s.includes('sos')) {
    return { background: 'rgba(239,68,68,0.35)', color: '#fecaca' };
  }
  return { background: 'rgba(59,130,246,0.2)', color: '#93c5fd' };
}

function formatTime(iso?: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '—';
  }
}

function todayChip() {
  return new Date().toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** Admin ride management list — KPIs, filters, table, export. */
export default function RideManagementPage() {
  const [filter, setFilter] = useState<FilterKey>('all');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<RideRow[]>([]);
  const [stats, setStats] = useState<Stats>({
    ridesToday: 0,
    completed: 0,
    cancelled: 0,
    avgFare: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const currency = stats.currency || 'GHS';

  const load = async () => {
    setLoading(true);
    try {
      const [statsRes, listRes] = await Promise.all([
        axios.get(`${API}/admin/rides/stats`, { headers: headers() }),
        axios.get(`${API}/admin/rides/list`, {
          headers: headers(),
          params: { filter, q: q || undefined, day: 'today' },
        }),
      ]);
      if (statsRes.data?.data) setStats(statsRes.data.data);
      setRows(listRes.data?.data || []);
      setError('');
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Failed to load rides');
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
      const res = await axios.get(`${API}/admin/rides/export`, {
        headers: headers(),
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'rides.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Export failed');
    }
  };

  const delta = (n?: number) =>
    n == null ? '' : `${n >= 0 ? '+' : ''}${Number(n).toFixed(1)}%`;

  return (
    <AdminShell activeLabel="Ride Management">
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>Ride Management</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '8px 0 0' }}>
            Monitor live and completed trips across the network.
          </p>
        </div>
        <div className="admin-actions">
          <button type="button" className="admin-btn" onClick={exportCsv} style={styles.exportBtn}>
            Export
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: 12,
          marginBottom: 24,
        }}
      >
        {[
          { label: 'Rides Today', value: String(stats.ridesToday), d: stats.ridesDelta },
          { label: 'Completed', value: String(stats.completed), d: stats.completedDelta },
          { label: 'Cancelled', value: String(stats.cancelled) },
          {
            label: 'Avg Fare',
            value: formatCurrency(Number(stats.avgFare || 0), currency),
            d: stats.fareDelta,
          },
        ].map((c) => (
          <div key={c.label} style={styles.kpi}>
            <p style={styles.kpiLabel}>{c.label}</p>
            <p style={styles.kpiValue}>{c.value}</p>
            {c.d != null ? <p style={styles.kpiDelta}>{delta(c.d)}</p> : null}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setFilter(t.key)}
              style={{
                ...styles.tab,
                ...(filter === t.key ? styles.tabActive : {}),
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <form onSubmit={onSearch} style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search ride, customer, driver…"
            style={styles.search}
          />
          <button type="submit" style={styles.searchBtn}>
            Search
          </button>
        </form>
        <span style={styles.dayChip}>Today · {todayChip()}</span>
      </div>

      {error ? <p style={{ color: 'var(--error)' }}>{error}</p> : null}

      <div style={styles.tableWrap}>
        <div style={styles.tableHead}>
          <span>Ride ID</span>
          <span>Customer</span>
          <span>Driver</span>
          <span>Route</span>
          <span>Distance</span>
          <span>Fare</span>
          <span>DVT</span>
          <span>Status</span>
          <span>Time</span>
          <span />
        </div>
        {loading ? (
          <div style={styles.empty}>Loading…</div>
        ) : !rows.length ? (
          <div style={styles.empty}>No rides for this filter</div>
        ) : (
          rows.map((r) => (
            <div key={r.id} style={styles.tableRow}>
              <span style={{ fontWeight: 600 }}>{r.rideId}</span>
              <span>{r.customer}</span>
              <span>{r.driver}</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                {[r.from, r.to].filter(Boolean).join(' → ') || '—'}
              </span>
              <span>{r.distanceKm ? `${Number(r.distanceKm).toFixed(1)} km` : '—'}</span>
              <span>{formatCurrency(Number(r.fare || 0), currency)}</span>
              <span>{Number(r.dvt || 0) ? Number(r.dvt).toFixed(1) : '—'}</span>
              <span>
                <span
                  style={{
                    ...statusStyle(r.status),
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: 999,
                  }}
                >
                  {r.status}
                </span>
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>{formatTime(r.time)}</span>
              <span>
                <Link to={`/rides/${r.id}`} style={styles.viewLink}>
                  View
                </Link>
              </span>
            </div>
          ))
        )}
      </div>
    </AdminShell>
  );
}

const styles: Record<string, React.CSSProperties> = {
  exportBtn: { ...adminBtn.secondary },
  kpi: {
    background: 'var(--surface-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: '16px 18px',
  },
  kpiLabel: { margin: 0, fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 },
  kpiValue: { margin: '8px 0 0', fontSize: 24, fontWeight: 800 },
  kpiDelta: { margin: '6px 0 0', fontSize: 12, color: 'var(--success)' },
  tab: {
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    borderRadius: 999,
    padding: '8px 14px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  tabActive: {
    background: 'var(--movr-gradient)',
    color: 'var(--brand-white)',
    borderColor: 'transparent',
  },
  search: {
    minWidth: 220,
    padding: '9px 12px',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-primary)',
    fontSize: 13,
  },
  searchBtn: { ...adminBtn.primary },
  dayChip: {
    fontSize: 12,
    fontWeight: 600,
    padding: '8px 12px',
    borderRadius: 999,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    color: 'var(--text-secondary)',
  },
  tableWrap: {
    background: 'var(--surface-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    overflow: 'auto',
  },
  tableHead: {
    display: 'grid',
    gridTemplateColumns: '0.9fr 1fr 1fr 1.6fr 0.7fr 0.8fr 0.5fr 0.8fr 0.7fr 0.5fr',
    gap: 8,
    padding: '12px 16px',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
    color: 'var(--text-secondary)',
    borderBottom: '1px solid var(--border)',
    minWidth: 960,
  },
  tableRow: {
    display: 'grid',
    gridTemplateColumns: '0.9fr 1fr 1fr 1.6fr 0.7fr 0.8fr 0.5fr 0.8fr 0.7fr 0.5fr',
    gap: 8,
    padding: '14px 16px',
    fontSize: 13,
    alignItems: 'center',
    borderBottom: '1px solid var(--border)',
    minWidth: 960,
  },
  empty: { padding: 32, textAlign: 'center', color: 'var(--text-secondary)' },
  viewLink: {
    color: 'var(--motion-blue)',
    fontWeight: 600,
    textDecoration: 'none',
    fontSize: 13,
  },
};
