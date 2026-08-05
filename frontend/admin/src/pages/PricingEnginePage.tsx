import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import AdminShell from '../layouts/AdminShell';

const API = process.env.REACT_APP_API_URL || '/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}` });

/** Admin pricing engine — active zones table matching mockup. */
export default function PricingEnginePage() {
  const [zones, setZones] = useState<any[]>([]);
  const [factors, setFactors] = useState<any[]>([]);
  const [breakdown, setBreakdown] = useState<any>(null);
  const [eventForm, setEventForm] = useState({
    zoneId: '',
    name: '',
    startsAt: '',
    endsAt: '',
    multiplier: '1.2',
  });

  const load = async () => {
    const [z, f, b] = await Promise.all([
      axios.get(`${API}/admin/pricing/zones`, { headers: headers() }),
      axios.get(`${API}/admin/pricing/factors`, { headers: headers() }),
      axios.get(`${API}/admin/pricing/breakdown?lat=5.6037&lng=-0.187`, { headers: headers() }),
    ]);
    setZones(z.data.data || []);
    setFactors(f.data.data || []);
    setBreakdown(b.data.data);
    if (z.data.data?.[0]) setEventForm((e) => ({ ...e, zoneId: z.data.data[0].id }));
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  const rows = useMemo(() => {
    return zones.map((z) => {
      const zoneFactors = factors.filter((f) => f.zone_id === z.id || !f.zone_id);
      const byType = (t: string) =>
        Number(zoneFactors.find((f) => f.factor_type === t)?.multiplier || 1);
      const demand = byType('demand') || 1;
      const time = byType('time_of_day') || byType('rush') || 1;
      const weather = byType('weather') || 1;
      const combined = Math.min(
        Number(z.max_surge_cap || 2),
        Number((demand * time * weather).toFixed(2))
      );
      return {
        zone: z.name,
        demand,
        time,
        weather,
        combined,
        cap: Number(z.max_surge_cap || 2),
      };
    });
  }, [zones, factors]);

  const toggle = async (id: string, isActive: boolean) => {
    await axios.patch(`${API}/admin/pricing/factors/${id}`, { isActive }, { headers: headers() });
    await load();
  };

  const addEvent = async () => {
    await axios.post(
      `${API}/admin/pricing/events`,
      { ...eventForm, multiplier: Number(eventForm.multiplier) },
      { headers: headers() }
    );
    await load();
  };

  const combinedTone = (n: number) =>
    n >= 1.4
      ? { background: 'rgba(63,112,72,0.35)', color: '#9BE0A8' }
      : { background: 'rgba(255,184,0,0.2)', color: '#FFB800' };

  return (
    <AdminShell activeLabel="Pricing engine">
      <div style={styles.headerRow}>
        <h1 style={styles.h1}>Active pricing zones</h1>
        <div style={styles.headerActions}>
          <button style={styles.region}>Region: Accra</button>
          <button style={styles.newZone}>+ New zone</button>
        </div>
      </div>

      {breakdown ? (
        <p style={styles.live}>
          Live Accra: demand {breakdown.demandMultiplier}x · time {breakdown.timeMultiplier}x ·
          weather {breakdown.weatherMultiplier}x → <strong>{breakdown.finalMultiplier}x</strong>
          {breakdown.reasonSummary ? ` · ${breakdown.reasonSummary}` : ''}
        </p>
      ) : null}

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              {['Zone', 'Demand', 'Time of day', 'Weather', 'Combined', 'Cap'].map((h) => (
                <th key={h} style={styles.th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td style={styles.td} colSpan={6}>
                  No pricing zones configured
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.zone}>
                  <td style={styles.td}>{r.zone}</td>
                  <td style={styles.td}>{Number(r.demand).toFixed(1)}x</td>
                  <td style={styles.td}>{Number(r.time).toFixed(2)}x</td>
                  <td style={styles.td}>{Number(r.weather).toFixed(1)}x</td>
                  <td style={styles.td}>
                    <span style={{ ...styles.pill, ...combinedTone(Number(r.combined)) }}>
                      {Number(r.combined).toFixed(1)}x
                    </span>
                  </td>
                  <td style={styles.td}>{Number(r.cap).toFixed(1)}x</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <h2 style={styles.h2}>Factors</h2>
      {factors.map((f) => (
        <div key={f.id} style={styles.row}>
          <span>
            {f.factor_type} · zone {String(f.zone_id || 'global').slice(0, 8)}
          </span>
          <button style={styles.btn} onClick={() => toggle(f.id, !f.is_active)}>
            {f.is_active ? 'Disable' : 'Enable'}
          </button>
        </div>
      ))}

      <h2 style={styles.h2}>Add event</h2>
      <div style={styles.form}>
        <input
          style={styles.input}
          placeholder="name"
          value={eventForm.name}
          onChange={(e) => setEventForm({ ...eventForm, name: e.target.value })}
        />
        <input
          style={styles.input}
          type="datetime-local"
          value={eventForm.startsAt}
          onChange={(e) => setEventForm({ ...eventForm, startsAt: e.target.value })}
        />
        <input
          style={styles.input}
          type="datetime-local"
          value={eventForm.endsAt}
          onChange={(e) => setEventForm({ ...eventForm, endsAt: e.target.value })}
        />
        <input
          style={styles.input}
          placeholder="multiplier"
          value={eventForm.multiplier}
          onChange={(e) => setEventForm({ ...eventForm, multiplier: e.target.value })}
        />
        <button style={styles.newZone} onClick={addEvent}>
          Save event
        </button>
      </div>
    </AdminShell>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#000',
    color: '#fff',
    padding: 32,
    fontFamily: 'Poppins, Montserrat, sans-serif',
  },
  nav: { display: 'flex', gap: 28, marginBottom: 28, flexWrap: 'wrap' },
  navItem: { color: '#A0A0A0', fontSize: 14, fontWeight: 500, paddingBottom: 8 },
  navActive: {
    color: '#fff',
    borderBottom: '3px solid #0055FF',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  h1: { fontSize: 28, fontWeight: 700, margin: 0 },
  h2: { fontSize: 18, marginTop: 28, marginBottom: 12 },
  headerActions: { display: 'flex', gap: 10 },
  region: {
    background: 'transparent',
    color: '#fff',
    border: '1px solid #2A2A2A',
    borderRadius: 999,
    padding: '8px 14px',
    cursor: 'pointer',
  },
  newZone: {
    background: 'linear-gradient(90deg, #6A00FF, #0055FF)',
    color: '#fff',
    border: 'none',
    borderRadius: 999,
    padding: '8px 16px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  live: { color: '#A0A0A0', marginBottom: 16, fontSize: 13 },
  tableWrap: {
    border: '1px solid #2A2A2A',
    borderRadius: 16,
    overflow: 'hidden',
    background: '#0A0A0A',
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left',
    color: '#A0A0A0',
    fontWeight: 500,
    fontSize: 13,
    padding: '14px 16px',
    borderBottom: '1px solid #2A2A2A',
  },
  td: {
    padding: '16px',
    borderBottom: '1px solid #1A1A1A',
    fontSize: 14,
  },
  pill: {
    display: 'inline-block',
    borderRadius: 999,
    padding: '4px 10px',
    fontWeight: 700,
    fontSize: 13,
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 0',
    borderBottom: '1px solid #1A1A1A',
  },
  form: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  input: {
    background: '#0A0A0A',
    border: '1px solid #2A2A2A',
    color: '#fff',
    padding: '8px 12px',
    borderRadius: 8,
  },
  btn: {
    background: '#1A1A1A',
    color: '#fff',
    border: '1px solid #2A2A2A',
    borderRadius: 8,
    padding: '8px 14px',
    cursor: 'pointer',
  },
};
