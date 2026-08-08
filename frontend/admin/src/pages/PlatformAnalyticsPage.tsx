import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import AdminShell from '../layouts/AdminShell';
import { adminBtn } from '../styles/adminButtons';

const API = process.env.REACT_APP_API_URL || '/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}` });

function formatCompact(n: number) {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return v.toLocaleString();
}

function formatMoney(n: number) {
  return `₦${Math.round(Number(n) || 0).toLocaleString()}`;
}

function Delta({ n }: { n: number }) {
  const up = n >= 0;
  return (
    <span style={{ color: up ? '#4ade80' : '#f87171', fontSize: 12 }}>
      {up ? '+' : ''}
      {n}%
    </span>
  );
}

function isoDate(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

/** Platform Analytics — growth, GMV, cities, acquisition, key metrics. */
export default function PlatformAnalyticsPage() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [from, setFrom] = useState(() => isoDate(new Date(Date.now() - 30 * 86400000)));
  const [to, setTo] = useState(() => isoDate());
  const [showRange, setShowRange] = useState(false);

  const load = async (range = { from, to }) => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.get(`${API}/admin/analytics`, {
        headers: headers(),
        params: { from: range.from || undefined, to: range.to || undefined },
      });
      setData(res.data?.data || null);
      if (res.data?.data?.range?.from) setFrom(String(res.data.data.range.from).slice(0, 10));
      if (res.data?.data?.range?.to) setTo(String(res.data.data.range.to).slice(0, 10));
    } catch (e: any) {
      setData(null);
      setError(e?.response?.data?.message || e.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const kpis = data?.kpis || {};
  const annual = Array.isArray(data?.annualGmv) ? data.annualGmv : [];
  const maxGmv = useMemo(() => {
    const vals = annual.map((m: any) => Number(m.gmv || 0));
    return vals.length ? Math.max(...vals, 1) : 1;
  }, [annual]);
  const growth = Array.isArray(data?.userGrowth) ? data.userGrowth : [];
  const cities = Array.isArray(data?.topCities) ? data.topCities : [];
  const acq = Array.isArray(data?.acquisition) ? data.acquisition : [];
  const keys = data?.keyMetrics || {};

  const exportReport = () => {
    const blob = new Blob([JSON.stringify(data || {}, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `platform-analytics-${from}_${to}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminShell activeLabel="Analytics" hidePageTitle>
      <div style={styles.headerRow}>
        <div style={{ minWidth: 0 }}>
          <h1 style={styles.h1}>Platform Analytics</h1>
          <p style={styles.sub}>Growth trends and user behaviour.</p>
        </div>
        <div style={styles.actions} className="admin-actions">
          <button
            type="button"
            className="admin-btn"
            style={adminBtn.secondary}
            onClick={() => setShowRange((v) => !v)}
          >
            Set Date Range
          </button>
          <button
            type="button"
            className="admin-btn"
            style={adminBtn.primary}
            onClick={exportReport}
            disabled={!data}
          >
            Export Report
          </button>
        </div>
      </div>

      {showRange ? (
        <div style={styles.rangeBar} className="admin-actions">
          <label style={styles.rangeLabel}>
            From
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              style={styles.dateInput}
            />
          </label>
          <label style={styles.rangeLabel}>
            To
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              style={styles.dateInput}
            />
          </label>
          <button
            type="button"
            className="admin-btn"
            style={adminBtn.primary}
            disabled={loading}
            onClick={() => load({ from, to })}
          >
            {loading ? 'Loading…' : 'Apply'}
          </button>
          <button
            type="button"
            className="admin-btn"
            style={adminBtn.ghost}
            onClick={() => {
              const next = {
                from: isoDate(new Date(Date.now() - 30 * 86400000)),
                to: isoDate(),
              };
              setFrom(next.from);
              setTo(next.to);
              load(next);
            }}
          >
            Last 30 days
          </button>
        </div>
      ) : null}

      {error ? (
        <p style={styles.error}>
          {error}{' '}
          <button type="button" className="admin-btn" style={adminBtn.ghost} onClick={() => load()}>
            Retry
          </button>
        </p>
      ) : null}
      {loading && !data ? <p style={styles.muted}>Loading analytics…</p> : null}

      <div style={styles.kpiRow}>
        {[
          { label: 'Monthly Active Users', value: formatCompact(kpis.mau || 0), d: kpis.mauDelta },
          { label: 'Monthly GMV', value: formatMoney(kpis.monthlyGmv || 0), d: kpis.gmvDelta },
          { label: 'Rides / Day Avg', value: String(kpis.ridesPerDay || 0), d: kpis.ridesDelta },
          { label: 'Retention Rate', value: `${kpis.retention || 0}%`, d: kpis.retentionDelta },
        ].map((c) => (
          <div key={c.label} style={styles.kpi}>
            <div style={styles.label}>{c.label}</div>
            <div style={styles.kpiValueRow}>
              <span style={styles.kpiValue}>{c.value}</span>
              <Delta n={Number(c.d || 0)} />
            </div>
          </div>
        ))}
      </div>

      <div style={styles.midRow}>
        <div style={{ ...styles.card, flex: 2 }}>
          <h2 style={styles.h2}>Annual GMV</h2>
          <div style={styles.bars}>
            {annual.map((m: any, i: number) => {
              const v = Number(m.gmv || 0);
              const peak = v === maxGmv && v > 0;
              return (
                <div key={m.month || i} style={styles.barCol}>
                  <div
                    style={{
                      ...styles.bar,
                      height: `${Math.max(6, (v / maxGmv) * 100)}%`,
                      background: peak
                        ? 'var(--movr-gradient)'
                        : 'rgba(139, 92, 246, 0.45)',
                    }}
                    title={`${m.month}: ${formatMoney(v)}`}
                  />
                  <span style={styles.barLabel}>{m.label}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ ...styles.card, flex: 1 }}>
          <h2 style={styles.h2}>User Growth</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
            {growth.length === 0 ? (
              <p style={styles.muted}>No growth data.</p>
            ) : (
              growth.map((g: any) => (
                <div key={g.quarter} style={styles.growthRow}>
                  <span style={styles.muted}>{g.quarter}</span>
                  <strong style={{ color: 'var(--text-primary)' }}>
                    +{Number(g.added || 0).toLocaleString()}
                  </strong>
                </div>
              ))
            )}
            <div style={{ ...styles.growthRow, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <span style={styles.muted}>Total Users</span>
              <strong style={{ color: 'var(--text-primary)' }}>
                {Number(data?.totalUsers || 0).toLocaleString()}
              </strong>
            </div>
          </div>
        </div>
      </div>

      <div style={styles.bottomRow}>
        <div style={styles.card}>
          <h2 style={styles.h2}>Top Cities</h2>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {cities.length === 0 ? <p style={styles.muted}>No city data.</p> : null}
            {cities.map((c: any, i: number) => (
              <div key={c.city}>
                <div style={styles.growthRow}>
                  <span style={{ color: 'var(--text-primary)' }}>
                    {i + 1}. {c.city}
                  </span>
                  <span style={styles.muted}>{c.volumeK}K</span>
                </div>
                <div style={styles.track}>
                  <div style={{ ...styles.fill, width: `${c.pct || 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={styles.card}>
          <h2 style={styles.h2}>Acquisition Channels</h2>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {acq.map((a: any) => (
              <div key={a.channel}>
                <div style={styles.growthRow}>
                  <span style={{ color: 'var(--text-primary)' }}>{a.channel}</span>
                  <span style={styles.muted}>{a.pct}%</span>
                </div>
                <div style={styles.track}>
                  <div style={{ ...styles.fillBlue, width: `${a.pct || 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={styles.card}>
          <h2 style={styles.h2}>Key Metrics</h2>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { label: 'Avg session', value: `${keys.avgSessionMin || 0} min` },
              { label: 'Rides/user/mo', value: String(keys.ridesPerUserMo || 0) },
              { label: 'DVT claim rate', value: `${keys.dvtClaimRate || 0}%` },
              { label: 'Merchant NPS', value: `+${keys.merchantNps || 0}`, green: true },
              { label: 'Driver NPS', value: `+${keys.driverNps || 0}`, green: true },
            ].map((row) => (
              <div key={row.label} style={styles.growthRow}>
                <span style={styles.muted}>{row.label}</span>
                <strong style={{ color: row.green ? '#4ade80' : 'var(--text-primary)' }}>{row.value}</strong>
              </div>
            ))}
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
    gap: 12,
    flexWrap: 'wrap',
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  h1: { margin: 0, fontSize: 28, color: 'var(--text-primary)' },
  h2: { margin: 0, fontSize: 16, color: 'var(--text-primary)' },
  sub: { margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: 14 },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  rangeBar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'flex-end',
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'var(--surface-elevated)',
  },
  rangeLabel: { display: 'grid', gap: 4, fontSize: 12, color: 'var(--text-secondary)' },
  dateInput: {
    padding: '5px 8px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-primary)',
    fontSize: 12,
    minHeight: 28,
  },
  error: { color: 'var(--error)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  muted: { color: 'var(--text-secondary)', fontSize: 13 },
  label: { color: 'var(--text-secondary)', fontSize: 12 },
  kpiRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 12,
    marginBottom: 16,
  },
  kpi: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: 16,
  },
  kpiValueRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'end', marginTop: 8, gap: 8 },
  kpiValue: { fontSize: 26, fontWeight: 700, color: 'var(--text-primary)' },
  midRow: { display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' },
  bottomRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 16,
  },
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: 16,
    minWidth: 0,
  },
  bars: { display: 'flex', alignItems: 'end', gap: 8, height: 160, marginTop: 16 },
  barCol: {
    flex: 1,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'end',
    alignItems: 'center',
    gap: 6,
  },
  bar: { width: '100%', borderRadius: '6px 6px 0 0' },
  barLabel: { fontSize: 11, color: 'var(--text-secondary)' },
  growthRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  track: { height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden', marginTop: 6 },
  fill: { height: '100%', background: 'var(--movr-gradient)', borderRadius: 99 },
  fillBlue: { height: '100%', background: '#3b82f6', borderRadius: 99 },
};
