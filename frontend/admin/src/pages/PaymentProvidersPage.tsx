import React, { useEffect, useState } from 'react';
import axios from 'axios';
import AdminShell from '../layouts/AdminShell';
import { formatCountryLabel } from '../lib/currency';

const API = process.env.REACT_APP_API_URL || '/api/v1';

interface ProviderRow {
  id: string;
  scope: 'global' | 'country' | 'standby';
  country_code: string | null;
  provider: 'paystack' | 'flutterwave' | 'stripe';
  is_active: boolean;
  label?: string;
  status?: 'Active' | 'Standby';
}

const COUNTRY_LABEL_OVERRIDE: Record<string, string> = {
  SN: 'Senegal (Paystack unsupported)',
  STBY: 'Standby provider',
};

const MOCKUP_ORDER = ['global', 'GH', 'NG', 'KE', 'SN', 'STBY'];

/** Payment providers — global + country overrides. */
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
      const mapped = data.map((r) => ({
        ...r,
        label:
          r.scope === 'global'
            ? 'Global default'
            : r.country_code === 'STBY' || r.scope === 'standby'
              ? 'Standby provider'
              : formatCountryLabel(
                  r.country_code,
                  COUNTRY_LABEL_OVERRIDE[r.country_code || ''] || undefined
                ),
        status:
          r.country_code === 'STBY' || r.scope === 'standby' || !r.is_active
            ? ('Standby' as const)
            : ('Active' as const),
      }));

      // Prefer mockup order: Global, GH, NG, KE, SN, Standby
      mapped.sort((a, b) => {
        const keyA =
          a.scope === 'global' ? 'global' : a.country_code === 'STBY' ? 'STBY' : a.country_code || '';
        const keyB =
          b.scope === 'global' ? 'global' : b.country_code === 'STBY' ? 'STBY' : b.country_code || '';
        const ia = MOCKUP_ORDER.indexOf(keyA);
        const ib = MOCKUP_ORDER.indexOf(keyB);
        if (ia === -1 && ib === -1) return 0;
        if (ia === -1) return 1;
        if (ib === -1) return 1;
        return ia - ib;
      });

      // Show mockup scopes first; keep extras at end
      setRows(mapped);
      setError('');
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message);
      setRows([]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const update = async (id: string, provider: 'paystack' | 'flutterwave' | 'stripe') => {
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
          <span />
        </div>
        {rows.length === 0 ? (
          <div style={styles.empty}>No payment providers configured</div>
        ) : (
          rows.map((row) => {
            const status = row.status || (row.is_active ? 'Active' : 'Standby');
            return (
              <div key={row.id} style={styles.row}>
                <span style={{ color: '#fff' }}>{row.label || row.scope}</span>
                <span style={{ textTransform: 'capitalize', color: '#fff' }}>{row.provider}</span>
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
                        update(row.id, e.target.value as 'paystack' | 'flutterwave' | 'stripe')
                      }
                      style={styles.select}
                    >
                      <option value="paystack">Paystack</option>
                      <option value="flutterwave">Flutterwave</option>
                      <option value="stripe">Stripe</option>
                    </select>
                  ) : (
                    <button type="button" style={styles.change} onClick={() => setEditing(row.id)}>
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
  h1: { fontSize: 28, fontWeight: 700, marginBottom: 8, color: '#fff' },
  sub: { color: '#888', marginBottom: 24, fontSize: 14 },
  error: { color: '#f87171', marginBottom: 16 },
  table: { borderTop: '1px solid #222' },
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
    borderTop: '1px solid #222',
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
  active: { background: 'rgba(34,197,94,0.18)', color: '#4ade80' },
  standby: { background: 'rgba(234,179,8,0.18)', color: '#fbbf24' },
  change: {
    background: 'transparent',
    border: 'none',
    color: '#3B82F6',
    cursor: 'pointer',
    fontWeight: 600,
    padding: 0,
  },
  select: {
    background: '#111',
    color: '#fff',
    border: '1px solid #8E2DE2',
    borderRadius: 8,
    padding: '6px 10px',
  },
};
