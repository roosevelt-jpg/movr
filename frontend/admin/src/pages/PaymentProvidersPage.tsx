import React, { useEffect, useState } from 'react';
import axios from 'axios';
import AdminShell from '../layouts/AdminShell';
import { formatCountryLabel } from '../lib/currency';
import { friendlyApiError } from '../lib/apiError';
import { API } from '../lib/apiBase';

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const token = localStorage.getItem('movr_admin_token') || '';

  const load = async () => {
    setLoading(true);
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

      mapped.sort((a, b) => {
        const keyA =
          a.scope === 'global' ? 'global' : a.country_code === 'STBY' ? 'STBY' : a.country_code || '';
        const keyB =
          b.scope === 'global' ? 'global' : b.country_code === 'STBY' ? 'STBY' : b.country_code || '';
        const ia = MOCKUP_ORDER.indexOf(keyA);
        const ib = MOCKUP_ORDER.indexOf(keyB);
        if (ia === -1 && ib === -1) return 0;
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      });

      setRows(mapped);
      setError('');
    } catch (e: any) {
      setError(friendlyApiError(e, 'Failed to load payment providers'));
      setRows([]);
    } finally {
      setLoading(false);
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
      setError(friendlyApiError(e, 'Failed to update provider'));
    } finally {
      setSaving(null);
    }
  };

  return (
    <AdminShell activeLabel="Payments" hidePageTitle>
      <h1 style={styles.h1}>Payment providers</h1>
      <p style={styles.sub}>
        Global default and per-country overrides · changes apply instantly, no redeploy
      </p>
      {error ? (
        <div style={styles.alert} role="alert">
          <div style={styles.alertTitle}>Couldn’t load providers</div>
          <p style={styles.alertBody}>{error}</p>
          <button type="button" style={styles.retry} onClick={() => load()}>
            Retry
          </button>
        </div>
      ) : null}

      <div style={styles.table}>
        <div style={styles.headerRow}>
          <span>Scope</span>
          <span>Provider</span>
          <span>Status</span>
          <span />
        </div>
        {loading ? (
          <div style={styles.empty}>Loading providers…</div>
        ) : rows.length === 0 ? (
          <div style={styles.empty}>
            No payment providers configured
            {!error ? (
              <button type="button" style={{ ...styles.retry, marginLeft: 12 }} onClick={() => load()}>
                Refresh
              </button>
            ) : null}
          </div>
        ) : (
          rows.map((row) => {
            const status = row.status || (row.is_active ? 'Active' : 'Standby');
            return (
              <div key={row.id} style={styles.row}>
                <span style={styles.scope}>{row.label || row.scope}</span>
                <span>
                  {editing === row.id ? (
                    <select
                      style={styles.select}
                      defaultValue={row.provider}
                      onChange={(e) =>
                        update(row.id, e.target.value as 'paystack' | 'flutterwave' | 'stripe')
                      }
                      disabled={saving === row.id}
                    >
                      <option value="paystack">Paystack</option>
                      <option value="flutterwave">Flutterwave</option>
                      <option value="stripe">Stripe</option>
                    </select>
                  ) : (
                    <span style={{ textTransform: 'capitalize' }}>{row.provider}</span>
                  )}
                </span>
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
                <span style={{ textAlign: 'right' }}>
                  {saving === row.id ? (
                    <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Saving…</span>
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
  h1: {
    fontSize: 28,
    fontWeight: 700,
    margin: '0 0 8px',
    color: 'var(--text-primary)',
  },
  sub: { color: 'var(--text-secondary)', margin: '0 0 20px', fontSize: 14 },
  alert: {
    marginBottom: 16,
    padding: '12px 14px',
    borderRadius: 12,
    border: '1px solid rgba(225,29,72,0.35)',
    background: 'rgba(225,29,72,0.08)',
    color: 'var(--text-primary)',
  },
  alertTitle: { fontWeight: 700, fontSize: 13, marginBottom: 4, color: 'var(--error)' },
  alertBody: { margin: '0 0 10px', fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.4 },
  retry: {
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-primary)',
    borderRadius: 8,
    padding: '6px 10px',
    fontWeight: 600,
    fontSize: 12,
    cursor: 'pointer',
  },
  table: {
    border: '1px solid var(--border)',
    borderRadius: 14,
    overflow: 'hidden',
    background: 'var(--surface-elevated)',
  },
  headerRow: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr) minmax(0, 0.9fr) minmax(72px, 0.7fr)',
    gap: 12,
    padding: '12px 16px',
    color: 'var(--text-secondary)',
    fontSize: 13,
    fontWeight: 600,
    borderBottom: '1px solid var(--border)',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr) minmax(0, 0.9fr) minmax(72px, 0.7fr)',
    gap: 12,
    padding: '14px 16px',
    borderTop: '1px solid var(--border)',
    alignItems: 'center',
    fontSize: 15,
    minWidth: 0,
    color: 'var(--text-primary)',
  },
  scope: { fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' },
  empty: {
    padding: '24px 16px',
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    display: 'inline-block',
    borderRadius: 999,
    padding: '4px 10px',
    fontSize: 12,
    fontWeight: 700,
  },
  active: { background: 'rgba(34,197,94,0.18)', color: 'var(--success)' },
  standby: { background: 'rgba(234,179,8,0.18)', color: 'var(--accent-warn)' },
  change: {
    background: 'transparent',
    border: 'none',
    color: 'var(--motion-blue)',
    cursor: 'pointer',
    fontWeight: 600,
    padding: 0,
  },
  select: {
    background: 'var(--surface)',
    color: 'var(--text-primary)',
    border: '1px solid #8E2DE2',
    borderRadius: 8,
    padding: '6px 10px',
    maxWidth: '100%',
  },
};
