import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import AdminShell from '../layouts/AdminShell';
import { adminBtn } from '../styles/adminButtons';

const API = process.env.REACT_APP_API_URL || '/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}` });

type SubTab = 'live' | 'queue' | 'drivers' | 'incidents' | 'shift';
type QueueFilter = 'queue' | 'active' | 'completed';

type QueueRide = {
  id: string;
  customer: string;
  from: string;
  to: string;
  waitMin: number;
  status: string;
  priority?: string;
  fare?: number;
  distanceKm?: number;
};

type Driver = {
  id: string;
  name: string;
  zone: string;
  trips: number;
  status: string;
  rating?: number;
  distanceKm?: number;
};

type Incident = {
  id: string;
  kind?: string;
  severity?: string;
  title?: string;
  status?: string;
  created_at?: string;
};

type ShiftReport = {
  id: string;
  zone?: string;
  active_rides?: number;
  queued_rides?: number;
  drivers_online?: number;
  avg_match_seconds?: number;
  period_end?: string;
  notes?: string;
};

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: 'live', label: 'Live Dispatch' },
  { key: 'queue', label: 'Queue Management' },
  { key: 'drivers', label: 'Driver Status' },
  { key: 'incidents', label: 'Incident Log' },
  { key: 'shift', label: 'Shift Report' },
];

function priorityStyle(p?: string): React.CSSProperties {
  const v = String(p || 'normal').toLowerCase();
  if (v === 'high') return { background: 'rgba(239,68,68,0.2)', color: '#f87171' };
  if (v === 'vip') return { background: 'rgba(142,45,226,0.25)', color: '#c4b5fd' };
  return { background: 'rgba(59,130,246,0.2)', color: '#93c5fd' };
}

function waitLabel(min: number) {
  if (min <= 0) return 'Wait: Now';
  return `Wait: ${min} min`;
}

