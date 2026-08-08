import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import AdminShell from '../layouts/AdminShell';
import { adminBtn } from '../styles/adminButtons';
import { formatCurrency } from '../lib/currency';

const API = process.env.REACT_APP_API_URL || '/api/v1';
const SOCKET_URL =
  process.env.REACT_APP_SOCKET_URL ||
  (typeof window !== 'undefined' ? window.location.origin.replace(/:\d+$/, ':3000') : 'http://localhost:3000');

type Marker = {
  id: string;
  lat?: number | null;
  lng?: number | null;
  status?: string;
  kind?: string;
};

type Incident = {
  id: string;
  kind: string;
  severity?: string;
  title: string;
  body?: string;
  rideId?: string;
  createdAt?: string;
};

type ActiveRide = {
  id: string;
  status: string;
  fare: number;
  from: string;
  to: string;
  minutes: number;
};

type FilterKey = 'rides' | 'parcels' | 'shops' | 'rentals';

const KIND_COLOR: Record<string, string> = {
  ride: '#3B82F6',
  rides: '#3B82F6',
  driver: '#A855F7',
  drivers: '#A855F7',
  parcel: '#22C55E',
  parcels: '#22C55E',
  delivery: '#22C55E',
  shop: '#EAB308',
  shops: '#EAB308',
  rental: '#A855F7',
  rentals: '#A855F7',
  pickup: '#22C55E',
  on_trip: '#3B82F6',
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function headers() {
  return { Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}` };
}

function markerColor(m: Marker) {
  const kind = String(m.kind || 'ride').toLowerCase();
  const status = String(m.status || '').toLowerCase();
  if (kind.includes('driver') || kind === 'drivers') return '#A855F7';
  if (status.includes('pickup') || status.includes('arrived')) return '#22C55E';
  if (status.includes('started') || status.includes('progress') || status.includes('ongoing')) return '#3B82F6';
  return KIND_COLOR[kind] || '#A855F7';
}

/** Admin live ops map — feed panel, incidents, surge, markers. */
export default function AdminLiveMapPage() {
  const [active, setActive] = useState<FilterKey>('rides');
  const [counts, setCounts] = useState({ rides: 0, parcels: 0, shops: 0, rentals: 0 });
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [live, setLive] = useState(false);
  const [onlineDrivers, setOnlineDrivers] = useState(0);
  const [activeRidesCount, setActiveRidesCount] = useState(0);
  const [matchTimeSeconds, setMatchTimeSeconds] = useState(0);
  const [surgeMultiplier, setSurgeMultiplier] = useState(1);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [activeRides, setActiveRides] = useState<ActiveRide[]>([]);
  const [message, setMessage] = useState('');
  const socketRef = useRef<Socket | null>(null);

  const refreshRest = () => {
    axios
      .get(`${API}/admin/live/counts`, { headers: headers() })
      .then((res) => {
        if (res.data?.data) setCounts({ rides: 0, parcels: 0, shops: 0, rentals: 0, ...res.data.data });
      })
      .catch(() => setCounts({ rides: 0, parcels: 0, shops: 0, rentals: 0 }));

    axios
      .get(`${API}/admin/live/markers`, { headers: headers() })
      .then((res) => setMarkers(res.data?.data || []))
      .catch(() => setMarkers([]));

    axios
      .get(`${API}/admin/live/feed`, { headers: headers() })
      .then((res) => {
        const d = res.data?.data || {};
        setOnlineDrivers(Number(d.onlineDrivers || 0));
        setActiveRidesCount(Number(d.activeRidesCount || 0));
        setMatchTimeSeconds(Number(d.matchTimeSeconds || 0));
        setSurgeMultiplier(Number(d.surgeMultiplier || 1));
        setIncidents(d.incidents || []);
        setActiveRides(d.activeRides || []);
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    refreshRest();
    const poll = setInterval(refreshRest, 15000);
    return () => clearInterval(poll);
  }, []);

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      auth: { token: localStorage.getItem('movr_admin_token') || '' },
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setLive(true);
      socket.emit('admin:live:join', {
        rooms: ['rides', 'deliveries', 'rentals', 'shops'],
      });
    });
    socket.on('disconnect', () => setLive(false));

    const upsert = (payload: any, kind: string) => {
      if (!payload?.id && !payload?.rideId && !payload?.orderId && !payload?.rentalId) return;
      const id = String(payload.id || payload.rideId || payload.orderId || payload.rentalId);
      setMarkers((prev) => {
        const next = prev.filter((m) => m.id !== id);
        next.push({
          id,
          lat: payload.lat ?? payload.latitude ?? payload.pickupLat,
          lng: payload.lng ?? payload.longitude ?? payload.pickupLng,
          status: payload.status,
          kind: payload.kind || kind,
        });
        return next;
      });
    };

    socket.on('admin:live:marker', (payload: any) => upsert(payload, payload.kind || 'ride'));
    socket.on('ride:location', (payload: any) => upsert(payload, 'ride'));
    socket.on('delivery:location', (payload: any) => upsert({ ...payload, id: payload.orderId }, 'parcel'));
    socket.on('rental:location', (payload: any) => upsert({ ...payload, id: payload.rentalId }, 'rental'));

    return () => {
      socket.emit('admin:live:leave');
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const pills: Array<{ key: FilterKey; label: string; count: number }> = [
    { key: 'rides', label: 'Rides', count: counts.rides },
    { key: 'parcels', label: 'Parcels', count: counts.parcels },
    { key: 'shops', label: 'Shops', count: counts.shops },
    { key: 'rentals', label: 'Rentals', count: counts.rentals },
  ];

  const visible = useMemo(() => {
    return markers.filter((m) => {
      const kind = String(m.kind || 'ride').toLowerCase();
      if (active === 'parcels') return kind.includes('parcel') || kind.includes('deliver');
      if (active === 'shops') return kind.includes('shop') || kind.includes('store');
      if (active === 'rentals') return kind.includes('rental');
      return (
        !kind.includes('parcel') &&
        !kind.includes('deliver') &&
        !kind.includes('shop') &&
        !kind.includes('store') &&
        !kind.includes('rental')
      );
    });
  }, [markers, active]);

  const withCoords = visible.filter(
    (m) => m.lat != null && m.lng != null && !Number.isNaN(Number(m.lat)) && !Number.isNaN(Number(m.lng))
  );

  const bounds = useMemo(() => {
    if (!withCoords.length) {
      return { minLat: 5.52, maxLat: 5.68, minLng: -0.26, maxLng: -0.12 };
    }
    const lats = withCoords.map((m) => Number(m.lat));
    const lngs = withCoords.map((m) => Number(m.lng));
    let minLat = Math.min(...lats);
    let maxLat = Math.max(...lats);
    let minLng = Math.min(...lngs);
    let maxLng = Math.max(...lngs);
    if (minLat === maxLat) {
      minLat -= 0.02;
      maxLat += 0.02;
    }
    if (minLng === maxLng) {
      minLng -= 0.02;
      maxLng += 0.02;
    }
    return { minLat, maxLat, minLng, maxLng };
  }, [withCoords]);

  const positioned = withCoords.map((m) => {
    const lat = Number(m.lat);
    const lng = Number(m.lng);
    const left = ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 100;
    const top = ((bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat)) * 100;
    return {
      ...m,
      left: `${clamp(left, 6, 94)}%`,
      top: `${clamp(top, 6, 94)}%`,
      color: markerColor(m),
    };
  });

  const dismissIncident = async (id: string) => {
    try {
      await axios.post(`${API}/admin/live/incidents/${id}/dismiss`, {}, { headers: headers() });
      setIncidents((prev) => prev.filter((i) => i.id !== id));
    } catch (e: any) {
      setMessage(e?.response?.data?.message || e.message || 'Dismiss failed');
    }
  };

  const exportFeed = () => {
    const lines = [
      'type,id,detail',
      ...incidents.map((i) => `incident,${i.id},"${(i.title || '').replace(/"/g, '""')}"`),
      ...activeRides.map((r) => `ride,${r.id},${r.status}`),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `live-ops-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const incidentTone = (i: Incident) => {
    const kind = String(i.kind || '').toLowerCase();
    if (kind === 'sos' || i.severity === 'critical') return { bg: 'rgba(239,68,68,0.15)', border: '#EF4444' };
    return { bg: 'rgba(249,115,22,0.15)', border: '#F97316' };
  };

  return (
    <AdminShell activeLabel="Live Map" hidePageTitle>
      <div style={styles.headerRow}>
        <div>
          <h1 style={styles.h1}>Live Operations Map</h1>
          <p style={styles.sub}>
            {onlineDrivers} active drivers · {counts.rides || activeRidesCount} rides today
            {live ? ' · ● Live' : ' · ○ Offline'}
          </p>
        </div>
        <div style={styles.actions} className="admin-actions">
          {surgeMultiplier > 1 ? (
            <span style={styles.surgePill}>Surge ×{surgeMultiplier.toFixed(1)}</span>
          ) : null}
          <button type="button" style={styles.secondaryBtn} onClick={exportFeed}>
            Export
          </button>
          <Link to="/rides" style={styles.primaryBtn}>
            Force Actions
          </Link>
        </div>
      </div>

      {message ? <p style={styles.error}>{message}</p> : null}

      <div style={styles.layout} data-admin-grid="map" className="admin-split-grid">
        <div style={styles.mapCol}>
          <div style={styles.filters}>
            {pills.map((p) => (
              <button
                key={p.key}
                type="button"
                style={{
                  ...styles.pill,
                  ...(active === p.key ? styles.pillOn : {}),
                }}
                onClick={() => setActive(p.key)}
              >
                {p.label} ({p.count})
              </button>
            ))}
          </div>

          <div style={styles.map}>
            <div style={styles.grid} />
            {positioned.map((m) => (
              <span
                key={m.id}
                title={`${m.kind || 'ride'} · ${m.status || ''}`}
                style={{
                  ...styles.dot,
                  background: m.color,
                  boxShadow: `0 0 12px ${m.color}`,
                  left: m.left,
                  top: m.top,
                }}
              />
            ))}
            {positioned.length === 0 ? <div style={styles.empty}>No active markers</div> : null}

            <div style={styles.statsOverlay}>
              <div>
                <div style={styles.statLabel}>Online drivers</div>
                <div style={styles.statValue}>{onlineDrivers}</div>
              </div>
              <div>
                <div style={styles.statLabel}>Active rides</div>
                <div style={styles.statValue}>{activeRidesCount}</div>
              </div>
              <div>
                <div style={styles.statLabel}>Match time</div>
                <div style={styles.statValue}>{matchTimeSeconds}s</div>
              </div>
            </div>

            <div style={styles.legend}>
              <span style={styles.legendItem}>
                <span style={{ ...styles.legendDot, background: '#A855F7' }} /> Active driver
              </span>
              <span style={styles.legendItem}>
                <span style={{ ...styles.legendDot, background: '#3B82F6' }} /> On trip
              </span>
              <span style={styles.legendItem}>
                <span style={{ ...styles.legendDot, background: '#22C55E' }} /> Pickup
              </span>
            </div>
          </div>
        </div>

        <aside style={styles.sidePanel}>
          <h2 style={styles.panelTitle}>Live Incidents</h2>
          <div style={styles.incidentList}>
            {incidents.length === 0 ? (
              <p style={styles.muted}>No open incidents</p>
            ) : (
              incidents.map((i) => {
                const tone = incidentTone(i);
                return (
                  <div
                    key={i.id}
                    style={{
                      ...styles.incidentCard,
                      background: tone.bg,
                      borderColor: tone.border,
                    }}
                  >
                    <div style={styles.incidentTitle}>{i.title || i.kind}</div>
                    {i.body ? <p style={styles.incidentBody}>{i.body}</p> : null}
                    <div style={styles.incidentActions}>
                      <Link
                        to={i.rideId ? `/rides/${i.rideId}` : '/rides'}
                        style={styles.respondBtn}
                      >
                        Respond
                      </Link>
                      <button type="button" style={styles.dismissBtn} onClick={() => dismissIncident(i.id)}>
                        Dismiss
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <h2 style={{ ...styles.panelTitle, marginTop: 20 }}>Active Rides</h2>
          <div style={styles.rideList}>
            {activeRides.length === 0 ? (
              <p style={styles.muted}>No active rides</p>
            ) : (
              activeRides.map((r) => (
                <Link key={r.id} to={`/rides/${r.id}`} style={styles.rideCard}>
                  <div style={styles.rideTop}>
                    <span style={styles.statusPill}>{r.status}</span>
                    <span style={styles.rideMeta}>{r.minutes}m</span>
                  </div>
                  <div style={styles.rideRoute}>
                    {r.from} → {r.to}
                  </div>
                  <div style={styles.rideFare}>{formatCurrency(r.fare, 'GHS')}</div>
                </Link>
              ))
            )}
          </div>
        </aside>
      </div>
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
  actions: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  surgePill: {
    borderRadius: 999,
    padding: '8px 14px',
    background: 'rgba(249,115,22,0.2)',
    border: '1px solid #F97316',
    color: '#FDBA74',
    fontWeight: 700,
    fontSize: 13,
  },
  primaryBtn: { ...adminBtn.primary },
  layout: { display: 'grid', gridTemplateColumns: '1.6fr 360px', gap: 16, alignItems: 'start' },
  mapCol: { minWidth: 0 },
  filters: { display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' },
  pill: {
    border: '1px solid var(--border)',
    borderRadius: 999,
    padding: '8px 16px',
    background: 'var(--surface)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 14,
  },
  pillOn: {
    background: 'linear-gradient(90deg, rgba(142,45,226,0.35), rgba(74,0,224,0.35))',
    border: '1px solid #8E2DE2',
    color: 'var(--brand-white)',
  },
  map: {
    position: 'relative',
    height: '70vh',
    borderRadius: 16,
    background: 'var(--surface)',
    overflow: 'hidden',
    border: '1px solid var(--border)',
  },
  grid: {
    position: 'absolute',
    inset: 0,
    opacity: 0.45,
    backgroundImage:
      'linear-gradient(#2a2a2a 1px, transparent 1px), linear-gradient(90deg, #2a2a2a 1px, transparent 1px)',
    backgroundSize: '28px 28px',
    transform: 'skewY(-2deg) scale(1.05)',
  },
  dot: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: '50%',
    zIndex: 2,
  },
  empty: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-secondary)',
    pointerEvents: 'none',
    zIndex: 1,
  },
  statsOverlay: {
    position: 'absolute',
    top: 16,
    left: 16,
    display: 'flex',
    gap: 16,
    background: 'rgba(10,10,10,0.85)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: '12px 16px',
    zIndex: 3,
  },
  statLabel: { fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 },
  statValue: { fontSize: 20, fontWeight: 700, marginTop: 2 },
  legend: {
    position: 'absolute',
    left: 16,
    bottom: 16,
    display: 'flex',
    gap: 14,
    background: 'rgba(10,10,10,0.85)',
    borderRadius: 999,
    padding: '8px 14px',
    fontSize: 12,
    fontWeight: 600,
    zIndex: 3,
    border: '1px solid var(--border)',
  },
  legendItem: { display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-primary)' },
  legendDot: { width: 8, height: 8, borderRadius: '50%', display: 'inline-block' },
  sidePanel: {
    background: 'var(--surface-elevated)',
    borderRadius: 14,
    border: '1px solid var(--border)',
    padding: 16,
    maxHeight: '78vh',
    overflowY: 'auto',
  },
  panelTitle: { fontSize: 15, fontWeight: 700, margin: '0 0 12px' },
  muted: { color: 'var(--text-secondary)', margin: 0, fontSize: 13 },
  incidentList: { display: 'flex', flexDirection: 'column', gap: 10 },
  incidentCard: {
    borderRadius: 12,
    border: '1px solid',
    padding: 12,
  },
  incidentTitle: { fontWeight: 700, fontSize: 13 },
  incidentBody: { margin: '6px 0 0', fontSize: 12, color: 'var(--text-secondary)' },
  incidentActions: { display: 'flex', gap: 8, marginTop: 10 },
  respondBtn: {
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--motion-blue)',
    textDecoration: 'none',
  },
  dismissBtn: {
    border: 'none',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    padding: 0,
  },
  rideList: { display: 'flex', flexDirection: 'column', gap: 8 },
  rideCard: {
    display: 'block',
    padding: 12,
    borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    textDecoration: 'none',
    color: 'inherit',
  },
  rideTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  statusPill: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 999,
    background: 'rgba(142,45,226,0.2)',
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'capitalize',
  },
  rideMeta: { fontSize: 12, color: 'var(--text-secondary)' },
  rideRoute: { fontSize: 13, fontWeight: 600 },
  rideFare: { fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 },
};
