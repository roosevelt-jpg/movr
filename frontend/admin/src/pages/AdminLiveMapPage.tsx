import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';

export default function AdminLiveMapPage() {
  const [filters, setFilters] = useState({
    rides: true,
    parcels: true,
    shops: false,
    rentals: false,
  });

  useEffect(() => {
    // Subscribe to Socket.io rooms: ride:*, delivery:*, rental:* when socket client is wired
  }, [filters]);

  return (
    <div style={styles.page}>
      <h1 style={styles.h1}>Live ops map</h1>
      <p style={styles.sub}>Rides, parcels, shops, rentals — one map.</p>
      <div style={styles.filters}>
        {(Object.keys(filters) as Array<keyof typeof filters>).map((key) => (
          <label key={key} style={styles.chip}>
            <input
              type="checkbox"
              checked={filters[key]}
              onChange={() => setFilters((f) => ({ ...f, [key]: !f[key] }))}
            />{' '}
            {key}
          </label>
        ))}
      </div>
      <div style={styles.map}>
        Color-coded markers · socket rooms ride / delivery / rental
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#000', color: '#fff', padding: 32, fontFamily: 'Poppins, sans-serif' },
  h1: { fontSize: 24, marginBottom: 8 },
  sub: { color: '#A0A0A0', marginBottom: 16 },
  filters: { display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' },
  chip: {
    border: '1px solid #2A2A2A',
    borderRadius: 999,
    padding: '8px 14px',
    textTransform: 'capitalize',
  },
  map: {
    height: '70vh',
    borderRadius: 16,
    border: '1px solid #2A2A2A',
    background: '#0A0A0A',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#A0A0A0',
  },
};
