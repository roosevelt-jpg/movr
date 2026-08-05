import React, { useEffect, useState } from 'react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';

/** Public read-only live trip map page (Phase 12) — polls + optional socket room. */
export default function TripShare() {
  const token = typeof window !== 'undefined' ? window.location.pathname.split('/').pop() : '';
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [live, setLive] = useState<{ lat?: number; lng?: number; at?: string } | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    const load = () =>
      fetch(`${API}/public/trip/${token}`)
        .then((r) => r.json())
        .then((j) => {
          if (cancelled) return;
          if (j.status !== 'success') setError(j.message || 'Unavailable');
          else {
            setData(j.data);
            setError('');
          }
        })
        .catch((e) => {
          if (!cancelled) setError(e.message);
        });

    load();
    const poll = setInterval(load, 8000);

    // Soft socket subscribe when socket.io-client is available globally
    let socket: any;
    try {
      const io = (window as any).io;
      if (io) {
        socket = io(API.replace(/\/api\/v1$/, ''), { transports: ['websocket'] });
        socket.on('connect', () => {
          /* room joined after data loads */
        });
      }
    } catch {
      /* optional */
    }

    return () => {
      cancelled = true;
      clearInterval(poll);
      socket?.disconnect?.();
    };
  }, [token]);

  useEffect(() => {
    if (!data?.room) return;
    const io = (window as any).io;
    if (!io) return;
    const socket = io(API.replace(/\/api\/v1$/, ''), { transports: ['websocket'] });
    socket.emit('ride:join', data.ride?.id);
    socket.on('ride:location', (payload: any) => {
      if (payload?.lat != null) {
        setLive({ lat: payload.lat, lng: payload.lng, at: new Date().toISOString() });
      }
    });
    return () => socket.disconnect();
  }, [data?.room, data?.ride?.id]);

  const lat = live?.lat ?? data?.ride?.pickup_lat;
  const lng = live?.lng ?? data?.ride?.pickup_lng;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0A0A0A',
        color: '#fff',
        fontFamily: 'Poppins, sans-serif',
        padding: 24,
      }}
    >
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>Live trip</h1>
      <p style={{ color: '#A0A0A0', marginBottom: 24 }}>
        Read-only share link — no account required.
      </p>
      {error ? <p style={{ color: '#FF3B5C' }}>{error}</p> : null}
      {data ? (
        <>
          <p>Status: {data.ride?.status}</p>
          <p style={{ color: '#A0A0A0' }}>Room: {data.room}</p>
          {live ? (
            <p style={{ color: '#00C853' }}>Live update · {live.at}</p>
          ) : (
            <p style={{ color: '#A0A0A0' }}>Waiting for live location…</p>
          )}
          <div
            style={{
              marginTop: 24,
              height: 360,
              borderRadius: 16,
              border: '1px solid #2A2A2A',
              background: '#0A0A0A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#A0A0A0',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <span>Map pin</span>
            <span>
              {lat}, {lng}
            </span>
          </div>
        </>
      ) : !error ? (
        <p style={{ color: '#A0A0A0' }}>Loading…</p>
      ) : null}
    </div>
  );
}
