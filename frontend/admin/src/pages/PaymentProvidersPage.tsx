import React, { useEffect, useState } from 'react';
import axios from 'axios';
import AdminShell from '../layouts/AdminShell';

const API = process.env.REACT_APP_API_URL || '/api/v1';

interface ProviderRow {
  id: string;
  scope: 'global' | 'country' | 'standby';
  country_code: string | null;
  provider: 'paystack' | 'flutterwave';
  is_active: boolean;
  label?: string;
  status?: 'Active' | 'Standby';
}

const COUNTRY_NAME: Record<string, string> = {
  GH: 'Ghana',
  NG: 'Nigeria',
  KE: 'Kenya',
  ZA: 'South Africa',
  CI: "Côte d'Ivoire",
  SN: 'Senegal (Paystack unsupported)',
};

/** Payment providers — global + country overrides (Change keeps PATCH API). */
export default function PaymentProvidersPage() {
  const [rows, setRows] = useState<ProviderRow[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const token = localStorage.getItem('movr_admin_token') || '';

  const load = async () => {
    try {
      const res = await axios.get(`${API}/admin/payment-providers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: ProviderRow[] = res.data.data || [];
      setRows(
        data.map((r) => ({
          ...r,
          label:
            r.scope === 'global'
              ? 'Global default'
              : r.scope === 'standby' || (!r.is_active && !r.country_code)
                ? 'Standby provider'
                : COUNTRY_NAME[r.country_code || ''] || r.country_code || 'Country',
          status: r.is_active ? 'Active' : 'Standby',
        }))
      );
      setError('');
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message);
      setRows([]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const update = async (id: string, provider: 'paystack' | 'flutterwave') => {
    setSaving(id);
    setEditing(null);
    try {
      await axios.patch(
        `${API}/admin/payment-providers/${id}`,
        { provider },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message);
    } finally {
      setSaving(null);
    }
  };

  return (
    <AdminShell activeLabel="Payments">
      <h1 style={styles.h1}>Payment providers</h1>
      <p style={styles.sub}>
        Global default and per-country overrides · changes apply instantly, no redeploy
      </p>
      {error ? <p style={styles.error}>{error}</p> : null}

      <div style={styles.table}>
        <div style={styles.headerRow}>
          <span>Scope</span>
          <span>Provider</span>
          <span>Status</span>
          <span>Action</span>
        </div>
        {rows.length === 0 ? (
          <div style={styles.empty}>No payment providers configured</div>
        ) : (
          rows.map((row) => {
            const status = row.status || (row.is_active ? 'Active' : 'Standby');
            return (
              <div key={row.id} style={styles.row}>
                <span>{row.label || row.scope}</span>
                <span style={{ textTransform: 'capitalize' }}>{row.provider}</span>
                <span>
                  <span
                    style={{
                      ...styles.badge,
                      ...(status === 'Active' ? styles.active : styles.standby),
                    }}
                  >
                    {status}
                  </span>
                </span>
                <span>
                  {editing === row.id ? (
                    <select
                      value={row.provider}
                      disabled={saving === row.id}
                      onChange={(e) =>
                        update(row.id, e.target.value as 'paystack' | 'flutterwave')
                      }
                      style={styles.select}
                    >
                      <option value="paystack">Paystack</option>
                      <option value="flutterwave">Flutterwave</option>
                    </select>
                  ) : (
                    <button style={styles.change} onClick={() => setEditing(row.id)}>
                      Change
                    </button>
                  )}
                </span>
              </div>
            );
          })
        )}
      </div>
    </AdminShell>
  );
}

const styles: Record<string, React.CSSProperties> = {
  h1: { fontSize: 28, fontWeight: 700, marginBottom: 8 },
  sub: { color: '#A0A0A0', marginBottom: 24, fontSize: 14 },
  error: { color: '#FF3B5C', marginBottom: 16 },
  table: { borderTop: '1px solid #1A1A1A' },
  headerRow: {
    display: 'grid',
    gridTemplateColumns: '1.6fr 1fr 0.9fr 0.7fr',
    gap: 12,
    padding: '12px 4px',
    color: '#888',
    fontSize: 13,
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1.6fr 1fr 0.9fr 0.7fr',
    gap: 12,
    padding: '16px 4px',
    borderTop: '1px solid #1A1A1A',
    alignItems: 'center',
    fontSize: 15,
  },
  empty: { padding: '24px 4px', color: '#888' },
  badge: {
    display: 'inline-block',
    borderRadius: 999,
    padding: '4px 10px',
    fontSize: 12,
    fontWeight: 700,
  },
  active: { background: 'rgba(63,112,72,0.35)', color: '#9BE0A8' },
  standby: { background: 'rgba(255,184,0,0.2)', color: '#FFB800' },
  change: {
    background: 'transparent',
    border: 'none',
    color: '#4A86E8',
    cursor: 'pointer',
    fontWeight: 600,
    padding: 0,
  },
  select: {
    background: '#0A0A0A',
    color: '#FFFFFF',
    border: '1px solid #6A00FF',
    borderRadius: 8,
    padding: '6px 10px',
  },
};
