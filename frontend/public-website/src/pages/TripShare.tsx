import React, { useEffect, useState } from 'react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';

/** Public read-only live trip map page (Phase 12). */
export default function TripShare() {
  const token = typeof window !== 'undefined' ? window.location.pathname.split('/').pop() : '';
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    fetch(`${API}/public/trip/${token}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.status !== 'success') setError(j.message || 'Unavailable');
        else setData(j.data);
      })
      .catch((e) => setError(e.message));
  }, [token]);

  return (
    <div style={{ minHeight: '100vh', background: '#000', color: '#fff', fontFamily: 'Poppins, sans-serif', padding: 24 }}>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>Live trip</h1>
      <p style={{ color: '#A0A0A0', marginBottom: 24 }}>Read-only share link — no account required.</p>
      {error ? <p style={{ color: '#FF3B5C' }}>{error}</p> : null}
      {data ? (
        <>
          <p>Status: {data.ride?.status}</p>
          <p style={{ color: '#A0A0A0' }}>Socket room: {data.room}</p>
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
            }}
          >
            Map · pickup {data.ride?.pickup_lat},{data.ride?.pickup_lng}
          </div>
        </>
      ) : !error ? (
        <p style={{ color: '#A0A0A0' }}>Loading…</p>
      ) : null}
    </div>
  );
}
