import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import AdminShell from '../layouts/AdminShell';
import AdminOpsNav from '../components/AdminOpsNav';

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

type FilterKey = 'rides' | 'parcels' | 'shops' | 'rentals';

const KIND_COLOR: Record<string, string> = {
  ride: '#3B82F6',
  rides: '#3B82F6',
  parcel: '#22C55E',
  parcels: '#22C55E',
  delivery: '#22C55E',
  shop: '#EAB308',
  shops: '#EAB308',
  rental: '#A855F7',
  rentals: '#A855F7',
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** Admin live ops map — filters + markers (Phase 17). */
export default function AdminLiveMapPage() {
  const [active, setActive] = useState<FilterKey>('rides');
  const [counts, setCounts] = useState({ rides: 0, parcels: 0, shops: 0, rentals: 0 });
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [live, setLive] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const refreshRest = () => {
    const headers = { Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}` };
    axios
      .get(`${API}/admin/live/counts`, { headers })
      .then((res) => {
        if (res.data?.data) setCounts({ rides: 0, parcels: 0, shops: 0, rentals: 0, ...res.data.data });
      })
      .catch(() => setCounts({ rides: 0, parcels: 0, shops: 0, rentals: 0 }));

    axios
      .get(`${API}/admin/live/markers`, { headers })
      .then((res) => setMarkers(res.data?.data || []))
      .catch(() => setMarkers([]));
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

  const total = counts.rides + counts.parcels + counts.shops + counts.rentals;

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
    // Accra default viewport when sparse
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
    const kind = String(m.kind || 'ride').toLowerCase();
    return {
      ...m,
      left: `${clamp(left, 6, 94)}%`,
      top: `${clamp(top, 6, 94)}%`,
      color: KIND_COLOR[kind] || '#3B82F6',
    };
  });

  return (
    <AdminShell activeLabel="Live map" hidePageTitle>
      <AdminOpsNav />
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
        <span style={styles.liveHint}>{live ? '● Live' : '○ Offline'}</span>
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
        <div style={styles.badge}>
          Accra region · {total} active
        </div>
      </div>
    </AdminShell>
  );
}

const styles: Record<string, React.CSSProperties> = {
  filters: { display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' },
  pill: {
    border: '1px solid #333',
    borderRadius: 999,
    padding: '8px 16px',
    background: '#141414',
    color: '#888',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 14,
  },
  pillOn: {
    background: 'linear-gradient(90deg, rgba(142,45,226,0.35), rgba(74,0,224,0.35))',
    border: '1px solid #8E2DE2',
    color: '#fff',
  },
  liveHint: { marginLeft: 8, fontSize: 12, color: '#666' },
  map: {
    position: 'relative',
    height: '70vh',
    borderRadius: 16,
    background: '#1A1A1A',
    overflow: 'hidden',
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
  },
  empty: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#888',
    pointerEvents: 'none',
    zIndex: 1,
  },
  badge: {
    position: 'absolute',
    left: 16,
    bottom: 16,
    background: '#0a0a0a',
    borderRadius: 999,
    padding: '8px 14px',
    fontSize: 13,
    fontWeight: 600,
    color: '#fff',
    zIndex: 2,
  },
};
