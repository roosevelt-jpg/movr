import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';

interface ProviderRow {
  id: string;
  scope: 'global' | 'country';
  country_code: string | null;
  provider: 'paystack' | 'flutterwave';
  is_active: boolean;
}

export default function PaymentProvidersPage() {
  const [rows, setRows] = useState<ProviderRow[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState<string | null>(null);

  const token = localStorage.getItem('movr_admin_token') || '';

  const load = async () => {
    try {
      const res = await axios.get(`${API}/admin/payment-providers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRows(res.data.data || []);
      setError('');
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const update = async (id: string, provider: 'paystack' | 'flutterwave') => {
    setSaving(id);
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
    <div style={styles.page}>
      <h1 style={styles.h1}>Payment providers</h1>
      <p style={styles.sub}>
        Global default plus per-country overrides. Changes audit-logged.
      </p>
      {error ? <p style={styles.error}>{error}</p> : null}
      <div style={styles.table}>
        <div style={styles.headerRow}>
          <span>Scope</span>
          <span>Country</span>
          <span>Provider</span>
          <span>Active</span>
        </div>
        {rows.map((row) => (
          <div key={row.id} style={styles.row}>
            <span>{row.scope}</span>
            <span>{row.country_code || '—'}</span>
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
            <span>{row.is_active ? 'Yes' : 'No'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#000000',
    color: '#FFFFFF',
    padding: 32,
    fontFamily: 'Poppins, Montserrat, sans-serif',
  },
  h1: { fontSize: 24, marginBottom: 8 },
  sub: { color: '#A0A0A0', marginBottom: 24 },
  error: { color: '#FF3B5C', marginBottom: 16 },
  table: {
    border: '1px solid #2A2A2A',
    borderRadius: 12,
    overflow: 'hidden',
  },
  headerRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1.5fr 0.8fr',
    gap: 12,
    padding: 12,
    background: '#1A1A1A',
    color: '#A0A0A0',
    fontSize: 13,
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1.5fr 0.8fr',
    gap: 12,
    padding: 12,
    borderTop: '1px solid #2A2A2A',
    alignItems: 'center',
  },
  select: {
    background: '#0A0A0A',
    color: '#FFFFFF',
    border: '1px solid #6A00FF',
    borderRadius: 8,
    padding: '8px 12px',
  },
};
