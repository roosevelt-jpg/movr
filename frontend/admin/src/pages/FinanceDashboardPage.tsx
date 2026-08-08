import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Bar, BarChart, ResponsiveContainer, Tooltip } from 'recharts';
import AdminShell from '../layouts/AdminShell';
import { adminBtn } from '../styles/adminButtons';
import { currencySymbol, formatCurrency } from '../lib/currency';

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

type Settlement = {
  id: string;
  merchant: string;
  periodStart?: string;
  periodEnd?: string;
  grossSales: number;
  platformFee: number;
  netPayout: number;
  dueDate?: string;
  status: string;
  currency?: string;
};

type Breakdown = { category: string; amount: number };

const BREAKDOWN_LABELS: Record<string, string> = {
  subscriptions: 'Subscriptions',
  merchant_fees: 'Merchant fees',
  rental: 'Rental',
  token: 'Token',
};

/** Admin finance — GMV dashboard, breakdown, settlements. */
export default function FinanceDashboardPage() {
  const [message, setMessage] = useState('');
  const [paying, setPaying] = useState<string | null>(null);
  const [currency, setCurrency] = useState('GHS');
  const [metrics, setMetrics] = useState({
    gmvMonth: 0,
    netRevenue: 0,
    pendingSettlements: 0,
    dvtDistributed: 0,
    gmvDelta: 0,
    netDelta: 0,
    dvtDelta: 0,
  });
  const [monthlyGmv, setMonthlyGmv] = useState<{ label: string; gmv: number }[]>([]);
  const [breakdown, setBreakdown] = useState<Breakdown[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);

  const load = async () => {
    try {
      const res = await axios.get(`${API}/admin/finance/dashboard`, { headers: headers() });
      const d = res.data?.data || {};
      setCurrency(d.gmvCurrency || 'GHS');
      setMetrics({
        gmvMonth: Number(d.gmvMonth || 0),
        netRevenue: Number(d.netRevenue || 0),
        pendingSettlements: Number(d.pendingSettlements || 0),
        dvtDistributed: Number(d.dvtDistributed || 0),
        gmvDelta: Number(d.gmvDelta || 0),
        netDelta: Number(d.netDelta || 0),
        dvtDelta: Number(d.dvtDelta || 0),
      });
      setMonthlyGmv(d.monthlyGmv || []);
      setBreakdown(d.revenueBreakdown || []);
      setSettlements(d.settlements || []);
      setMessage('');
    } catch (e: any) {
      setMessage(e?.response?.data?.message || e.message || 'Failed to load finance dashboard');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const chartData = useMemo(
    () => monthlyGmv.map((r) => ({ name: r.label, gmv: Number(r.gmv || 0) })),
    [monthlyGmv]
  );

  const breakdownTotal = breakdown.reduce((s, b) => s + Number(b.amount || 0), 0) || 1;

  const payOne = async (id: string) => {
    setPaying(id);
    try {
      await axios.post(`${API}/admin/finance/settlements/${id}/pay`, {}, { headers: headers() });
      await load();
      setMessage('Settlement paid');
    } catch (e: any) {
      setMessage(e?.response?.data?.message || e.message || 'Pay failed');
    } finally {
      setPaying(null);
    }
  };

  const processAll = async () => {
    setPaying('all');
    try {
      const res = await axios.post(
        `${API}/admin/finance/settlements/process-all`,
        {},
        { headers: headers() }
      );
      await load();
      setMessage(`Processed ${res.data?.data?.processed ?? 0} settlements`);
    } catch (e: any) {
      setMessage(e?.response?.data?.message || e.message || 'Process all failed');
    } finally {
      setPaying(null);
    }
  };

  const cards = [
    {
      label: 'Total GMV (month)',
      value: formatCompact(metrics.gmvMonth, currency),
      meta: metrics.gmvDelta ? `+${metrics.gmvDelta}%` : '',
    },
    {
      label: 'Net Revenue',
      value: formatCompact(metrics.netRevenue, currency),
      meta: metrics.netDelta ? `+${metrics.netDelta}%` : '',
    },
    {
      label: 'Pending Settlements',
      value: formatCompact(metrics.pendingSettlements, currency),
      meta: '',
    },
    {
      label: 'DVT Distributed',
      value: Number(metrics.dvtDistributed || 0).toLocaleString(),
      meta: metrics.dvtDelta ? `+${metrics.dvtDelta}%` : '',
    },
  ];

  const pending = settlements.filter((s) => String(s.status).toLowerCase() === 'pending');

  return (
    <AdminShell activeLabel="Transactions" hidePageTitle>
      <div style={styles.headerRow}>
        <div>
          <h1 style={styles.h1}>Finance & GMV Dashboard</h1>
          <p style={styles.sub}>Revenue, settlements, and token distribution</p>
        </div>
      </div>

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

      <div style={styles.midRow}>
        <div style={styles.panel}>
          <h2 style={styles.panelTitle}>Monthly GMV</h2>
          <div style={{ height: 240 }}>
            {chartData.length === 0 ? (
              <div style={styles.empty}>No GMV data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barCategoryGap="28%">
                  <Tooltip
                    contentStyle={{
                      background: 'var(--surface-elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                    }}
                    formatter={(v: any) => formatCompact(Number(v), currency)}
                  />
                  <Bar dataKey="gmv" fill="url(#finGmv)" radius={[6, 6, 0, 0]} />
                  <defs>
                    <linearGradient id="finGmv" x1="0" y1="0" x2="0" y2="1">
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
          <h2 style={styles.panelTitle}>Revenue Breakdown</h2>
          <div style={styles.breakdownList}>
            {breakdown.length === 0 ? (
              <p style={styles.emptyInline}>No breakdown data</p>
            ) : (
              breakdown.map((b) => {
                const pct = Math.round((Number(b.amount) / breakdownTotal) * 100);
                return (
                  <div key={b.category} style={styles.breakdownRow}>
                    <div style={styles.breakdownHead}>
                      <span>{BREAKDOWN_LABELS[b.category] || b.category}</span>
                      <strong>{pct}%</strong>
                    </div>
                    <div style={styles.progressTrack}>
                      <div style={{ ...styles.progressFill, width: `${pct}%` }} />
                    </div>
                    <div style={styles.breakdownAmt}>{formatCurrency(b.amount, currency)}</div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div style={styles.panel}>
        <div style={styles.settleHeader}>
          <h2 style={{ ...styles.panelTitle, margin: 0 }}>Pending Merchant Settlements</h2>
          <button
            type="button"
            style={styles.primaryBtn}
            onClick={processAll}
            disabled={paying === 'all' || pending.length === 0}
          >
            {paying === 'all' ? 'Processing…' : 'Process All'}
          </button>
        </div>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Merchant</th>
              <th style={styles.th}>Period</th>
              <th style={styles.th}>Gross</th>
              <th style={styles.th}>Fee</th>
              <th style={styles.th}>Net Payout</th>
              <th style={styles.th}>Due</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th} />
            </tr>
          </thead>
          <tbody>
            {settlements.length === 0 ? (
              <tr>
                <td colSpan={8} style={styles.tdMuted}>
                  No settlements
                </td>
              </tr>
            ) : (
              settlements.map((s) => (
                <tr key={s.id}>
                  <td style={styles.td}>{s.merchant}</td>
                  <td style={styles.td}>
                    {s.periodStart ? new Date(s.periodStart).toLocaleDateString() : '—'}
                    {s.periodEnd ? ` – ${new Date(s.periodEnd).toLocaleDateString()}` : ''}
                  </td>
                  <td style={styles.td}>{formatCurrency(s.grossSales, s.currency || currency)}</td>
                  <td style={styles.td}>{formatCurrency(s.platformFee, s.currency || currency)}</td>
                  <td style={styles.td}>{formatCurrency(s.netPayout, s.currency || currency)}</td>
                  <td style={styles.td}>
                    {s.dueDate ? new Date(s.dueDate).toLocaleDateString() : '—'}
                  </td>
                  <td style={styles.td}>
                    <span style={styles.statusPill}>{s.status}</span>
                  </td>
                  <td style={styles.td}>
                    {String(s.status).toLowerCase() === 'pending' ? (
                      <button
                        type="button"
                        style={styles.payBtn}
                        disabled={paying === s.id}
                        onClick={() => payOne(s.id)}
                      >
                        {paying === s.id ? '…' : 'Pay Now'}
                      </button>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}

const styles: Record<string, React.CSSProperties> = {
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  h1: { fontSize: 28, fontWeight: 700, margin: 0 },
  sub: { color: 'var(--text-secondary)', marginTop: 6, marginBottom: 0 },
  message: { color: 'var(--success)', marginBottom: 12 },
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
  midRow: {
    display: 'grid',
    gridTemplateColumns: '1.3fr 1fr',
    gap: 12,
    marginBottom: 16,
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
  emptyInline: { color: 'var(--text-secondary)', margin: 0 },
  breakdownList: { display: 'flex', flexDirection: 'column', gap: 14 },
  breakdownRow: { display: 'flex', flexDirection: 'column', gap: 6 },
  breakdownHead: {
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
  breakdownAmt: { fontSize: 12, color: 'var(--text-secondary)' },
  settleHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  primaryBtn: { ...adminBtn.primary },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left',
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontWeight: 600,
    padding: '10px 8px',
    borderBottom: '1px solid var(--border)',
  },
  td: {
    padding: '12px 8px',
    borderBottom: '1px solid var(--border)',
    fontSize: 13,
  },
  tdMuted: {
    padding: '20px 8px',
    color: 'var(--text-secondary)',
    textAlign: 'center',
  },
  statusPill: {
    display: 'inline-block',
    padding: '3px 8px',
    borderRadius: 999,
    background: 'rgba(142,45,226,0.2)',
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'capitalize',
  },
  payBtn: {
    border: '1px solid #8E2DE2',
    borderRadius: 8,
    padding: '6px 10px',
    background: 'rgba(142,45,226,0.2)',
    color: 'var(--text-primary)',
    fontWeight: 700,
    fontSize: 12,
    cursor: 'pointer',
  },
};
