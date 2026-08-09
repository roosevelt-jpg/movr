import React, { useEffect, useState } from 'react';
import axios from 'axios';
import AdminShell from '../layouts/AdminShell';
import AdminOpsNav from '../components/AdminOpsNav';
import { API } from '../lib/apiBase';

const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}` });

/** Africa mobility rails — credit, guarantees, corridors, remittance gifts overview. */
export default function AfricaRailsPage() {
  const [overview, setOverview] = useState<any>(null);
  const [corridors, setCorridors] = useState<any[]>([]);
  const [catalog, setCatalog] = useState<any>(null);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const [o, c, cat] = await Promise.all([
        axios.get(`${API}/admin/rails/overview`, { headers: headers() }),
        axios.get(`${API}/admin/rails/corridors`, { headers: headers() }),
        axios.get(`${API}/rails/catalog?countryCode=GH`),
      ]);
      setOverview(o.data?.data || null);
      setCorridors(c.data?.data || []);
      setCatalog(cat.data?.data || null);
      setError('');
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Failed to load rails');
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <AdminShell activeLabel="Africa rails" hidePageTitle>
      <AdminOpsNav />
      <h1 style={styles.h1}>Africa mobility rails</h1>
      <p style={styles.sub}>
        Wallet credit · channel-first booking · driver income floors · city corridors · family remittance gifts ·
        portable trust scores
      </p>
      {error ? <p style={{ color: 'var(--danger)' }}>{error}</p> : null}

      {overview ? (
        <div style={styles.stats}>
          {[
            ['Mobility credit issued', overview.mobilityCreditIssued],
            ['Active guarantees', overview.activeGuarantees],
            ['Pending ride gifts', overview.pendingGifts],
            ['City corridors', overview.activeCorridors],
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
                {['Name', 'City', 'Max rider fare', 'Driver min', 'Municipal'].map((h) => (
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
                  <td style={styles.td}>{c.municipal_code || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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
};