/** Live dispatch board — queue, drivers, incidents, shift reports. */
export default function DispatcherPanelPage() {
  const [tab, setTab] = useState<SubTab>('queue');
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('queue');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [assigning, setAssigning] = useState<string | null>(null);
  const [broadcasting, setBroadcasting] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [selectedRide, setSelectedRide] = useState<QueueRide | null>(null);
  const [driverQuery, setDriverQuery] = useState('');
  const [zone, setZone] = useState('Lagos Zone');
  const [activeRides, setActiveRides] = useState(0);
  const [queued, setQueued] = useState(0);
  const [completedToday, setCompletedToday] = useState(0);
  const [driversOnline, setDriversOnline] = useState(0);
  const [avgWait, setAvgWait] = useState(0);
  const [matchTime, setMatchTime] = useState(0);
  const [surge, setSurge] = useState(1);
  const [autoAssign, setAutoAssign] = useState(true);
  const [nearestFirst, setNearestFirst] = useState(true);
  const [incidentsSummary, setIncidentsSummary] = useState({ sos: 0, latePickups: 0 });
  const [queue, setQueue] = useState<QueueRide[]>([]);
  const [activeList, setActiveList] = useState<QueueRide[]>([]);
  const [completedList, setCompletedList] = useState<QueueRide[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [shiftReports, setShiftReports] = useState<ShiftReport[]>([]);

  const load = async () => {
    try {
      const res = await axios.get(`${API}/admin/dispatch/board`, {
        headers: headers(),
        params: { zone },
      });
      const d = res.data?.data || {};
      setZone(d.zone || zone);
      setActiveRides(Number(d.activeRides || 0));
      setQueued(Number(d.queued || 0));
      setCompletedToday(Number(d.completedToday || 0));
      setDriversOnline(Number(d.driversOnline || 0));
      setAvgWait(Number(d.avgWaitMin || 0));
      setMatchTime(Number(d.matchTimeSeconds || 0));
      setSurge(Number(d.surgeMultiplier || 1));
      setAutoAssign(Boolean(d.settings?.autoAssign ?? true));
      setNearestFirst(Boolean(d.settings?.nearestFirst ?? true));
      setIncidentsSummary(d.incidentsSummary || { sos: 0, latePickups: 0 });
      setQueue(d.queue || []);
      setActiveList(d.activeList || []);
      setCompletedList(d.completedList || []);
      setDrivers(d.availableDrivers || []);
      setIncidents(d.incidents || []);
      setShiftReports(d.shiftReports || []);
      setError('');
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Failed to load dispatch board');
    }
  };

  useEffect(() => {
    load();
    const id = window.setInterval(load, 10000);
    return () => window.clearInterval(id);
  }, []);

  const visibleRides = useMemo(() => {
    if (queueFilter === 'active') return activeList;
    if (queueFilter === 'completed') return completedList;
    return queue;
  }, [queueFilter, queue, activeList, completedList]);

  const filteredDrivers = useMemo(() => {
    const q = driverQuery.trim().toLowerCase();
    let list = [...drivers];
    if (q) list = list.filter((d) => d.name.toLowerCase().includes(q) || d.zone.toLowerCase().includes(q));
    if (nearestFirst) list.sort((a, b) => Number(a.distanceKm || 99) - Number(b.distanceKm || 99));
    return list;
  }, [drivers, driverQuery, nearestFirst]);

  const patchSettings = async (patch: { autoAssign?: boolean; nearestFirst?: boolean }) => {
    try {
      await axios.patch(`${API}/admin/dispatch/settings`, patch, { headers: headers() });
      if (typeof patch.autoAssign === 'boolean') setAutoAssign(patch.autoAssign);
      if (typeof patch.nearestFirst === 'boolean') setNearestFirst(patch.nearestFirst);
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Settings update failed');
    }
  };

  const broadcast = async () => {
    const title = window.prompt('Broadcast title');
    if (!title) return;
    const body = window.prompt('Broadcast message');
    if (!body) return;
    setBroadcasting(true);
    try {
      await axios.post(
        `${API}/admin/dispatch/broadcast`,
        { title, body, zone, audience: 'drivers' },
        { headers: headers() }
      );
      setMessage('Broadcast sent');
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Broadcast failed');
    } finally {
      setBroadcasting(false);
    }
  };

  const forceAssign = async (rideId?: string, driverId?: string) => {
    let rid = rideId;
    let did = driverId;
    if (!rid) rid = window.prompt('Ride ID') || '';
    if (!did) {
      if (filteredDrivers[0]) {
        did = filteredDrivers[0].id;
      } else {
        did = window.prompt('Driver ID') || '';
      }
    }
    if (!rid || !did) return;
    setAssigning(rid);
    try {
      await axios.post(`${API}/admin/dispatch/assign`, { rideId: rid, driverId: did }, { headers: headers() });
      setMessage(`Assigned ride ${rid}`);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Assign failed');
    } finally {
      setAssigning(null);
    }
  };

  const forceAssignAll = async () => {
    try {
      const res = await axios.post(`${API}/admin/dispatch/force-assign-all`, {}, { headers: headers() });
      setMessage(`Force assigned ${res.data?.data?.assigned || 0} rides`);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Force assign all failed');
    }
  };

  const clearResolved = async () => {
    try {
      const res = await axios.post(`${API}/admin/dispatch/clear-resolved`, {}, { headers: headers() });
      setMessage(`Cleared ${res.data?.data?.cleared || 0} resolved rides`);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Clear resolved failed');
    }
  };

  const createShiftReport = async () => {
    setReporting(true);
    try {
      await axios.post(
        `${API}/admin/dispatch/shift-report`,
        { zone, avgMatchSeconds: matchTime },
        { headers: headers() }
      );
      setMessage('Shift report saved');
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Shift report failed');
    } finally {
      setReporting(false);
    }
  };

  return (
    <AdminShell activeLabel="Dispatcher" hidePageTitle>
      <div style={styles.headerRow}>
        <div>
          <h1 style={styles.h1}>
            {tab === 'queue' ? 'Queue Management' : `Live Dispatch · ${zone}`}
          </h1>
          <p style={styles.sub}>
            {tab === 'queue'
              ? `${queued} rides waiting — Avg wait ${avgWait} min.`
              : 'Real-time matching, queue, and incidents'}
          </p>
        </div>
        <div style={styles.actions} className="admin-actions">
          {tab === 'queue' ? (
            <>
              <button type="button" className="admin-btn" style={styles.secondaryBtn} onClick={clearResolved}>
                Clear Resolved
              </button>
              <button type="button" className="admin-btn" style={styles.primaryBtn} onClick={forceAssignAll}>
                Force Assign All
              </button>
            </>
          ) : (
            <>
              <button type="button" className="admin-btn" style={styles.secondaryBtn} onClick={broadcast} disabled={broadcasting}>
                {broadcasting ? 'Sending…' : 'Broadcast Alert'}
              </button>
              <button type="button" className="admin-btn" style={styles.primaryBtn} onClick={() => forceAssign()}>
                Force Assign
              </button>
            </>
          )}
        </div>
      </div>

      {error ? <p style={styles.error}>{error}</p> : null}
      {message ? <p style={styles.message}>{message}</p> : null}

      <div style={styles.subNav}>
        {SUB_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            style={{ ...styles.subTab, ...(tab === t.key ? styles.subTabOn : {}) }}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={styles.summaryRow} className="admin-kpi-grid" data-admin-grid="kpi">
        {[
          { label: 'Active Rides', value: String(activeRides) },
          { label: 'Queued', value: String(queued) },
          { label: 'Drivers Online', value: String(driversOnline) },
        ].map((c) => (
          <div key={c.label} style={styles.summaryCard}>
            <div style={styles.label}>{c.label}</div>
            <div style={styles.summaryValue}>{c.value}</div>
          </div>
        ))}
      </div>

      {tab === 'queue' && (
        <div style={styles.queueLayout} className="admin-split-grid" data-admin-grid="split">
          <div style={styles.panel}>
            <div style={styles.filterTabs}>
              {(
                [
                  { key: 'queue', label: `Queue (${queued})` },
                  { key: 'active', label: `Active (${activeRides})` },
                  { key: 'completed', label: `Completed (${completedToday})` },
                ] as { key: QueueFilter; label: string }[]
              ).map((f) => (
                <button
                  key={f.key}
                  type="button"
                  style={{ ...styles.filterTab, ...(queueFilter === f.key ? styles.filterTabOn : {}) }}
                  onClick={() => setQueueFilter(f.key)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div style={styles.queueList}>
              {visibleRides.length === 0 ? (
                <p style={styles.empty}>No rides in this list</p>
              ) : (
                visibleRides.map((r, i) => (
                  <div key={r.id} style={styles.queueCard}>
                    <div style={styles.queueIndex}>{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={styles.queueTop}>
                        <strong style={{ color: 'var(--text-primary)' }}>{r.customer}</strong>
                        <span style={{ ...styles.priorityPill, ...priorityStyle(r.priority) }}>
                          {(r.priority || 'normal').replace(/\b\w/g, (c) => c.toUpperCase())}
                        </span>
                      </div>
                      <div style={styles.queueMeta}>
                        {r.from} → {r.to}
                        {r.distanceKm ? ` · ${r.distanceKm}km` : ''}
                        {r.fare ? ` · ₦${Math.round(r.fare).toLocaleString()}` : ''}
                      </div>
                      <div style={styles.queueWait}>{waitLabel(r.waitMin)}</div>
                    </div>
                    {queueFilter === 'queue' ? (
                      <button
                        type="button"
                        style={styles.assignBtn}
                        disabled={assigning === r.id}
                        onClick={() => forceAssign(r.id, filteredDrivers[0]?.id)}
                      >
                        {assigning === r.id ? '…' : 'Assign'}
                      </button>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>

          <div style={styles.sideCol}>
            <div style={styles.panel}>
              <h2 style={styles.panelTitle}>Available Drivers</h2>
              <div style={styles.driverTools}>
                <input
                  style={styles.search}
                  placeholder="Search drivers"
                  value={driverQuery}
                  onChange={(e) => setDriverQuery(e.target.value)}
                />
                <select
                  style={styles.search}
                  value={nearestFirst ? 'nearest' : 'rating'}
                  onChange={(e) => patchSettings({ nearestFirst: e.target.value === 'nearest' })}
                >
                  <option value="nearest">Nearest</option>
                  <option value="rating">Top rated</option>
                </select>
              </div>
              <div style={styles.list}>
                {filteredDrivers.length === 0 ? (
                  <p style={styles.empty}>No free drivers</p>
                ) : (
                  filteredDrivers.map((d) => (
                    <div key={d.id} style={styles.driverItem}>
                      <div>
                        <div style={styles.queueName}>{d.name}</div>
                        <div style={styles.queueMeta}>
                          {d.zone}
                          {d.distanceKm != null ? ` ${d.distanceKm}km` : ''} · ★{' '}
                          {Number(d.rating || 4.8).toFixed(1)}
                        </div>
                      </div>
                      <button
                        type="button"
                        style={styles.assignBtn}
                        disabled={!selectedRide && !queue[0]}
                        onClick={() => forceAssign((selectedRide || queue[0])?.id, d.id)}
                      >
                        Assign
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div style={styles.panel}>
              <h2 style={styles.panelTitle}>Auto-Dispatch</h2>
              <label style={styles.toggleRow}>
                <span>Auto-assign</span>
                <input
                  type="checkbox"
                  checked={autoAssign}
                  onChange={(e) => patchSettings({ autoAssign: e.target.checked })}
                />
              </label>
              <label style={styles.toggleRow}>
                <span>Nearest-first</span>
                <input
                  type="checkbox"
                  checked={nearestFirst}
                  onChange={(e) => patchSettings({ nearestFirst: e.target.checked })}
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {tab === 'live' && (
        <div style={styles.board} className="admin-split-grid" data-admin-grid="split">
          <div style={styles.mapPanel}>
            <div style={styles.mapGrid}>
              <div style={styles.mapOverlay}>
                <div style={styles.overlayCard}>
                  <div style={styles.overlayTitle}>Active Incidents</div>
                  <div style={styles.overlayRow}>
                    <span style={styles.sosDot}>SOS</span>
                    <strong>{incidentsSummary.sos}</strong>
                  </div>
                  <div style={styles.overlayRow}>
                    <span style={styles.lateDot}>Late</span>
                    <strong>{incidentsSummary.latePickups}</strong>
                  </div>
                </div>
                <div style={styles.overlayCard}>
                  <div style={styles.overlayTitle}>Match Time</div>
                  <div style={styles.bigStat}>{matchTime}s</div>
                </div>
                <div style={styles.overlayCard}>
                  <div style={styles.overlayTitle}>Surge</div>
                  <div style={styles.bigStat}>{Number(surge).toFixed(1)}×</div>
                </div>
              </div>
            </div>
          </div>
          <div style={styles.panel}>
            <h2 style={styles.panelTitle}>Ride Queue</h2>
            <div style={styles.list}>
              {queue.length === 0 ? (
                <p style={styles.empty}>Queue empty</p>
              ) : (
                queue.map((r) => (
                  <div key={r.id} style={styles.queueCard}>
                    <div style={{ flex: 1 }}>
                      <button type="button" style={styles.queueBtn} onClick={() => setSelectedRide(r)}>
                        <div style={styles.queueName}>{r.customer}</div>
                        <div style={styles.queueMeta}>
                          {r.from} → {r.to}
                        </div>
                        <div style={styles.queueWait}>{waitLabel(r.waitMin)}</div>
                      </button>
                    </div>
                    <button
                      type="button"
                      style={styles.assignBtn}
                      disabled={assigning === r.id}
                      onClick={() => forceAssign(r.id, filteredDrivers[0]?.id)}
                    >
                      Assign
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'drivers' && (
        <div style={styles.panel}>
            <h2 style={styles.panelTitle}>Driver Status</h2>
            <div className="admin-table-scroll">
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Driver</th>
                <th style={styles.th}>Zone</th>
                <th style={styles.th}>Trips</th>
                <th style={styles.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {drivers.length === 0 ? (
                <tr>
                  <td colSpan={4} style={styles.tdMuted}>
                    No online drivers
                  </td>
                </tr>
              ) : (
                drivers.map((d) => (
                  <tr key={d.id}>
                    <td style={styles.td}>{d.name}</td>
                    <td style={styles.td}>{d.zone}</td>
                    <td style={styles.td}>{d.trips}</td>
                    <td style={styles.td}>
                      <span style={styles.freePill}>{d.status}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
            </div>
        </div>
      )}

      {tab === 'incidents' && (
        <div style={styles.panel}>
          <h2 style={styles.panelTitle}>Incident Log</h2>
          <div className="admin-table-scroll">
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Kind</th>
                <th style={styles.th}>Severity</th>
                <th style={styles.th}>Title</th>
                <th style={styles.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {incidents.length === 0 ? (
                <tr>
                  <td colSpan={4} style={styles.tdMuted}>
                    No open incidents
                  </td>
                </tr>
              ) : (
                incidents.map((i) => (
                  <tr key={i.id}>
                    <td style={styles.td}>{i.kind || '—'}</td>
                    <td style={styles.td}>{i.severity || '—'}</td>
                    <td style={styles.td}>{i.title || '—'}</td>
                    <td style={styles.td}>{i.status || 'open'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {tab === 'shift' && (
        <div style={styles.panel}>
          <div style={styles.shiftHead}>
            <h2 style={{ ...styles.panelTitle, margin: 0 }}>Shift Report</h2>
            <button type="button" className="admin-btn" style={styles.primaryBtn} onClick={createShiftReport} disabled={reporting}>
              {reporting ? 'Saving…' : 'Generate Shift Report'}
            </button>
          </div>
          <div className="admin-table-scroll">
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Zone</th>
                <th style={styles.th}>Active</th>
                <th style={styles.th}>Queued</th>
                <th style={styles.th}>Online</th>
                <th style={styles.th}>Avg Match</th>
                <th style={styles.th}>Period End</th>
                <th style={styles.th}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {shiftReports.length === 0 ? (
                <tr>
                  <td colSpan={7} style={styles.tdMuted}>
                    No shift reports yet
                  </td>
                </tr>
              ) : (
                shiftReports.map((r) => (
                  <tr key={r.id}>
                    <td style={styles.td}>{r.zone || zone}</td>
                    <td style={styles.td}>{r.active_rides ?? '—'}</td>
                    <td style={styles.td}>{r.queued_rides ?? '—'}</td>
                    <td style={styles.td}>{r.drivers_online ?? '—'}</td>
                    <td style={styles.td}>
                      {r.avg_match_seconds != null ? `${r.avg_match_seconds}s` : '—'}
                    </td>
                    <td style={styles.td}>
                      {r.period_end ? new Date(r.period_end).toLocaleString() : '—'}
                    </td>
                    <td style={styles.td}>{r.notes || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

const styles: Record<string, React.CSSProperties> = {
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  h1: { fontSize: 28, fontWeight: 700, margin: 0 },
  sub: { color: 'var(--text-secondary)', marginTop: 6, marginBottom: 0 },
  error: { color: 'var(--error)', marginBottom: 12 },
  message: { color: 'var(--success)', marginBottom: 12 },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  primaryBtn: { ...adminBtn.primary },
  secondaryBtn: { ...adminBtn.secondary },
  subNav: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 16,
    borderBottom: '1px solid var(--border)',
    paddingBottom: 12,
  },
  subTab: {
    border: 'none',
    background: 'transparent',
    color: 'var(--text-secondary)',
    padding: '8px 12px',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 13,
  },
  subTabOn: { background: 'rgba(142,45,226,0.25)', color: 'var(--brand-white)' },
  summaryRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 12,
    marginBottom: 16,
  },
  summaryCard: {
    background: 'var(--surface-elevated)',
    borderRadius: 14,
    padding: 16,
    border: '1px solid var(--border)',
  },
  label: { color: 'var(--text-secondary)', fontSize: 13 },
  summaryValue: { fontSize: 28, fontWeight: 700, marginTop: 8 },
  queueLayout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.7fr) minmax(280px, 1fr)',
    gap: 16,
    alignItems: 'start',
  },
  sideCol: { display: 'flex', flexDirection: 'column', gap: 12 },
  board: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.4fr) minmax(300px, 1fr)',
    gap: 16,
    alignItems: 'start',
  },
  mapPanel: {
    background: 'var(--surface-elevated)',
    borderRadius: 14,
    border: '1px solid var(--border)',
    overflow: 'hidden',
    minHeight: 420,
  },
  mapGrid: {
    position: 'relative',
    minHeight: 420,
    backgroundImage:
      'linear-gradient(rgba(142,45,226,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(142,45,226,0.08) 1px, transparent 1px)',
    backgroundSize: '32px 32px',
    backgroundColor: '#0c0a12',
  },
  mapOverlay: {
    position: 'absolute',
    top: 16,
    left: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    maxWidth: 200,
  },
  overlayCard: {
    background: 'rgba(18,16,28,0.92)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 12,
  },
  overlayTitle: {
    color: 'var(--text-secondary)',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  overlayRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 13,
    marginBottom: 4,
  },
  sosDot: { color: '#f87171', fontWeight: 700 },
  lateDot: { color: '#facc15', fontWeight: 700 },
  bigStat: { fontSize: 22, fontWeight: 800 },
  panel: {
    background: 'var(--surface-elevated)',
    borderRadius: 14,
    padding: 16,
    border: '1px solid var(--border)',
  },
  panelTitle: { fontSize: 16, margin: '0 0 12px', fontWeight: 700 },
  filterTabs: { display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  filterTab: {
    border: '1px solid var(--border)',
    background: 'transparent',
    color: 'var(--text-secondary)',
    borderRadius: 999,
    padding: '6px 12px',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
  },
  filterTabOn: {
    background: 'rgba(142,45,226,0.25)',
    color: 'var(--brand-white)',
    borderColor: 'transparent',
  },
  queueList: { display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 560, overflow: 'auto' },
  queueCard: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'var(--bg)',
  },
  queueIndex: {
    width: 28,
    height: 28,
    borderRadius: 8,
    background: 'rgba(142,45,226,0.2)',
    color: '#c4b5fd',
    display: 'grid',
    placeItems: 'center',
    fontWeight: 700,
    fontSize: 13,
  },
  queueTop: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  priorityPill: {
    fontSize: 11,
    fontWeight: 700,
    borderRadius: 999,
    padding: '2px 8px',
    textTransform: 'capitalize',
  },
  queueName: { fontWeight: 700, color: 'var(--text-primary)' },
  queueMeta: { color: 'var(--text-secondary)', fontSize: 12, marginTop: 4 },
  queueWait: { color: 'var(--text-secondary)', fontSize: 12, marginTop: 4 },
  queueBtn: {
    border: 'none',
    background: 'transparent',
    textAlign: 'left',
    padding: 0,
    cursor: 'pointer',
    width: '100%',
  },
  assignBtn: { ...adminBtn.compact },
  driverTools: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 },
  search: {
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '8px 10px',
    color: 'var(--text-primary)',
  },
  list: { display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflow: 'auto' },
  driverItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    border: '1px solid var(--border)',
  },
  toggleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 0',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-primary)',
    fontSize: 14,
  },
  empty: { color: 'var(--text-secondary)', fontSize: 13 },
  freePill: {
    background: 'rgba(34,197,94,0.2)',
    color: '#4ade80',
    borderRadius: 999,
    padding: '2px 8px',
    fontSize: 12,
    fontWeight: 700,
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left',
    fontSize: 12,
    color: 'var(--text-secondary)',
    padding: '8px 6px',
    borderBottom: '1px solid var(--border)',
  },
  td: { padding: '10px 6px', borderBottom: '1px solid var(--border)', fontSize: 13 },
  tdMuted: { padding: 16, color: 'var(--text-secondary)', textAlign: 'center' },
  shiftHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12 },
};
