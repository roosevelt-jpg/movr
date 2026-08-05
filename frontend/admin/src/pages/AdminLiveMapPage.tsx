import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';
import AdminShell from '../layouts/AdminShell';

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

const KIND_COLOR: Record<string, string> = {
  ride: 'var(--motion-blue)',
  rides: 'var(--motion-blue)',
  parcel: 'var(--movr-green)',
  parcels: 'var(--movr-green)',
  delivery: 'var(--movr-green)',
  shop: 'var(--warning)',
  shops: 'var(--warning)',
  rental: 'var(--electric-violet)',
  rentals: 'var(--electric-violet)',
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** Admin live ops map — Socket.io rooms + filter toggles (Phase 17). */
export default function AdminLiveMapPage() {
  const [filters, setFilters] = useState({
    rides: true,
    parcels: true,
    shops: true,
    rentals: true,
  });
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
  }, [filters]);

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
    socket.on('location:updated', (payload: any) => {
      if (payload?.role === 'driver' || payload?.kind) upsert(payload, payload.kind || 'ride');
    });

    return () => {
      socket.emit('admin:live:leave');
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const total =
    (filters.rides ? counts.rides : 0) +
    (filters.parcels ? counts.parcels : 0) +
    (filters.shops ? counts.shops : 0) +
    (filters.rentals ? counts.rentals : 0);

  const pills: Array<{ key: keyof typeof filters; label: string; count: number }> = [
    { key: 'rides', label: 'Rides', count: counts.rides },
    { key: 'parcels', label: 'Parcels', count: counts.parcels },
    { key: 'shops', label: 'Shops', count: counts.shops },
    { key: 'rentals', label: 'Rentals', count: counts.rentals },
  ];

  const visible = useMemo(() => {
    return markers.filter((m) => {
      const kind = String(m.kind || 'ride').toLowerCase();
      if (kind.includes('parcel') || kind.includes('deliver')) return filters.parcels;
      if (kind.includes('shop') || kind.includes('store')) return filters.shops;
      if (kind.includes('rental')) return filters.rentals;
      return filters.rides;
    });
  }, [markers, filters]);

  const withCoords = visible.filter(
    (m) => m.lat != null && m.lng != null && !Number.isNaN(Number(m.lat)) && !Number.isNaN(Number(m.lng))
  );
  const withoutCoords = visible.filter(
    (m) => m.lat == null || m.lng == null || Number.isNaN(Number(m.lat)) || Number.isNaN(Number(m.lng))
  );

  const bounds = useMemo(() => {
    if (!withCoords.length) return null;
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
    let left = 50;
    let top = 50;
    if (bounds) {
      left = ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 100;
      top = ((bounds.maxLat - lat) / (bounds.maxLat - bounds.minLat)) * 100;
    }
    const kind = String(m.kind || 'ride').toLowerCase();
    return {
      ...m,
      left: `${clamp(left, 4, 96)}%`,
      top: `${clamp(top, 4, 96)}%`,
      color: KIND_COLOR[kind] || 'var(--motion-blue)',
    };
  });

  return (
    <AdminShell activeLabel="Live map">
      <div style={styles.filters}>
        {pills.map((p) => (
          <button
            key={p.key}
            style={{
              ...styles.pill,
              ...(filters[p.key] ? styles.pillOn : {}),
            }}
            onClick={() => setFilters((f) => ({ ...f, [p.key]: !f[p.key] }))}
          >
            {p.label} ({p.count})
          </button>
        ))}
        <span style={styles.liveDot}>
          <span style={{ ...styles.dotInline, background: live ? 'var(--success)' : 'var(--text-secondary)' }} />
          {live ? 'Live' : 'Reconnecting…'}
        </span>
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
              left: m.left,
              top: m.top,
            }}
          />
        ))}
        {visible.length === 0 ? (
          <div style={styles.empty}>No active markers</div>
        ) : null}
        {withoutCoords.length > 0 ? (
          <div style={styles.list}>
            {withoutCoords.map((m) => (
              <div key={m.id} style={styles.listItem}>
                {m.kind || 'item'} #{String(m.id).slice(0, 8)} · {m.status || '—'}
              </div>
            ))}
          </div>
        ) : null}
        <div style={styles.badge}>
          Accra region · {total} active · sockets: rides/deliveries/rentals
        </div>
      </div>
    </AdminShell>
  );
}

const styles: Record<string, React.CSSProperties> = {
  filters: { display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' },
  pill: {
    border: '1px solid var(--border)',
    borderRadius: 999,
    padding: '8px 14px',
    background: 'transparent',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontWeight: 600,
  },
  pillOn: {
    background: 'var(--surface-elevated)',
    borderColor: 'var(--surface-elevated)',
    color: 'var(--pure-white)',
  },
  liveDot: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    color: 'var(--text-secondary)',
    fontSize: 13,
    marginLeft: 8,
  },
  dotInline: { width: 8, height: 8, borderRadius: '50%', display: 'inline-block' },
  map: {
    position: 'relative',
    height: '70vh',
    borderRadius: 16,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    overflow: 'hidden',
  },
  grid: {
    position: 'absolute',
    inset: 0,
    opacity: 0.35,
    backgroundImage:
      'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
    backgroundSize: '32px 32px',
  },
  dot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: '50%',
  },
  empty: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-secondary)',
    pointerEvents: 'none',
  },
  list: {
    position: 'absolute',
    top: 16,
    right: 16,
    maxWidth: 280,
    maxHeight: '60%',
    overflow: 'auto',
    background: 'rgba(0,0,0,0.85)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 10,
  },
  listItem: { fontSize: 12, color: 'var(--text-secondary)', padding: '4px 0' },
  badge: {
    position: 'absolute',
    left: 16,
    bottom: 16,
    background: 'var(--jet-black)',
    border: '1px solid var(--border)',
    borderRadius: 999,
    padding: '8px 12px',
    fontSize: 13,
    fontWeight: 600,
  },
};
