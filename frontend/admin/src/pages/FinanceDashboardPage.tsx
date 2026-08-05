import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import AdminShell from '../layouts/AdminShell';
import { formatCurrency } from '../lib/currency';

const API = process.env.REACT_APP_API_URL || '/api/v1';

function headers() {
  return { Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}` };
}

/** Admin finance — KPI cards, GMV chart, export CSV (keeps payout batch APIs). */
export default function FinanceDashboardPage() {
  const [gmv, setGmv] = useState<any[]>([]);
  const [batch, setBatch] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [metrics, setMetrics] = useState({
    gmv30: 0,
    gmvCurrency: 'GHS',
    subscriptions: 0,
    pendingPayouts: 0,
    countries: 0,
  });

  const load = async () => {
    const res = await axios.get(`${API}/admin/finance/gmv`, { headers: headers() });
    setGmv(res.data.data || []);
    const rows = res.data.data || [];
    if (rows.length) {
      const sum = rows.reduce((s: number, r: any) => s + Number(r.gmv_amount || 0), 0);
      const currency = rows[0]?.currency || 'GHS';
      setMetrics((m) => ({ ...m, gmv30: sum, gmvCurrency: currency }));
    }
  };

  useEffect(() => {
    load().catch((e) => setMessage(e.message));
    axios
      .get(`${API}/admin/finance/summary`, { headers: headers() })
      .then((res) => {
        if (res.data?.data) setMetrics((m) => ({ ...m, ...res.data.data }));
      })
      .catch(() => undefined);
  }, []);

  const createBatch = async () => {
    const end = new Date();
    const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const res = await axios.post(
      `${API}/admin/finance/payout-batches`,
      {
        recipientType: 'driver',
        periodStart: start.toISOString(),
        periodEnd: end.toISOString(),
      },
      { headers: headers() }
    );
    setBatch(res.data.data);
    setMessage('Payout batch ready');
  };

  const exportCsv = () => {
    const to = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    window.open(
      `${API}/admin/finance/reconciliation?format=csv&from=${from}&to=${to}`,
      '_blank'
    );
  };

  const chartData = useMemo(() => {
    if (!gmv.length) return [];
    return gmv.slice(-7).map((r) => ({
      name: String(r.date || r.day || '').slice(5),
      gmv: Number(r.gmv_amount),
    }));
  }, [gmv]);

  const fmt = (n: number, currency = metrics.gmvCurrency || 'GHS') =>
    formatCurrency(Number(n) || 0, currency);

  return (
    <AdminShell activeLabel="Finance">
      <div style={styles.cards}>
        {[
          { label: 'GMV (30d)', value: fmt(metrics.gmv30) },
          { label: 'Subscriptions', value: fmt(metrics.subscriptions) },
          { label: 'Pending payouts', value: fmt(metrics.pendingPayouts) },
          { label: 'Active countries', value: String(metrics.countries) },
        ].map((c) => (
          <div key={c.label} style={styles.card}>
            <div style={styles.label}>{c.label}</div>
            <div style={styles.value}>{c.value}</div>
          </div>
        ))}
      </div>

      <div style={styles.chartCard}>
        <div style={styles.label}>GMV by day</div>
        <div style={{ height: 260, marginTop: 12 }}>
          {chartData.length === 0 ? (
            <div style={styles.emptyChart}>No GMV data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid stroke="#1A1A1A" vertical={false} />
                <XAxis dataKey="name" stroke="#666" />
                <YAxis stroke="#666" hide />
                <Tooltip
                  contentStyle={{ background: '#121212', border: '1px solid #2A2A2A' }}
                />
                <Bar dataKey="gmv" fill="url(#gmvGrad)" radius={[6, 6, 0, 0]} />
                <defs>
                  <linearGradient id="gmvGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6A00FF" />
                    <stop offset="100%" stopColor="#0055FF" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {message ? <p style={{ color: '#00D97A' }}>{message}</p> : null}

      <div style={styles.actions}>
        <button style={styles.btn} onClick={exportCsv}>
          ↓ Export reconciliation CSV
        </button>
        <button style={styles.btnGhost} onClick={createBatch}>
          Create driver payout batch
        </button>
        <button
          style={styles.btnGhost}
          onClick={() =>
            axios.post(`${API}/admin/finance/rollup`, {}, { headers: headers() }).then(load)
          }
        >
          Run GMV rollup
        </button>
      </div>

      {batch ? (
        <div style={styles.batch}>
          <strong>Batch {batch.id?.slice?.(0, 8)}</strong>
          <div>Status: {batch.status}</div>
          <div>
            Total:{' '}
            {formatCurrency(
              Number(batch.total_amount),
              batch.currency || metrics.gmvCurrency || 'GHS'
            )}
          </div>
          <div>Items: {batch.items?.length || 0}</div>
        </div>
      ) : null}
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
    background: '#121212',
    border: '1px solid #2A2A2A',
    borderRadius: 14,
    padding: 16,
  },
  label: { color: '#A0A0A0', fontSize: 13 },
  value: { fontSize: 28, fontWeight: 700, marginTop: 8 },
  chartCard: {
    background: '#121212',
    border: '1px solid #2A2A2A',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  emptyChart: {
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#888',
  },
  actions: { display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 },
  btn: {
    background: 'linear-gradient(90deg, #3F7048 0%, #6A00FF 50%, #0055FF 100%)',
    border: 'none',
    color: '#fff',
    borderRadius: 999,
    padding: '12px 18px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  btnGhost: {
    background: 'transparent',
    border: '1px solid #2A2A2A',
    color: '#fff',
    borderRadius: 999,
    padding: '12px 18px',
    cursor: 'pointer',
  },
  batch: {
    border: '1px solid #2A2A2A',
    borderRadius: 12,
    padding: 16,
    background: '#121212',
  },
};
