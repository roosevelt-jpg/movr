import React, { useEffect, useState } from 'react';
import axios from 'axios';
import AdminShell from '../layouts/AdminShell';
import { formatCurrency } from '../lib/currency';

const API = process.env.REACT_APP_API_URL || '/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}` });

/** Vehicle types & pricing table — multi-country ride fares + rental rates. */
export default function VehiclePricingPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [rentalRows, setRentalRows] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState('');
  const [rentalEdit, setRentalEdit] = useState<any>(null);
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
    iconUrl: '',
    effectiveFrom: '',
    scheduleMode: 'now' as 'now' | 'later',
  });

  const load = async () => {
    const res = await axios.get(`${API}/admin/vehicle-types`, { headers: headers() });
    const list = res.data.data || [];
    if (!list.length) {
      setRows([]);
    } else {
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
              base_fare: Number(price?.base_fare ?? 0),
              per_km_rate: Number(price?.per_km_rate ?? 0),
              per_minute_rate: Number(price?.per_minute_rate ?? 0),
              minimum_fare: Number(price?.minimum_fare ?? 0),
            };
          } catch {
            return {
              id: t.id,
              name: t.name,
              base_fare: 0,
              per_km_rate: 0,
              per_minute_rate: 0,
              minimum_fare: 0,
            };
          }
        })
      );
      setRows(enriched);
    }

    try {
      const rp = await axios.get(`${API}/admin/rental-pricing`, { headers: headers() });
      setRentalRows(rp.data.data || []);
    } catch {
      setRentalRows([]);
    }
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
      category: 'sedan',
      iconUrl: '',
      effectiveFrom: '',
      scheduleMode: 'now',
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
        effectiveFrom:
          form.scheduleMode === 'later' && form.effectiveFrom
            ? new Date(form.effectiveFrom).toISOString()
            : undefined,
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
        iconUrl: form.iconUrl || undefined,
        reason: 'Admin create vehicle type',
      },
      { headers: headers() }
    );
    setShowAdd(false);
    await load();
  };

  const deactivate = async (id: string) => {
    await axios.patch(
      `${API}/admin/vehicle-types/${id}`,
      { is_active: false, reason: 'Admin deactivate' },
      { headers: headers() }
    );
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
              category: 'sedan',
              iconUrl: '',
              effectiveFrom: '',
              scheduleMode: 'now',
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
              <span style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button style={styles.edit} onClick={() => openEdit(r)}>
                  Edit
                </button>
                <button style={styles.edit} onClick={() => deactivate(r.id).catch((e) => setError(e.message))}>
                  Deactivate
                </button>
              </span>
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
              <select
                style={styles.input}
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {['motorcycle', 'tricycle', 'sedan', 'suv', 'van', 'luxury', 'bus'].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Icon (direct upload)
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'block', marginTop: 6 }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (!file) return;
                    try {
                      const { uploadCatalogImage } = await import('../lib/media');
                      const url = await uploadCatalogImage(
                        file,
                        localStorage.getItem('movr_admin_token') || ''
                      );
                      setForm((f) => ({ ...f, iconUrl: url }));
                    } catch (err: any) {
                      setError(err.message || 'Icon upload failed');
                    }
                  }}
                />
              </label>
              {form.iconUrl ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Icon: {form.iconUrl}</p>
              ) : null}
            </>
          ) : (
            <>
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
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                <label style={{ fontSize: 13 }}>
                  <input
                    type="radio"
                    checked={form.scheduleMode === 'now'}
                    onChange={() => setForm({ ...form, scheduleMode: 'now' })}
                  />{' '}
                  Effective immediately
                </label>
                <label style={{ fontSize: 13 }}>
                  <input
                    type="radio"
                    checked={form.scheduleMode === 'later'}
                    onChange={() => setForm({ ...form, scheduleMode: 'later' })}
                  />{' '}
                  Schedule
                </label>
                {form.scheduleMode === 'later' ? (
                  <input
                    type="datetime-local"
                    style={styles.input}
                    value={form.effectiveFrom}
                    onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
                  />
                ) : null}
              </div>
            </>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              style={styles.addBtn}
              onClick={() => (showAdd ? addType() : save()).catch((e) => setError(e.message))}
            >
              {showAdd ? 'Create' : 'Save & schedule'}
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

      <h2 style={{ marginTop: 32, marginBottom: 12 }}>Rental rates (hourly / daily)</h2>
      <div style={styles.tableWrap}>
        <div style={{ ...styles.thead, gridTemplateColumns: '1fr 1fr 1fr 1fr 0.6fr' }}>
          <span>Vehicle</span>
          <span>Type</span>
          <span>Unit</span>
          <span>Rate</span>
          <span />
        </div>
        {rentalRows.length === 0 ? (
          <div style={styles.empty}>No rental pricing rows</div>
        ) : (
          rentalRows.map((r) => (
            <div
              key={r.id}
              style={{ ...styles.row, gridTemplateColumns: '1fr 1fr 1fr 1fr 0.6fr' }}
            >
              <span style={{ fontWeight: 600 }}>{r.vehicle_type_id}</span>
              <span>{r.rental_type}</span>
              <span>{r.rate_unit}</span>
              <span>{money(Number(r.rate_amount), r.currency_code || 'GHS')}</span>
              <button
                style={styles.edit}
                onClick={() =>
                  setRentalEdit({
                    ...r,
                    rateAmount: String(r.rate_amount),
                  })
                }
              >
                Edit
              </button>
            </div>
          ))
        )}
      </div>

      {rentalEdit ? (
        <div style={styles.panel}>
          <h2 style={{ marginTop: 0 }}>
            Edit rental · {rentalEdit.vehicle_type_id} / {rentalEdit.rental_type} /{' '}
            {rentalEdit.rate_unit}
          </h2>
          <input
            style={styles.input}
            placeholder="Rate amount"
            value={rentalEdit.rateAmount}
            onChange={(e) => setRentalEdit({ ...rentalEdit, rateAmount: e.target.value })}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              style={styles.addBtn}
              onClick={async () => {
                await axios.put(
                  `${API}/admin/rental-pricing`,
                  {
                    vehicleTypeId: rentalEdit.vehicle_type_id,
                    rentalType: rentalEdit.rental_type,
                    rateUnit: rentalEdit.rate_unit,
                    rateAmount: Number(rentalEdit.rateAmount),
                    currencyCode: rentalEdit.currency_code || 'GHS',
                    minDuration: rentalEdit.min_duration || 1,
                    maxDuration: rentalEdit.max_duration || 30,
                  },
                  { headers: headers() }
                );
                setRentalEdit(null);
                await load();
              }}
            >
              Save rental rate
            </button>
            <button style={styles.ghost} onClick={() => setRentalEdit(null)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
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
