import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import AdminShell from '../layouts/AdminShell';
import AdminOpsNav from '../components/AdminOpsNav';
import OnOffButton from '../components/OnOffButton';
import PlacesZonePicker, { type PickedPlace } from '../components/PlacesZonePicker';
import { adminBtn } from '../styles/adminButtons';
import { formatCountryLabel } from '../lib/currency';
import { API } from '../lib/apiBase';

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
  const [regionLabel, setRegionLabel] = useState('Accra');

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
    if (z.data.data?.[0]) {
      setEventForm((prev) => ({ ...prev, zoneId: prev.zoneId || z.data.data[0].id }));
      const first = z.data.data[0];
      if (first?.name) setRegionLabel(String(first.name).split(/[,·]/)[0].trim() || 'Accra');
    }
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  const applyPlace = (place: PickedPlace) => {
    const zoneName = place.locality || place.name || place.formattedAddress || 'New zone';
    setZoneForm((prev) => ({
      ...prev,
      name: zoneName,
      centerLat: String(Number(place.lat).toFixed(6)),
      centerLng: String(Number(place.lng).toFixed(6)),
      countryCode: (place.countryCode || prev.countryCode || 'GH').toUpperCase(),
    }));
    setRegionLabel(zoneName.split(/[,·]/)[0].trim() || zoneName);
    setMessage(`Zone center set from Google Places · ${place.formattedAddress || place.name}`);
  };

  const rows = useMemo(() => {
    if (liveZones.length) {
      return liveZones.map((z) => ({
        id: z.id,
        zone: z.name,
        demand: Number(z.demandMultiplier || 1),
        time: Number(z.timeMultiplier || 1),
        weather: Number(z.weatherMultiplier || 1),
        combined: Number(z.combinedMultiplier || 1),
        rider: Number(z.riderMultiplier || z.combinedMultiplier || 1),
        driver: Number(z.driverMultiplier || z.combinedMultiplier || 1),
        cap: Number(z.maxCap || 2),
        incentiveFlat: Number(z.driverIncentiveFlat || 0),
        incentiveMult: Number(z.driverIncentiveMult || 1),
        destBonus: Number(z.destinationBonusFlat || 0),
        minRider: Number(z.minRiderMult || 0.7),
      }));
    }
    return zones.map((z) => ({
      id: z.id,
      zone: z.name,
      demand: 1,
      time: 1,
      weather: 1,
      combined: 1,
      rider: 1,
      driver: 1,
      cap: Number(z.max_surge_cap || 2),
      incentiveFlat: Number(z.driver_incentive_flat || 0),
      incentiveMult: Number(z.driver_incentive_mult || 1),
      destBonus: Number(z.destination_bonus_flat || 0),
      minRider: Number(z.min_rider_mult || 0.7),
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

  const saveIncentives = async (r: any) => {
    const flat = prompt('Driver flat incentive', String(r.incentiveFlat ?? 50));
    if (flat == null) return;
    const mult = prompt('Driver incentive multiplier', String(r.incentiveMult ?? 1.05));
    if (mult == null) return;
    const dest = prompt('Destination bonus', String(r.destBonus ?? 30));
    if (dest == null) return;
    const minR = prompt('Min rider multiplier (discount floor)', String(r.minRider ?? 0.7));
    if (minR == null) return;
    await axios.patch(
      `${API}/admin/pricing/zones/${r.id}/incentives`,
      {
        driverIncentiveFlat: Number(flat),
        driverIncentiveMult: Number(mult),
        destinationBonusFlat: Number(dest),
        minRiderMult: Number(minR),
        reason: 'dual pricing incentives',
      },
      { headers: headers() }
    );
    setMessage('Zone incentives updated');
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
          <span style={styles.region}>Region: {regionLabel}</span>
          <button type="button" style={styles.newZone} onClick={() => setShowZone(true)}>
            + New zone
          </button>
        </div>
      </div>

      {message ? <p style={{ color: 'var(--success)' }}>{message}</p> : null}

      {breakdown ? (
        <p style={styles.live}>
          Dual pricing {regionLabel}: rider{' '}
          <strong>{breakdown.riderMultiplier ?? breakdown.finalMultiplier}x</strong>
          {' · '}driver{' '}
          <strong>{breakdown.driverMultiplier ?? breakdown.finalMultiplier}x</strong>
          {' · '}context {breakdown.finalMultiplier}x (demand {breakdown.demandMultiplier}x · time{' '}
          {breakdown.timeMultiplier}x · day {breakdown.dayMultiplier}x · weather{' '}
          {breakdown.weatherMultiplier}x · traffic {breakdown.trafficMultiplier}x · event{' '}
          {breakdown.eventMultiplier}x)
          {breakdown.riderReason ? ` · ${breakdown.riderReason}` : ''}
          {breakdown.driverReason ? ` · ${breakdown.driverReason}` : ''}
          {breakdown.cappedAt ? ` (cap ${breakdown.cappedAt}x)` : ''}
        </p>
      ) : null}

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              {['Zone', 'Demand', 'Time', 'Weather', 'Rider', 'Driver', 'Cap', 'Incentives'].map((h) => (
                <th key={h} style={styles.th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td style={styles.td} colSpan={8}>
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
                    <span style={{ ...styles.pill, ...combinedTone(Number(r.rider)) }}>
                      {fmtMult(r.rider)}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <span style={{ ...styles.pill, ...combinedTone(Number(r.driver)) }}>
                      {fmtMult(r.driver)}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <button
                      type="button"
                      style={styles.btn}
                      onClick={() => {
                        const next = prompt('Max surge cap', String(r.cap));
                        if (next) saveCap(r.id, next);
                      }}
                    >
                      {fmtMult(r.cap)}
                    </button>
                  </td>
                  <td style={styles.td}>
                    <button type="button" style={styles.btn} onClick={() => saveIncentives(r)}>
                      +{r.incentiveFlat} · {fmtMult(r.incentiveMult)}
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
          <p style={styles.mapHint}>
            Search Google Maps & Places to auto-fill zone name, coordinates, and country. Then set radius and
            surge cap.
          </p>
          <PlacesZonePicker
            countryBias={zoneForm.countryCode}
            onPick={applyPlace}
            placeholder="e.g. Osu Accra, Airport City, Tema…"
          />
          <div style={styles.form}>
            {(['name', 'centerLat', 'centerLng', 'radiusKm', 'maxSurgeCap', 'countryCode'] as const).map(
              (k) =>
                k === 'countryCode' ? (
                  <label key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 180px' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      Country · {formatCountryLabel(zoneForm.countryCode)}
                    </span>
                    <input
                      style={styles.input}
                      placeholder="countryCode"
                      value={zoneForm.countryCode}
                      onChange={(e) => setZoneForm({ ...zoneForm, countryCode: e.target.value })}
                    />
                  </label>
                ) : (
                  <label key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 180px' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                      {k === 'centerLat'
                        ? 'Center lat'
                        : k === 'centerLng'
                          ? 'Center lng'
                          : k === 'radiusKm'
                            ? 'Radius (km)'
                            : k === 'maxSurgeCap'
                              ? 'Max surge cap'
                              : 'Name'}
                    </span>
                    <input
                      style={styles.input}
                      placeholder={k}
                      value={(zoneForm as any)[k]}
                      onChange={(e) => setZoneForm({ ...zoneForm, [k]: e.target.value })}
                    />
                  </label>
                )
            )}
            <button type="button" style={styles.newZone} onClick={() => createZone().catch((e) => setMessage(e.message))}>
              Save zone
            </button>
            <button type="button" style={styles.btn} onClick={() => setShowZone(false)}>
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
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 180px' }}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Zone</span>
          <select
            style={styles.input}
            value={eventForm.zoneId}
            onChange={(e) => setEventForm({ ...eventForm, zoneId: e.target.value })}
          >
            {zones.length === 0 ? <option value="">No zones yet</option> : null}
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
        </label>
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
        <button type="button" style={styles.newZone} onClick={() => addEvent().catch((e) => setMessage(e.message))}>
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
  h1: { margin: 0, fontSize: 24, color: 'var(--text-primary)' },
  h2: { marginTop: 28, fontSize: 18, color: 'var(--text-primary)' },
  headerActions: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  region: {
    border: '1px solid var(--border)',
    background: 'var(--surface-elevated)',
    color: 'var(--text-primary)',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 13,
    fontWeight: 600,
  },
  newZone: { ...adminBtn.primary },
  live: { color: 'var(--text-secondary)', marginTop: 12 },
  mapHint: {
    marginTop: 0,
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
  td: {
    padding: '10px 8px',
    borderBottom: '1px solid var(--border)',
    fontSize: 13,
    color: 'var(--text-primary)',
  },
  pill: { borderRadius: 999, padding: '4px 10px', fontWeight: 700, fontSize: 12 },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 0',
    borderBottom: '1px solid var(--border)',
  },
  btn: { ...adminBtn.secondary },
  form: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' },
  input: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: 8,
    color: 'var(--text-primary)',
    minWidth: 0,
    maxWidth: '100%',
    boxSizing: 'border-box',
    flex: '1 1 180px',
  },
  panel: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'var(--surface-elevated)',
  },
};
