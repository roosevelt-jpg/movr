import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';

/** Public read-only live trip share (no auth) — polls + socket when available. */
const TripSharePage: React.FC = () => {
  const { token } = useParams();
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
    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [token]);

  useEffect(() => {
    if (!data?.ride?.id) return;
    const io = (window as any).io;
    if (!io) return;
    const socket = io(API.replace(/\/api\/v1$/, ''), { transports: ['websocket'] });
    socket.emit('ride:join', data.ride.id);
    socket.on('ride:location', (payload: any) => {
      if (payload?.lat != null) {
        setLive({ lat: payload.lat, lng: payload.lng, at: new Date().toISOString() });
      }
    });
    return () => socket.disconnect();
  }, [data?.ride?.id]);

  const lat = live?.lat ?? data?.ride?.pickup_lat;
  const lng = live?.lng ?? data?.ride?.pickup_lng;

  return (
    <div className="min-h-screen bg-jet-black text-pure-white px-6 py-10 font-[Poppins,Montserrat,sans-serif]">
      <h1 className="text-2xl font-bold mb-2">Live trip</h1>
      <p className="text-text-secondary mb-6">Read-only share link — no account required.</p>
      {error ? <p className="text-error">{error}</p> : null}
      {data ? (
        <>
          <p>Status: {data.ride?.status}</p>
          <p className="text-text-secondary text-sm">Room: {data.room}</p>
          {live ? (
            <p className="text-success text-sm mt-2">Live update · {live.at}</p>
          ) : (
            <p className="text-text-secondary text-sm mt-2">Waiting for live location…</p>
          )}
          <div className="mt-6 h-80 rounded-2xl border border-border bg-surface flex flex-col items-center justify-center text-text-secondary gap-2">
            <span>Map pin</span>
            <span>
              {lat}, {lng}
            </span>
          </div>
        </>
      ) : !error ? (
        <p className="text-text-secondary">Loading…</p>
      ) : null}
    </div>
  );
};

export default TripSharePage;
