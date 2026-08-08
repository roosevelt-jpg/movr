import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import AdminShell from '../layouts/AdminShell';
import { adminBtn } from '../styles/adminButtons';
import { formatCurrency } from '../lib/currency';

const API = process.env.REACT_APP_API_URL || '/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}` });

const SPLIT_COLORS = ['#8E2DE2', '#3B82F6', '#22C55E', '#EAB308', '#F97316', '#94A3B8'];

type RideRow = { id: string; customer: string; driver: string; fare: number; status: string };
type MerchantRow = { id: string; store: string; orders: number; revenue: number; rating: number };
type SplitRow = { category: string; amount: number };
type BarRow = { label: string; day?: string; gmv: number };

/** Admin overview — dashboard mockup with KPIs, charts, tables. */
export default function AdminOverviewPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currency, setCurrency] = useState('GHS');
  const [kpis, setKpis] = useState({
    ridesToday: 0,
    activeDrivers: 0,
    gmvToday: 0,
    ordersToday: 0,
  });
  const [weeklyBars, setWeeklyBars] = useState<BarRow[]>([]);
  const [revenueSplit, setRevenueSplit] = useState<SplitRow[]>([]);
  const [recentRides, setRecentRides] = useState<RideRow[]>([]);
  const [topMerchants, setTopMerchants] = useState<MerchantRow[]>([]);
  const [announcing, setAnnouncing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [overviewRes, widgetsRes] = await Promise.all([
        axios.get(`${API}/admin/overview`, { headers: headers() }),
        axios.get(`${API}/admin/overview/widgets`, { headers: headers() }),
      ]);
      const overview = overviewRes.data?.data || {};
      const widgets = widgetsRes.data?.data || {};
      setCurrency(widgets.gmvCurrency || overview.gmvCurrency || 'GHS');
      setKpis({
        ridesToday: Number(widgets.ridesToday ?? overview.rides ?? 0),
        activeDrivers: Number(widgets.activeDrivers ?? overview.activeRides ?? 0),
        gmvToday: Number(overview.gmvToday ?? widgets.weeklyRevenue ?? 0),
        ordersToday: Number(widgets.ordersToday ?? overview.orders ?? 0),
      });
      setWeeklyBars(widgets.weeklyBars || []);
      setRevenueSplit(widgets.revenueSplit || []);
      setRecentRides(widgets.recentRides || []);
      setTopMerchants(widgets.topMerchants || []);
      setError('');
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const dateLabel = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    []
  );

  const splitTotal = revenueSplit.reduce((s, r) => s + Number(r.amount || 0), 0) || 1;
  const splitChart = revenueSplit.map((r) => ({
    name: String(r.category || 'other'),
    value: Number(r.amount || 0),
  }));

  const chartData = weeklyBars.map((b) => ({
    name: b.label || String(b.day || '').slice(5),
    gmv: Number(b.gmv || 0),
  }));

  const exportDashboard = () => {
    const lines = [
      'metric,value',
      `rides_today,${kpis.ridesToday}`,
      `active_drivers,${kpis.activeDrivers}`,
      `gmv_today,${kpis.gmvToday}`,
      `orders_today,${kpis.ordersToday}`,
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dashboard-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const createAnnouncement = async () => {
    const title = window.prompt('Announcement title');
    if (!title?.trim()) return;
    const body = window.prompt('Announcement body');
    if (!body?.trim()) return;
    setAnnouncing(true);
    try {
      await axios.post(
        `${API}/admin/announcements`,
        { title: title.trim(), body: body.trim(), audience: 'all', status: 'published' },
        { headers: headers() }
      );
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Failed to create announcement');
    } finally {
      setAnnouncing(false);
    }
  };

  const cards = [
    { label: 'Total Rides Today', value: String(kpis.ridesToday) },
    { label: 'Active Drivers', value: String(kpis.activeDrivers) },
    { label: 'GMV Today', value: formatCurrency(kpis.gmvToday, currency) },
    { label: 'Marketplace Orders', value: String(kpis.ordersToday) },
  ];

  return (
    <AdminShell activeLabel="Dashboard" hidePageTitle>
      <div style={styles.headerRow}>
        <div>
          <h1 style={styles.h1}>Dashboard</h1>
          <p style={styles.sub}>{dateLabel}</p>
        </div>
        <div style={styles.actions} className="admin-actions">
          <button type="button" style={styles.secondaryBtn} onClick={exportDashboard}>
            Export
          </button>
          <button type="button" style={styles.primaryBtn} onClick={createAnnouncement} disabled={announcing}>
            {announcing ? 'Posting…' : '+ Announcement'}
          </button>
        </div>
      </div>

      {error ? <p style={styles.error}>{error}</p> : null}
      {loading ? <p style={styles.sub}>Loading dashboard…</p> : null}

      <div style={styles.cards} className="admin-kpi-grid" data-admin-grid="kpi">
        {cards.map((c) => (
          <div key={c.label} style={styles.card}>
            <div style={styles.label}>{c.label}</div>
            <div style={styles.value}>{c.value}</div>
          </div>
        ))}
      </div>

      <div style={styles.chartsRow} className="admin-split-grid" data-admin-grid="split">
        <div style={styles.panel}>
          <h2 style={styles.panelTitle}>Weekly Revenue</h2>
          <div style={{ height: 220 }}>
            {chartData.length === 0 ? (
              <div style={styles.empty}>No revenue data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barCategoryGap="28%">
                  <Tooltip
                    contentStyle={{
                      background: 'var(--surface-elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                    }}
                    formatter={(v: any) => formatCurrency(Number(v), currency)}
                  />
                  <Bar dataKey="gmv" fill="url(#dashGmv)" radius={[6, 6, 0, 0]} />
                  <defs>
                    <linearGradient id="dashGmv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8E2DE2" />
                      <stop offset="100%" stopColor="#4A00E0" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div style={styles.panel}>
          <h2 style={styles.panelTitle}>Revenue Split</h2>
          <div style={styles.splitBody}>
            <div style={{ width: 140, height: 140 }}>
              {splitChart.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={splitChart} dataKey="value" innerRadius={38} outerRadius={58} paddingAngle={2}>
                      {splitChart.map((_, i) => (
                        <Cell key={i} fill={SPLIT_COLORS[i % SPLIT_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div style={styles.empty}>No split</div>
              )}
            </div>
            <div style={styles.splitList}>
              {splitChart.map((s, i) => (
                <div key={s.name} style={styles.splitRow}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        background: SPLIT_COLORS[i % SPLIT_COLORS.length],
                      }}
                    />
                    <span style={{ textTransform: 'capitalize' }}>{s.name}</span>
                  </span>
                  <strong>{Math.round((s.value / splitTotal) * 100)}%</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={styles.tablesRow} className="admin-split-grid" data-admin-grid="split">
        <div style={styles.panel}>
          <h2 style={styles.panelTitle}>Recent Rides</h2>
          <div className="admin-table-scroll">
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Customer</th>
                <th style={styles.th}>Driver</th>
                <th style={styles.th}>Fare</th>
                <th style={styles.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentRides.length === 0 ? (
                <tr>
                  <td colSpan={4} style={styles.tdMuted}>
                    No recent rides
                  </td>
                </tr>
              ) : (
                recentRides.map((r) => (
                  <tr key={r.id}>
                    <td style={styles.td}>{r.customer}</td>
                    <td style={styles.td}>{r.driver}</td>
                    <td style={styles.td}>{formatCurrency(r.fare, currency)}</td>
                    <td style={styles.td}>
                      <span style={styles.statusPill}>{r.status}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>

        <div style={styles.panel}>
          <h2 style={styles.panelTitle}>Top Merchants</h2>
          <div className="admin-table-scroll">
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Store</th>
                <th style={styles.th}>Orders</th>
                <th style={styles.th}>Revenue</th>
                <th style={styles.th}>Rating</th>
              </tr>
            </thead>
            <tbody>
              {topMerchants.length === 0 ? (
                <tr>
                  <td colSpan={4} style={styles.tdMuted}>
                    No merchant data
                  </td>
                </tr>
              ) : (
                topMerchants.map((m) => (
                  <tr key={m.id}>
                    <td style={styles.td}>{m.store}</td>
                    <td style={styles.td}>{m.orders}</td>
                    <td style={styles.td}>{formatCurrency(m.revenue, currency)}</td>
                    <td style={styles.td}>{Number(m.rating || 0).toFixed(1)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
  chartsRow: {
    display: 'grid',
    gridTemplateColumns: '1.4fr 1fr',
    gap: 12,
    marginBottom: 16,
  },
  tablesRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
  },
  panel: {
    background: 'var(--surface-elevated)',
    borderRadius: 14,
    padding: 16,
    border: '1px solid var(--border)',
  },
  panelTitle: { fontSize: 16, margin: '0 0 12px', fontWeight: 700 },
  empty: {
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-secondary)',
  },
  splitBody: { display: 'flex', alignItems: 'center', gap: 16 },
  splitList: { flex: 1, display: 'flex', flexDirection: 'column', gap: 8 },
  splitRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 13,
    color: 'var(--text-secondary)',
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left',
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontWeight: 600,
    padding: '8px 6px',
    borderBottom: '1px solid var(--border)',
  },
  td: {
    padding: '10px 6px',
    borderBottom: '1px solid var(--border)',
    fontSize: 13,
  },
  tdMuted: {
    padding: '16px 6px',
    color: 'var(--text-secondary)',
    textAlign: 'center',
  },
  statusPill: {
    display: 'inline-block',
    padding: '3px 8px',
    borderRadius: 999,
    background: 'rgba(142,45,226,0.2)',
    color: 'var(--text-primary)',
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'capitalize',
  },
};
