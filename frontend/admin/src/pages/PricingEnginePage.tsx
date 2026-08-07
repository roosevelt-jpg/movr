import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import AdminShell from '../layouts/AdminShell';
import AdminOpsNav from '../components/AdminOpsNav';
import OnOffButton from '../components/OnOffButton';

const API = process.env.REACT_APP_API_URL || '/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}` });

/** Admin pricing engine — zones, factors, events, live breakdown (Phase 25). */
export default function PricingEnginePage() {
  const [zones, setZones] = useState<any[]>([]);
  const [liveZones, setLiveZones] = useState<any[]>([]);
  const [factors, setFactors] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [breakdown, setBreakdown] = useState<any>(null);
  const [showZone, setShowZone] = useState(false);
  const [zoneForm, setZoneForm] = useState({
    name: '',
    centerLat: '5.6037',
    centerLng: '-0.187',
    radiusKm: '5',
    maxSurgeCap: '1.8',
    countryCode: 'GH',
  });
  const [eventForm, setEventForm] = useState({
    zoneId: '',
    name: '',
    startsAt: '',
    endsAt: '',
    multiplier: '1.2',
  });
  const [message, setMessage] = useState('');

  const load = async () => {
    const [z, f, b, e, live] = await Promise.all([
      axios.get(`${API}/admin/pricing/zones`, { headers: headers() }),
      axios.get(`${API}/admin/pricing/factors`, { headers: headers() }),
      axios.get(`${API}/admin/pricing/breakdown?lat=5.6037&lng=-0.187`, { headers: headers() }),
      axios.get(`${API}/admin/pricing/events`, { headers: headers() }).catch(() => ({ data: { data: [] } })),
      axios.get(`${API}/admin/pricing/zones/live`, { headers: headers() }).catch(() => ({ data: { data: [] } })),
    ]);
    setZones(z.data.data || []);
    setFactors(f.data.data || []);
    setBreakdown(b.data.data);
    setEvents(e.data.data || []);
    setLiveZones(live.data.data || []);
    if (z.data.data?.[0]) setEventForm((prev) => ({ ...prev, zoneId: z.data.data[0].id }));
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  const rows = useMemo(() => {
    if (liveZones.length) {
      return liveZones.map((z) => ({
        id: z.id,
        zone: z.name,
        demand: Number(z.demandMultiplier || 1),
        time: Number(z.timeMultiplier || 1),
        weather: Number(z.weatherMultiplier || 1),
        combined: Number(z.combinedMultiplier || 1),
        cap: Number(z.maxCap || 2),
      }));
    }
    return zones.map((z) => ({
      id: z.id,
      zone: z.name,
      demand: 1,
      time: 1,
      weather: 1,
      combined: 1,
      cap: Number(z.max_surge_cap || 2),
    }));
  }, [zones, liveZones]);

  const toggle = async (id: string, isActive: boolean) => {
    await axios.patch(
      `${API}/admin/pricing/factors/${id}`,
      { isActive, reason: 'toggle factor' },
      { headers: headers() }
    );
    await load();
  };

  const addEvent = async () => {
    await axios.post(
      `${API}/admin/pricing/events`,
      { ...eventForm, multiplier: Number(eventForm.multiplier), reason: 'schedule event' },
      { headers: headers() }
    );
    setMessage('Event saved');
    await load();
  };

  const createZone = async () => {
    await axios.post(
      `${API}/admin/pricing/zones`,
      {
        name: zoneForm.name || 'New zone',
        countryCode: zoneForm.countryCode,
        centerLat: Number(zoneForm.centerLat),
        centerLng: Number(zoneForm.centerLng),
        radiusKm: Number(zoneForm.radiusKm),
        maxSurgeCap: Number(zoneForm.maxSurgeCap),
        reason: 'create zone',
      },
      { headers: headers() }
    );
    setShowZone(false);
    setMessage('Zone created');
    await load();
  };

  const saveCap = async (id: string, cap: string) => {
    await axios.patch(
      `${API}/admin/pricing/zones/${id}/max-surge-cap`,
      { maxSurgeCap: Number(cap), reason: 'update cap' },
      { headers: headers() }
    );
    await load();
  };

  const combinedTone = (n: number) =>
    n >= 1.45
      ? { background: 'rgba(63,112,72,0.35)', color: 'var(--success)' }
      : { background: 'rgba(255,184,0,0.2)', color: 'var(--warning)' };

  const fmtMult = (n: number) => `${Math.round(Number(n) * 100) / 100}x`;

  return (
    <AdminShell activeLabel="Pricing engine" hidePageTitle>
      <AdminOpsNav />
      <div style={styles.headerRow}>
        <h1 style={styles.h1}>Active pricing zones</h1>
        <div style={styles.headerActions}>
          <button style={styles.region}>Region: Accra</button>
          <button style={styles.newZone} onClick={() => setShowZone(true)}>
            + New zone
          </button>
        </div>
      </div>

      {message ? <p style={{ color: 'var(--success)' }}>{message}</p> : null}

      {breakdown ? (
        <p style={styles.live}>
          Live Accra: demand {breakdown.demandMultiplier}x · time {breakdown.timeMultiplier}x · day{' '}
          {breakdown.dayMultiplier}x · weather {breakdown.weatherMultiplier}x · traffic{' '}
          {breakdown.trafficMultiplier}x · event {breakdown.eventMultiplier}x →{' '}
          <strong>{breakdown.finalMultiplier}x</strong>
          {breakdown.reasonSummary ? ` · ${breakdown.reasonSummary}` : ''}
          {breakdown.cappedAt ? ` (cap ${breakdown.cappedAt}x)` : ''}
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
                <tr key={r.id}>
                  <td style={styles.td}>{r.zone}</td>
                  <td style={styles.td}>{fmtMult(r.demand)}</td>
                  <td style={styles.td}>{fmtMult(r.time)}</td>
                  <td style={styles.td}>{fmtMult(r.weather)}</td>
                  <td style={styles.td}>
                    <span style={{ ...styles.pill, ...combinedTone(Number(r.combined)) }}>
                      {fmtMult(r.combined)}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <button
                      style={styles.btn}
                      onClick={() => {
                        const next = prompt('Max surge cap', String(r.cap));
                        if (next) saveCap(r.id, next);
                      }}
                    >
                      {fmtMult(r.cap)}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showZone ? (
        <div style={styles.panel}>
          <h2 style={styles.h2}>New zone</h2>
          <div style={styles.form}>
            {(['name', 'centerLat', 'centerLng', 'radiusKm', 'maxSurgeCap', 'countryCode'] as const).map(
              (k) => (
                <input
                  key={k}
                  style={styles.input}
                  placeholder={k}
                  value={(zoneForm as any)[k]}
                  onChange={(e) => setZoneForm({ ...zoneForm, [k]: e.target.value })}
                />
              )
            )}
            <button style={styles.newZone} onClick={() => createZone().catch((e) => setMessage(e.message))}>
              Save zone
            </button>
            <button style={styles.btn} onClick={() => setShowZone(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <h2 style={styles.h2}>Factors</h2>
      {factors.map((f) => (
        <div key={f.id} style={styles.row}>
          <span>
            {f.factor_type} · zone {String(f.zone_id || 'global').slice(0, 8)}
          </span>
          <OnOffButton on={!!f.is_active} onClick={() => toggle(f.id, !f.is_active)} />
        </div>
      ))}

      <h2 style={styles.h2}>Events calendar</h2>
      <ul style={{ color: 'var(--text-secondary)' }}>
        {events.length === 0 ? <li>No scheduled events</li> : null}
        {events.map((ev) => (
          <li key={ev.id}>
            {ev.name} · {ev.multiplier}x · {new Date(ev.starts_at).toLocaleString()} →{' '}
            {new Date(ev.ends_at).toLocaleString()}
          </li>
        ))}
      </ul>

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
        <button style={styles.newZone} onClick={() => addEvent().catch((e) => setMessage(e.message))}>
          Save event
        </button>
      </div>
    </AdminShell>
  );
}

const styles: Record<string, React.CSSProperties> = {
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap',
  },
  h1: { margin: 0, fontSize: 24 },
  h2: { marginTop: 28, fontSize: 18 },
  headerActions: { display: 'flex', gap: 8 },
  region: {
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--pure-white)',
    borderRadius: 8,
    padding: '8px 12px',
  },
  newZone: {
    border: 'none',
    background: 'var(--motion-blue)',
    color: '#fff',
    borderRadius: 8,
    padding: '8px 12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  live: { color: 'var(--text-secondary)', marginTop: 12 },
  mapHint: {
    marginTop: 12,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    border: '1px dashed var(--border)',
    color: 'var(--text-secondary)',
    fontSize: 13,
  },
  tableWrap: { overflowX: 'auto', marginTop: 8 },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left',
    padding: '10px 8px',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-secondary)',
    fontSize: 12,
  },
  td: { padding: '10px 8px', borderBottom: '1px solid var(--border)', fontSize: 13 },
  pill: { borderRadius: 999, padding: '4px 10px', fontWeight: 700, fontSize: 12 },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 0',
    borderBottom: '1px solid var(--border)',
  },
  btn: {
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--pure-white)',
    borderRadius: 8,
    padding: '6px 10px',
    cursor: 'pointer',
  },
  form: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  input: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: 8,
    color: 'var(--pure-white)',
  },
  panel: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'var(--surface-elevated)',
  },
};
