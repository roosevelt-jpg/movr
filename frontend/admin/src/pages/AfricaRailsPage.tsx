import React, { useEffect, useState } from 'react';
import axios from 'axios';
import AdminShell from '../layouts/AdminShell';
import AdminOpsNav from '../components/AdminOpsNav';
import { API } from '../lib/apiBase';

const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}` });

/** Africa mobility rails — credit, pools, corridors, remittance, agent float. */
export default function AfricaRailsPage() {
  const [overview, setOverview] = useState<any>(null);
  const [corridors, setCorridors] = useState<any[]>([]);
  const [pools, setPools] = useState<any[]>([]);
  const [remits, setRemits] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any>(null);
  const [error, setError] = useState('');
  const [floatAgentId, setFloatAgentId] = useState('');
  const [floatAmt, setFloatAmt] = useState('500');
  const [msg, setMsg] = useState('');

  const load = async () => {
    try {
      const [o, c, cat, p, r, a] = await Promise.all([
        axios.get(`${API}/admin/rails/overview`, { headers: headers() }),
        axios.get(`${API}/admin/rails/corridors`, { headers: headers() }),
        axios.get(`${API}/rails/catalog?countryCode=GH`),
        axios.get(`${API}/admin/rails/share-pools`, { headers: headers() }).catch(() => ({ data: { data: [] } })),
        axios.get(`${API}/admin/rails/remittance-corridors`, { headers: headers() }).catch(() => ({ data: { data: [] } })),
        axios.get(`${API}/admin/rails/agent-float`, { headers: headers() }).catch(() => ({ data: { data: [] } })),
      ]);
      setOverview(o.data?.data || null);
      setCorridors(c.data?.data || []);
      setCatalog(cat.data?.data || null);
      setPools(p.data?.data || []);
      setRemits(r.data?.data || []);
      const agentRows = a.data?.data || [];
      setAgents(agentRows);
      if (agentRows[0] && !floatAgentId) setFloatAgentId(agentRows[0].id);
      setError('');
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Failed to load rails');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const topUpFloat = async () => {
    try {
      await axios.post(
        `${API}/admin/rails/agent-float/topup`,
        { agentId: floatAgentId, amount: Number(floatAmt) },
        { headers: headers() }
      );
      setMsg('Agent float topped up');
      await load();
    } catch (e: any) {
      setMsg(e?.response?.data?.message || e.message || 'Float top-up failed');
    }
  };

  return (
    <AdminShell activeLabel="Africa rails" hidePageTitle>
      <AdminOpsNav />
      <h1 style={styles.h1}>Africa mobility rails</h1>
      <p style={styles.sub}>
        Wallet credit · share pools · MoMo top-ups · agent float · city polygons · remittance gifts ·
        channel booking
      </p>
      {error ? <p style={{ color: 'var(--danger)' }}>{error}</p> : null}
      {msg ? <p style={{ color: 'var(--success, #16a34a)' }}>{msg}</p> : null}

      {overview ? (
        <div style={styles.stats}>
          {[
            ['Mobility credit issued', overview.mobilityCreditIssued],
            ['Active guarantees', overview.activeGuarantees],
            ['Pending ride gifts', overview.pendingGifts],
            ['City corridors', overview.activeCorridors],
            ['Share pools open', overview.openSharePools],
            ['Remittance corridors', overview.remittanceCorridors],
            ['Agent float total', overview.agentFloatTotal],
            ['Channel events (24h)', overview.channelEvents24h],
          ].map(([label, val]) => (
            <div key={String(label)} style={styles.stat}>
              <div style={styles.statLabel}>{label}</div>
              <div style={styles.statVal}>{val}</div>
            </div>
          ))}
        </div>
      ) : null}

      {catalog ? (
        <div style={styles.panel}>
          <h2 style={styles.h2}>Live catalog</h2>
          <p style={styles.meta}>
            Channels: {(catalog.channels || []).join(', ')} · Rails:{' '}
            {(catalog.rails || []).join(' · ')} · Zero take-rate:{' '}
            {catalog.zeroTakeRate ? 'yes' : 'no'}
          </p>
          <div style={styles.chips}>
            {(catalog.vehicles || []).slice(0, 8).map((v: any) => (
              <span key={v.code} style={styles.chip}>
                {v.africaLabel || v.name}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div style={styles.panel}>
        <h2 style={styles.h2}>City co-op corridors</h2>
        {corridors.length === 0 ? (
          <p style={styles.meta}>No corridors yet</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                {['Name', 'City', 'Max rider fare', 'Driver min', 'Polygon', 'Municipal'].map((h) => (
                  <th key={h} style={styles.th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {corridors.map((c) => (
                <tr key={c.id}>
                  <td style={styles.td}>{c.name}</td>
                  <td style={styles.td}>
                    {c.city} ({c.country_code})
                  </td>
                  <td style={styles.td}>{c.max_rider_fare}</td>
                  <td style={styles.td}>{c.driver_min_payout}</td>
                  <td style={styles.td}>{c.origin_polygon ? 'yes' : 'radius'}</td>
                  <td style={styles.td}>{c.municipal_code || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={styles.panel}>
        <h2 style={styles.h2}>Share pools</h2>
        {pools.length === 0 ? (
          <p style={styles.meta}>No active pools</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                {['Status', 'Riders', 'Country', 'Created'].map((h) => (
                  <th key={h} style={styles.th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pools.slice(0, 15).map((p) => (
                <tr key={p.id}>
                  <td style={styles.td}>{p.status}</td>
                  <td style={styles.td}>
                    {p.rider_count}/{p.max_riders}
                  </td>
                  <td style={styles.td}>{p.country_code}</td>
                  <td style={styles.td}>{String(p.created_at || '').slice(0, 19)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={styles.panel}>
        <h2 style={styles.h2}>Remittance corridors</h2>
        {remits.length === 0 ? (
          <p style={styles.meta}>None seeded</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                {['Name', 'FX', 'Fee %', 'Range'].map((h) => (
                  <th key={h} style={styles.th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {remits.map((r) => (
                <tr key={r.id}>
                  <td style={styles.td}>{r.name}</td>
                  <td style={styles.td}>
                    {r.fx_rate} {r.currency_from}→{r.currency_to}
                  </td>
                  <td style={styles.td}>{r.fee_percent}%</td>
                  <td style={styles.td}>
                    {r.min_amount}–{r.max_amount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={styles.panel}>
        <h2 style={styles.h2}>Cash agent float</h2>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <select
            value={floatAgentId}
            onChange={(e) => setFloatAgentId(e.target.value)}
            style={{ padding: 8, minWidth: 180 }}
          >
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} · {a.float_balance}
              </option>
            ))}
          </select>
          <input
            value={floatAmt}
            onChange={(e) => setFloatAmt(e.target.value)}
            style={{ padding: 8, width: 100 }}
            type="number"
          />
          <button type="button" onClick={topUpFloat} style={styles.btn}>
            Top up float
          </button>
        </div>
        {agents.slice(0, 10).map((a) => (
          <p key={a.id} style={styles.meta}>
            {a.name} ({a.city}) — float {a.float_balance} {a.currency || 'GHS'}
          </p>
        ))}
      </div>
    </AdminShell>
  );
}

const styles: Record<string, React.CSSProperties> = {
  h1: { margin: 0, fontSize: 28, color: 'var(--text-primary)' },
  sub: { color: 'var(--text-secondary)', marginTop: 8, marginBottom: 20 },
  h2: { margin: '0 0 12px', fontSize: 18, color: 'var(--text-primary)' },
  stats: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 },
  stat: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 14,
  },
  statLabel: { fontSize: 12, color: 'var(--text-secondary)' },
  statVal: { fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 },
  panel: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  meta: { color: 'var(--text-secondary)', fontSize: 13, margin: '0 0 12px' },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  chip: {
    padding: '6px 10px',
    borderRadius: 999,
    background: 'var(--bg-muted)',
    color: 'var(--text-primary)',
    fontSize: 12,
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left',
    fontSize: 12,
    color: 'var(--text-secondary)',
    padding: '8px 6px',
    borderBottom: '1px solid var(--border)',
  },
  td: { padding: '10px 6px', borderBottom: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 13 },
  btn: {
    padding: '8px 14px',
    borderRadius: 8,
    border: 'none',
    background: 'var(--accent, #4f46e5)',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer',
  },
};
