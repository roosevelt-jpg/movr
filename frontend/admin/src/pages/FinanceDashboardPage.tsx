import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { BarChart, Bar, Tooltip, ResponsiveContainer } from 'recharts';
import AdminShell from '../layouts/AdminShell';
import AdminOpsNav from '../components/AdminOpsNav';
import { currencySymbol } from '../lib/currency';

const API = process.env.REACT_APP_API_URL || '/api/v1';

function headers() {
  return { Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}` };
}

function formatCompact(n: number, currency = 'GHS') {
  const sym = currencySymbol(currency);
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `${sym}${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (v >= 1_000) return `${sym}${(v / 1_000).toFixed(0)}K`;
  return `${sym}${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

/** Admin finance — GMV cards, daily chart, export CSV. */
export default function FinanceDashboardPage() {
  const [gmv, setGmv] = useState<any[]>([]);
  const [message, setMessage] = useState('');
  const [metrics, setMetrics] = useState({
    gmv30: 0,
    gmvCurrency: 'GHS',
    subscriptions: 0,
    pendingPayouts: 0,
    countries: 0,
    gmvByDay: [] as { day: string; gmv: number }[],
  });

  useEffect(() => {
    axios
      .get(`${API}/admin/finance/summary`, { headers: headers() })
      .then((res) => {
        if (res.data?.data) setMetrics((m) => ({ ...m, ...res.data.data }));
      })
      .catch((e) => setMessage(e.message));

    axios
      .get(`${API}/admin/finance/gmv`, { headers: headers() })
      .then((res) => setGmv(res.data.data || []))
      .catch(() => undefined);
  }, []);

  const exportCsv = async () => {
    const to = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const res = await axios.get(`${API}/admin/finance/reconciliation`, {
      headers: headers(),
      params: { format: 'csv', from, to },
      responseType: 'blob',
    });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reconciliation-${from}-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const chartData = useMemo(() => {
    if (metrics.gmvByDay?.length) {
      return metrics.gmvByDay.map((r) => ({
        name: String(r.day).slice(5),
        gmv: Number(r.gmv || 0),
      }));
    }
    if (!gmv.length) return [];
    const byDay = new Map<string, number>();
    for (const r of gmv) {
      const day = String(r.date || r.day || '').slice(0, 10);
      if (!day) continue;
      byDay.set(day, (byDay.get(day) || 0) + Number(r.gmv_amount || 0));
    }
    return Array.from(byDay.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-7)
      .map(([day, amount]) => ({ name: day.slice(5), gmv: amount }));
  }, [gmv, metrics.gmvByDay]);

  return (
    <AdminShell activeLabel="Finance" hidePageTitle>
      <AdminOpsNav />

      <div style={styles.cards}>
        {[
          { label: 'GMV (30d)', value: formatCompact(metrics.gmv30, metrics.gmvCurrency) },
          { label: 'Subscriptions', value: formatCompact(metrics.subscriptions, metrics.gmvCurrency) },
          { label: 'Pending payouts', value: formatCompact(metrics.pendingPayouts, metrics.gmvCurrency) },
          { label: 'Active countries', value: String(metrics.countries || 0) },
        ].map((c) => (
          <div key={c.label} style={styles.card}>
            <div style={styles.label}>{c.label}</div>
            <div style={styles.value}>{c.value}</div>
          </div>
        ))}
      </div>

      <div style={styles.chartCard}>
        <div style={styles.label}>GMV by day</div>
        <div style={{ height: 220, marginTop: 12 }}>
          {chartData.length === 0 ? (
            <div style={styles.emptyChart}>No GMV data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barCategoryGap="28%">
                <Tooltip
                  contentStyle={{
                    background: '#1A1A1A',
                    border: '1px solid #333',
                    borderRadius: 8,
                  }}
                  formatter={(v: any) => formatCompact(Number(v), metrics.gmvCurrency)}
                />
                <Bar dataKey="gmv" fill="url(#gmvGrad)" radius={[6, 6, 0, 0]} />
                <defs>
                  <linearGradient id="gmvGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8E2DE2" />
                    <stop offset="100%" stopColor="#4A00E0" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <button
          type="button"
          style={styles.btn}
          onClick={() => exportCsv().catch((e) => setMessage(e.message))}
        >
          ↓ Export reconciliation CSV
        </button>
      </div>

      {message ? <p style={{ color: '#4ade80', marginTop: 12 }}>{message}</p> : null}
    </AdminShell>
  );
}

const styles: Record<string, React.CSSProperties> = {
  cards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 12,
    marginBottom: 16,
  },
  card: {
    background: '#1A1A1A',
    borderRadius: 14,
    padding: 16,
  },
  label: { color: '#888', fontSize: 13 },
  value: { fontSize: 28, fontWeight: 700, marginTop: 8, color: '#fff' },
  chartCard: {
    background: '#1A1A1A',
    borderRadius: 14,
    padding: 16,
  },
  emptyChart: {
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#888',
  },
  btn: {
    marginTop: 16,
    border: 'none',
    borderRadius: 12,
    padding: '12px 18px',
    background: 'linear-gradient(90deg, #0d9488, #3B82F6)',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer',
  },
};
