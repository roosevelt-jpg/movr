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

/** Admin finance — GMV charts, payout review/approve, reconciliation (Phase 18). */
export default function FinanceDashboardPage() {
  const [gmv, setGmv] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [batch, setBatch] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [limits, setLimits] = useState<any>(null);
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
      const currency = rows[0]?.currency || rows[0]?.currency_code || 'GHS';
      setMetrics((m) => ({ ...m, gmv30: sum, gmvCurrency: currency }));
    }
  };

  const loadBatches = async () => {
    const res = await axios.get(`${API}/admin/finance/payout-batches`, { headers: headers() });
    setBatches(res.data.data || []);
  };

  const loadLimits = async () => {
    const res = await axios.get(`${API}/wallet/transfer/limits`, { headers: headers() });
    setLimits(res.data.data || null);
  };

  useEffect(() => {
    load().catch((e) => setMessage(e.message));
    loadBatches().catch(() => undefined);
    loadLimits().catch(() => undefined);
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
    setMessage('Payout batch ready for review');
    await loadBatches();
  };

  const executeBatch = async (id: string) => {
    const res = await axios.post(
      `${API}/admin/finance/payout-batches/${id}/execute`,
      { countryCode: 'GH' },
      { headers: headers() }
    );
    setBatch(res.data.data);
    setMessage(`Batch ${id.slice(0, 8)} executed`);
    await loadBatches();
  };

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
                <CartesianGrid stroke="var(--surface-elevated)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-secondary)" />
                <YAxis stroke="var(--text-secondary)" hide />
                <Tooltip
                  contentStyle={{ background: 'var(--surface-elevated)', border: '1px solid var(--border)' }}
                />
                <Bar dataKey="gmv" fill="url(#gmvGrad)" radius={[6, 6, 0, 0]} />
                <defs>
                  <linearGradient id="gmvGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--electric-violet)" />
                    <stop offset="100%" stopColor="var(--motion-blue)" />
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {message ? <p style={{ color: 'var(--success)' }}>{message}</p> : null}

      <div style={styles.actions}>
        <button style={styles.btn} onClick={() => exportCsv().catch((e) => setMessage(e.message))}>
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

      <div style={styles.batchList}>
        <div style={styles.label}>Payout batches</div>
        {batches.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)' }}>No batches yet</p>
        ) : (
          batches.map((b) => (
            <div key={b.id} style={styles.batchRow}>
              <div>
                <strong>{String(b.id).slice(0, 8)}</strong> · {b.status} ·{' '}
                {formatCurrency(Number(b.total_amount || 0), b.currency || metrics.gmvCurrency)}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  style={styles.btnGhost}
                  onClick={() =>
                    axios
                      .get(`${API}/admin/finance/payout-batches/${b.id}`, { headers: headers() })
                      .then((r) => setBatch(r.data.data))
                  }
                >
                  Review
                </button>
                {b.status !== 'completed' ? (
                  <button style={styles.btn} onClick={() => executeBatch(b.id)}>
                    Approve &amp; execute
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}
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
          {batch.status !== 'completed' ? (
            <button style={{ ...styles.btn, marginTop: 12 }} onClick={() => executeBatch(batch.id)}>
              Approve &amp; execute
            </button>
          ) : null}
        </div>
      ) : null}

      <div style={styles.batchList}>
        <div style={styles.label}>Cross-border transfer limits (Phase 27)</div>
        {limits ? (
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            {(
              [
                ['max_per_tx', 'Max per transfer'],
                ['max_per_day', 'Max per day'],
                ['requires_identity_linked_above', 'Requires Identity-Linked above'],
                ['fee_percent', 'Fee %'],
                ['fee_flat', 'Fee flat'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ width: 220, color: 'var(--text-secondary)', fontSize: 13 }}>{label}</span>
                <input
                  style={{
                    flex: 1,
                    padding: 8,
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--pure-white)',
                  }}
                  value={String(limits[key] ?? '')}
                  onChange={(e) => setLimits({ ...limits, [key]: e.target.value })}
                />
              </label>
            ))}
            <button
              style={styles.btn}
              onClick={() =>
                axios
                  .put(
                    `${API}/wallet/transfer/limits`,
                    {
                      maxPerTx: Number(limits.max_per_tx),
                      maxPerDay: Number(limits.max_per_day),
                      requiresIdentityLinkedAbove: Number(limits.requires_identity_linked_above),
                      feePercent: Number(limits.fee_percent),
                      feeFlat: Number(limits.fee_flat),
                      reason: 'Admin transfer limits update',
                    },
                    { headers: headers() }
                  )
                  .then((r) => {
                    setLimits(r.data.data);
                    setMessage('Transfer limits saved');
                  })
                  .catch((e) => setMessage(e.response?.data?.message || e.message))
              }
            >
              Save transfer limits
            </button>
          </div>
        ) : (
          <p style={{ color: 'var(--text-secondary)' }}>Limits unavailable</p>
        )}
      </div>
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
    background: 'var(--surface-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: 16,
  },
  label: { color: 'var(--text-secondary)', fontSize: 13 },
  value: { fontSize: 28, fontWeight: 700, marginTop: 8 },
  chartCard: {
    background: 'var(--surface-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  emptyChart: {
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-secondary)',
  },
  actions: { display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 },
  btn: {
    border: 'none',
    borderRadius: 10,
    padding: '10px 14px',
    background: 'var(--motion-blue)',
    color: 'var(--pure-white)',
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnGhost: {
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '10px 14px',
    background: 'transparent',
    color: 'var(--pure-white)',
    fontWeight: 600,
    cursor: 'pointer',
  },
  batchList: {
    background: 'var(--surface-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  batchRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    padding: '10px 0',
    borderBottom: '1px solid var(--border)',
    flexWrap: 'wrap',
  },
  batch: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: 16,
  },
};
