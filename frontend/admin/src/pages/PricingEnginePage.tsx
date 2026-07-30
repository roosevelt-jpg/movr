import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}` });

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

  const toggle = async (id: string, isActive: boolean) => {
    await axios.patch(`${API}/admin/pricing/factors/${id}`, { isActive }, { headers: headers() });
    await load();
  };

  const addEvent = async () => {
    await axios.post(`${API}/admin/pricing/events`, {
      ...eventForm,
      multiplier: Number(eventForm.multiplier),
    }, { headers: headers() });
    await load();
  };

  return (
    <div style={styles.page}>
      <h1 style={styles.h1}>Pricing engine</h1>
      <p style={styles.sub}>Demand × time × day × weather × traffic × events, with zone caps.</p>

      {breakdown ? (
        <div style={styles.panel}>
          <h2>Live Accra readout</h2>
          <p style={styles.meta}>
            {[
              `Demand ${breakdown.demandMultiplier}x`,
              `Rush ${breakdown.timeMultiplier}x`,
              `Day ${breakdown.dayMultiplier}x`,
              `Weather ${breakdown.weatherMultiplier}x`,
              `Traffic ${breakdown.trafficMultiplier}x`,
              `Event ${breakdown.eventMultiplier}x`,
            ].join(' × ')}
            {' = '}
            <strong>{breakdown.finalMultiplier}x</strong>
            {` (capped at ${breakdown.cappedAt}x)`}
          </p>
          {breakdown.reasonSummary ? <p style={styles.reason}>{breakdown.reasonSummary}</p> : null}
        </div>
      ) : null}

      <h2 style={styles.h2}>Zones</h2>
      <div style={styles.grid}>
        {zones.map((z) => (
          <div key={z.id} style={styles.card}>
            <strong>{z.name}</strong>
            <div style={styles.meta}>
              {z.country_code} · r={z.radius_km}km · cap {z.max_surge_cap}x
            </div>
          </div>
        ))}
      </div>

      <h2 style={styles.h2}>Factors</h2>
      {factors.map((f) => (
        <div key={f.id} style={styles.row}>
          <span>{f.factor_type} · zone {String(f.zone_id).slice(0, 8)}</span>
          <button style={styles.btn} onClick={() => toggle(f.id, !f.is_active)}>
            {f.is_active ? 'Disable' : 'Enable'}
          </button>
        </div>
      ))}

      <h2 style={styles.h2}>Add event</h2>
      <div style={styles.form}>
        <input style={styles.input} placeholder="name" value={eventForm.name}
          onChange={(e) => setEventForm({ ...eventForm, name: e.target.value })} />
        <input style={styles.input} type="datetime-local" value={eventForm.startsAt}
          onChange={(e) => setEventForm({ ...eventForm, startsAt: e.target.value })} />
        <input style={styles.input} type="datetime-local" value={eventForm.endsAt}
          onChange={(e) => setEventForm({ ...eventForm, endsAt: e.target.value })} />
        <input style={styles.input} placeholder="multiplier" value={eventForm.multiplier}
          onChange={(e) => setEventForm({ ...eventForm, multiplier: e.target.value })} />
        <button style={styles.btn} onClick={addEvent}>Save event</button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#000', color: '#fff', padding: 32, fontFamily: 'Poppins, sans-serif' },
  h1: { fontSize: 24, marginBottom: 8 },
  h2: { fontSize: 18, marginTop: 24, marginBottom: 12 },
  sub: { color: '#A0A0A0', marginBottom: 16 },
  panel: { background: '#0A0A0A', border: '1px solid #2A2A2A', borderRadius: 12, padding: 16, marginBottom: 16 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12 },
  card: { background: '#0A0A0A', border: '1px solid #2A2A2A', borderRadius: 12, padding: 12 },
  meta: { color: '#A0A0A0', fontSize: 13, marginTop: 6 },
  reason: { color: '#6A00FF', marginTop: 8 },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #1A1A1A' },
  form: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  input: { background: '#0A0A0A', border: '1px solid #2A2A2A', color: '#fff', padding: '8px 12px', borderRadius: 8 },
  btn: { background: '#6A00FF', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer' },
};
