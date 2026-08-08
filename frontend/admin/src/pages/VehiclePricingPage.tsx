import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import AdminShell from '../layouts/AdminShell';
import { formatCurrency } from '../lib/currency';
import { adminBtn } from '../styles/adminButtons';

const API = process.env.REACT_APP_API_URL || '/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}` });

const MOCKUP_ORDER = ['Motorcycle', 'Tricycle', 'Sedan', 'SUV', 'Van', 'Luxury'];

/** Vehicle types & pricing · Ghana. */
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
    category: 'sedan',
  });

  const load = async () => {
    const res = await axios.get(`${API}/admin/vehicle-types`, { headers: headers() });
    const list = (res.data.data || []).filter((t: any) => t.is_active !== false);
    const enriched = await Promise.all(
      list.map(async (t: any) => {
        try {
          const p = await axios.get(`${API}/admin/vehicle-types/${t.id}/pricing`, {
            headers: headers(),
          });
          const price =
            (p.data.data || []).find((x: any) => x.country_code === 'GH') || p.data.data?.[0];
          return {
            id: t.id,
            name: t.name,
            code: t.code,
            base_fare: Number(price?.base_fare ?? 0),
            per_km_rate: Number(price?.per_km_rate ?? 0),
            per_minute_rate: Number(price?.per_minute_rate ?? 0),
            minimum_fare: Number(price?.minimum_fare ?? 0),
          };
        } catch {
          return {
            id: t.id,
            name: t.name,
            code: t.code,
            base_fare: 0,
            per_km_rate: 0,
            per_minute_rate: 0,
            minimum_fare: 0,
          };
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

  const displayRows = useMemo(() => {
    const preferred = MOCKUP_ORDER.map((name) =>
      rows.find((r) => String(r.name).toLowerCase() === name.toLowerCase())
    ).filter(Boolean);
    const preferredIds = new Set(preferred.map((r: any) => r.id));
    const rest = rows.filter((r) => !preferredIds.has(r.id));
    // Prefer mockup six; if Sedan missing use Standard-named
    return preferred.length ? [...preferred, ...rest] : rows;
  }, [rows]);

  const openEdit = (t: any) => {
    setSelected(t);
    setShowAdd(false);
    setForm({
      baseFare: String(t.base_fare ?? ''),
      perKmRate: String(t.per_km_rate ?? ''),
      perMinuteRate: String(t.per_minute_rate ?? ''),
      minimumFare: String(t.minimum_fare ?? ''),
      currencyCode: 'GHS',
      countryCode: 'GH',
      name: t.name || '',
      code: '',
      category: 'sedan',
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
        reason: 'Admin pricing update',
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
        category: form.category || 'sedan',
        baseFare: Number(form.baseFare || 6),
        perKmRate: Number(form.perKmRate || 1.5),
        perMinuteRate: Number(form.perMinuteRate || 0.25),
        minimumFare: Number(form.minimumFare || 12),
        reason: 'Admin create vehicle type',
      },
      { headers: headers() }
    );
    setShowAdd(false);
    await load();
  };

  const money = (n: number) => formatCurrency(Number(n), 'GHS');

  return (
    <AdminShell activeLabel="Vehicle pricing">
      <div style={styles.header}>
        <h1 style={styles.h1}>Vehicle types & pricing · Ghana</h1>
        <button
          type="button"
          style={styles.addBtn}
          onClick={() => {
            setShowAdd(true);
            setSelected(null);
            setForm({
              baseFare: '6.00',
              perKmRate: '1.50',
              perMinuteRate: '0.25',
              minimumFare: '12.00',
              currencyCode: 'GHS',
              countryCode: 'GH',
              name: '',
              code: '',
              category: 'sedan',
            });
          }}
        >
          + Add vehicle type
        </button>
      </div>

      {error ? <p style={{ color: '#f87171' }}>{error}</p> : null}

      <div style={styles.tableWrap}>
        <div style={styles.thead}>
          <span>Vehicle type</span>
          <span>Base fare</span>
          <span>Per km</span>
          <span>Per min</span>
          <span>Minimum</span>
          <span>Action</span>
        </div>
        {displayRows.length === 0 ? (
          <div style={styles.empty}>No vehicle types configured</div>
        ) : (
          displayRows.map((r: any) => (
            <div key={r.id} style={styles.row}>
              <span style={{ fontWeight: 600, color: '#fff' }}>{r.name}</span>
              <span style={{ color: '#fff' }}>{money(r.base_fare)}</span>
              <span style={{ color: '#fff' }}>{money(r.per_km_rate)}</span>
              <span style={{ color: '#fff' }}>{money(r.per_minute_rate)}</span>
              <span style={{ color: '#fff' }}>{money(r.minimum_fare)}</span>
              <button type="button" style={styles.edit} onClick={() => openEdit(r)}>
                Edit
              </button>
            </div>
          ))
        )}
      </div>

      {(selected || showAdd) && (
        <div style={styles.panel}>
          <h2 style={{ marginTop: 0, color: '#fff' }}>
            {showAdd ? 'Add vehicle type' : `Edit ${selected?.name}`}
          </h2>
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
              <select
                style={styles.input}
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {['motorcycle', 'tricycle', 'sedan', 'suv', 'van', 'luxury'].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
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
              type="button"
              style={styles.addBtn}
              onClick={() => (showAdd ? addType() : save()).catch((e) => setError(e.message))}
            >
              {showAdd ? 'Create' : 'Save'}
            </button>
            <button
              type="button"
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
  h1: { fontSize: 24, margin: 0, fontWeight: 700, color: '#fff' },
  addBtn: { ...adminBtn.primary },
  tableWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    background: '#0a0a0a',
  },
  thead: {
    display: 'grid',
    gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1fr 0.6fr',
    gap: 8,
    padding: '14px 16px',
    color: '#888',
    fontSize: 13,
    borderBottom: '1px solid #222',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1.2fr 1fr 1fr 1fr 1fr 0.6fr',
    gap: 8,
    padding: '16px',
    borderBottom: '1px solid #222',
    alignItems: 'center',
  },
  empty: { padding: 24, color: '#888' },
  edit: {
    background: 'transparent',
    border: 'none',
    color: '#3B82F6',
    cursor: 'pointer',
    fontWeight: 600,
    justifySelf: 'start',
  },
  panel: {
    marginTop: 20,
    borderRadius: 14,
    padding: 16,
    background: '#1A1A1A',
  },
  form: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))',
    gap: 8,
    marginTop: 12,
  },
  input: {
    background: '#111',
    border: '1px solid #333',
    color: '#fff',
    borderRadius: 8,
    padding: 10,
    width: '100%',
    marginBottom: 8,
  },
  ghost: { ...adminBtn.secondary },
};
