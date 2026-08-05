import React, { useEffect, useState } from 'react';
import axios from 'axios';
import AdminShell from '../layouts/AdminShell';
import { formatCurrency } from '../lib/currency';

const API = process.env.REACT_APP_API_URL || '/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}` });

/** Vehicle types & pricing table — multi-country, edit + add. */
export default function VehiclePricingPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    baseFare: '',
    perKmRate: '',
    perMinuteRate: '',
    minimumFare: '',
    currencyCode: 'GHS',
    countryCode: 'GH',
    name: '',
    code: '',
  });

  const load = async () => {
    const res = await axios.get(`${API}/admin/vehicle-types`, { headers: headers() });
    const list = res.data.data || [];
    if (!list.length) {
      setRows([]);
      return;
    }
    const enriched = await Promise.all(
      list.map(async (t: any) => {
        try {
          const p = await axios.get(`${API}/admin/vehicle-types/${t.id}/pricing`, {
            headers: headers(),
          });
          const price = (p.data.data || []).find((x: any) => x.country_code === 'GH') || p.data.data?.[0];
          return {
            id: t.id,
            name: t.name,
            base_fare: Number(price?.base_fare ?? 0),
            per_km_rate: Number(price?.per_km_rate ?? 0),
            per_minute_rate: Number(price?.per_minute_rate ?? 0),
            minimum_fare: Number(price?.minimum_fare ?? 0),
          };
        } catch {
          return { id: t.id, name: t.name, base_fare: 0, per_km_rate: 0, per_minute_rate: 0, minimum_fare: 0 };
        }
      })
    );
    setRows(enriched);
  };

  useEffect(() => {
    load()
      .then(() => setError(''))
      .catch((e) => {
        setRows([]);
        setError(e?.response?.data?.message || e.message || 'Failed to load vehicle types');
      });
  }, []);

  const openEdit = (t: any) => {
    setSelected(t);
    setForm({
      baseFare: String(t.base_fare ?? ''),
      perKmRate: String(t.per_km_rate ?? ''),
      perMinuteRate: String(t.per_minute_rate ?? ''),
      minimumFare: String(t.minimum_fare ?? ''),
      currencyCode: 'GHS',
      countryCode: 'GH',
      name: t.name || '',
      code: '',
    });
  };

  const save = async () => {
    if (!selected?.id) return;
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
    setSelected(null);
    await load();
  };

  const addType = async () => {
    await axios.post(
      `${API}/admin/vehicle-types`,
      {
        name: form.name || 'New type',
        code: form.code || `type_${Date.now()}`,
        category: 'car',
      },
      { headers: headers() }
    );
    setShowAdd(false);
    await load();
  };

  const money = (n: number, code = form.currencyCode || 'GHS') =>
    formatCurrency(Number(n), code);

  return (
    <AdminShell activeLabel="Vehicle pricing">
      <div style={styles.header}>
        <h1 style={styles.h1}>Vehicle types & pricing · multi-country</h1>
        <button
          style={styles.addBtn}
          onClick={() => {
            setShowAdd(true);
            setSelected(null);
            setForm({
              baseFare: '',
              perKmRate: '',
              perMinuteRate: '',
              minimumFare: '',
              currencyCode: 'GHS',
              countryCode: 'GH',
              name: '',
              code: '',
            });
          }}
        >
          + Add vehicle type
        </button>
      </div>

      {error ? <p style={{ color: 'var(--error)' }}>{error}</p> : null}

      <div style={styles.tableWrap}>
        <div style={styles.thead}>
          <span>Vehicle type</span>
          <span>Base fare</span>
          <span>Per km</span>
          <span>Per min</span>
          <span>Minimum</span>
          <span />
        </div>
        {rows.length === 0 ? (
          <div style={styles.empty}>No vehicle types configured</div>
        ) : (
          rows.map((r) => (
            <div key={r.id} style={styles.row}>
              <span style={{ fontWeight: 600 }}>{r.name}</span>
              <span>{money(r.base_fare)}</span>
              <span>{money(r.per_km_rate)}</span>
              <span>{money(r.per_minute_rate)}</span>
              <span>{money(r.minimum_fare)}</span>
              <button style={styles.edit} onClick={() => openEdit(r)}>
                Edit
              </button>
            </div>
          ))
        )}
      </div>

      {(selected || showAdd) && (
        <div style={styles.panel}>
          <h2 style={{ marginTop: 0 }}>{showAdd ? 'Add vehicle type' : `Edit ${selected?.name}`}</h2>
          {showAdd ? (
            <>
              <input
                style={styles.input}
                placeholder="Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <input
                style={styles.input}
                placeholder="Code"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </>
          ) : null}
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
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              style={styles.addBtn}
              onClick={() => (showAdd ? addType() : save()).catch((e) => setError(e.message))}
            >
              Save
            </button>
            <button
              style={styles.ghost}
              onClick={() => {
                setSelected(null);
                setShowAdd(false);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </AdminShell>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  h1: { fontSize: 24, margin: 0, fontWeight: 700 },
  addBtn: {
    background: 'linear-gradient(90deg, var(--electric-violet), var(--motion-blue))',
    border: 'none',
    color: 'var(--pure-white)',
    borderRadius: 999,
    padding: '10px 16px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  tableWrap: {
    border: '1px solid var(--border)',
    borderRadius: 16,
    overflow: 'hidden',
    background: 'var(--surface)',
  },
  thead: {
    display: 'grid',
    gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1fr 0.6fr',
    gap: 8,
    padding: '14px 16px',
    color: 'var(--text-secondary)',
    fontSize: 13,
    borderBottom: '1px solid var(--surface-elevated)',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1fr 0.6fr',
    gap: 8,
    padding: '16px',
    borderBottom: '1px solid var(--surface-elevated)',
    alignItems: 'center',
    color: 'var(--text-secondary)',
  },
  empty: { padding: 24, color: 'var(--text-secondary)' },
  edit: {
    background: 'transparent',
    border: 'none',
    color: 'var(--motion-blue)',
    cursor: 'pointer',
    fontWeight: 600,
    justifySelf: 'end',
  },
  panel: {
    marginTop: 20,
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: 16,
    background: 'var(--surface-elevated)',
  },
  form: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))',
    gap: 8,
    marginTop: 12,
  },
  input: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    color: 'var(--pure-white)',
    borderRadius: 8,
    padding: 10,
    width: '100%',
    marginBottom: 8,
  },
  ghost: {
    background: 'transparent',
    border: '1px solid var(--border)',
    color: 'var(--pure-white)',
    borderRadius: 999,
    padding: '10px 16px',
    cursor: 'pointer',
  },
};
