import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}` });

export default function VehiclePricingPage() {
  const [types, setTypes] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [pricing, setPricing] = useState<any[]>([]);
  const [form, setForm] = useState({
    baseFare: '',
    perKmRate: '',
    perMinuteRate: '',
    minimumFare: '',
    currencyCode: 'GHS',
    countryCode: 'GH',
  });

  const load = async () => {
    const res = await axios.get(`${API}/admin/vehicle-types`, { headers: headers() });
    setTypes(res.data.data || []);
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  const open = async (t: any) => {
    setSelected(t);
    const res = await axios.get(`${API}/admin/vehicle-types/${t.id}/pricing`, { headers: headers() });
    setPricing(res.data.data || []);
  };

  const save = async () => {
    if (!selected) return;
    await axios.patch(
      `${API}/admin/vehicle-types/${selected.id}/pricing`,
      {
        baseFare: Number(form.baseFare),
        perKmRate: Number(form.perKmRate),
        perMinuteRate: Number(form.perMinuteRate),
        minimumFare: Number(form.minimumFare || 0),
        currencyCode: form.currencyCode,
        countryCode: form.countryCode,
      },
      { headers: headers() }
    );
    await open(selected);
  };

  return (
    <div style={styles.page}>
      <h1 style={styles.h1}>Vehicle types & pricing</h1>
      <p style={styles.sub}>Change fares without a redeploy.</p>
      <div style={styles.grid}>
        {types.map((t) => (
          <button key={t.id} style={styles.card} onClick={() => open(t)}>
            <strong>{t.name}</strong>
            <div style={styles.meta}>{t.code} · {t.category} · {t.is_active ? 'on' : 'off'}</div>
          </button>
        ))}
      </div>

      {selected ? (
        <div style={styles.panel}>
          <h2>{selected.name} pricing</h2>
          {pricing.slice(0, 3).map((p) => (
            <div key={p.id} style={styles.meta}>
              {p.country_code} · base {p.base_fare} · /km {p.per_km_rate} · /min {p.per_minute_rate} · {p.currency_code}
            </div>
          ))}
          <div style={styles.form}>
            {(['baseFare', 'perKmRate', 'perMinuteRate', 'minimumFare'] as const).map((k) => (
              <input
                key={k}
                placeholder={k}
                style={styles.input}
                value={(form as any)[k]}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              />
            ))}
            <button style={styles.btn} onClick={save}>Add pricing row</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#000', color: '#fff', padding: 32, fontFamily: 'Poppins, sans-serif' },
  h1: { fontSize: 24, marginBottom: 8 },
  sub: { color: '#A0A0A0', marginBottom: 16 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12 },
  card: {
    textAlign: 'left',
    background: '#0A0A0A',
    border: '1px solid #2A2A2A',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    cursor: 'pointer',
  },
  meta: { color: '#A0A0A0', fontSize: 13, marginTop: 6 },
  panel: { marginTop: 24, border: '1px solid #2A2A2A', borderRadius: 12, padding: 16 },
  form: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 8, marginTop: 12 },
  input: { background: '#0A0A0A', border: '1px solid #2A2A2A', color: '#fff', borderRadius: 8, padding: 10 },
  btn: {
    background: 'linear-gradient(135deg, #3F7048 0%, #6A00FF 50%, #0055FF 100%)',
    border: 'none',
    color: '#fff',
    borderRadius: 999,
    padding: '10px 14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
};
