import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import AdminShell from '../layouts/AdminShell';
import { adminBtn } from '../styles/adminButtons';
import { friendlyApiError } from '../lib/apiError';
import { API } from '../lib/apiBase';

const headers = () => ({
  Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}`,
  'Content-Type': 'application/json',
});

type Flag = {
  key: string;
  enabled: boolean;
  label: string;
  description: string;
};

type Pricing = {
  base_fare_per_km: number;
  merchant_fee_pct: number;
  surge_max_multiplier: number;
  min_ride_fare: number;
  driver_sub_monthly: number;
  merchant_store_monthly: number;
  currency: string;
};

type AuditRow = {
  time: string;
  admin: string;
  action: string;
  target: string;
  actionRaw?: string;
};

function relativeTime(iso?: string) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return h === 1 ? '1 hr ago' : `${h} hrs ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? '1 day ago' : `${d} days ago`;
}

function actionPill(action: string, actionRaw?: string): React.CSSProperties {
  const s = `${actionRaw || ''} ${action}`.toLowerCase();
  if (s.includes('suspend') || s.includes('cancel') || s.includes('reject') || s.includes('ban')) {
    return { background: 'rgba(239,68,68,0.2)', color: 'var(--error)' };
  }
  if (s.includes('approve') || s.includes('enable') || s.includes('create')) {
    return { background: 'rgba(34,197,94,0.2)', color: 'var(--success)' };
  }
  if (s.includes('adjust') || s.includes('config') || s.includes('change') || s.includes('update')) {
    return { background: 'rgba(59,130,246,0.18)', color: 'var(--motion-blue)' };
  }
  if (s.includes('warn') || s.includes('flag')) {
    return { background: 'rgba(234,179,8,0.2)', color: 'var(--accent-gold)' };
  }
  return { background: 'rgba(148,163,184,0.2)', color: 'var(--text-secondary)' };
}

const DEFAULT_FLAGS: Flag[] = [
  {
    key: 'surge_pricing',
    enabled: false,
    label: 'Surge pricing',
    description: 'Allow demand-based fare multipliers',
  },
  {
    key: 'dvt_rewards',
    enabled: false,
    label: 'DVT rewards',
    description: 'Earn and redeem DVT on completed trips',
  },
  {
    key: 'merchant_kyc_approval',
    enabled: false,
    label: 'Merchant KYC approval',
    description: 'Require ops approval before merchants go live',
  },
  {
    key: 'maintenance_mode',
    enabled: false,
    label: 'Maintenance mode',
    description: 'Show maintenance banner and block new bookings',
  },
  {
    key: 'token_claims',
    enabled: false,
    label: 'Token claims',
    description: 'Allow users to claim airdrop / reward tokens',
  },
];

const PRICING_FIELDS: { key: keyof Pricing; label: string; step?: string }[] = [
  { key: 'base_fare_per_km', label: 'Base fare / km' },
  { key: 'merchant_fee_pct', label: 'Merchant payout fee %', step: '0.1' },
  { key: 'surge_max_multiplier', label: 'Surge max multiplier', step: '0.1' },
  { key: 'min_ride_fare', label: 'Min ride fare' },
  { key: 'driver_sub_monthly', label: 'Driver sub default (monthly)' },
  { key: 'merchant_store_monthly', label: 'Merchant store sub (monthly)' },
];

/** System Settings & Audit Log — platform flags, pricing, live audit. */
export default function AdminSettingsPage() {
  const [flags, setFlags] = useState<Flag[]>(DEFAULT_FLAGS);
  const [pricing, setPricing] = useState<Pricing>({
    base_fare_per_km: 120,
    merchant_fee_pct: 5,
    surge_max_multiplier: 3,
    min_ride_fare: 500,
    driver_sub_monthly: 7000,
    merchant_store_monthly: 5000,
    currency: 'NGN',
  });
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/admin/platform-settings`, { headers: headers() });
      const data = res.data?.data;
      if (Array.isArray(data?.flags) && data.flags.length) setFlags(data.flags);
      if (data?.pricing) setPricing((prev) => ({ ...prev, ...data.pricing }));
      if (Array.isArray(data?.audit)) setAudit(data.audit);
      setError('');
    } catch (e: any) {
      setError(friendlyApiError(e, 'Failed to load settings'));
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => load().catch(() => undefined), 15000);
    return () => clearInterval(t);
  }, [load]);

  const toggleFlag = (key: string) => {
    setFlags((prev) => prev.map((f) => (f.key === key ? { ...f, enabled: !f.enabled } : f)));
  };

  const save = async () => {
    setSaving(true);
    setMessage('');
    try {
      await axios.put(
        `${API}/admin/platform-settings`,
        { flags, pricing },
        { headers: headers() }
      );
      setMessage('Settings saved');
      await load();
    } catch (e: any) {
      setError(friendlyApiError(e, 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  const exportLogs = async () => {
    try {
      const res = await axios.get(`${API}/admin/audit-log/export`, {
        headers: headers(),
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'audit-log.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(friendlyApiError(e, 'Export failed'));
    }
  };

  return (
    <AdminShell activeLabel="Settings" hidePageTitle>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 28,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: 'var(--text-primary)' }}>
            System Settings & Audit Log
          </h1>
          <p style={{ color: 'var(--text-secondary)', margin: '8px 0 0' }}>
            Platform toggles, pricing, and a live stream of admin actions.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }} className="admin-actions">
          <button type="button" className="admin-btn" onClick={exportLogs} style={styles.secondaryBtn}>
            Export Logs
          </button>
          <button type="button" className="admin-btn" onClick={save} disabled={saving} style={styles.primaryBtn}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      {error ? (
        <div style={styles.alert} role="alert">
          <div style={styles.alertTitle}>Settings notice</div>
          <p style={styles.alertBody}>{error}</p>
          <button type="button" style={styles.retry} onClick={() => load()}>
            Retry
          </button>
        </div>
      ) : null}
      {message ? <p style={{ color: 'var(--success)', marginBottom: 12 }}>{message}</p> : null}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 0.9fr)',
          gap: 20,
          alignItems: 'stretch',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <section style={styles.card}>
            <h2 style={styles.sectionTitle}>Platform Settings</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {flags.map((f) => (
                <div
                  key={f.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                    padding: '12px 0',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <div>
                    <p style={{ margin: 0, fontWeight: 600 }}>{f.label || f.key}</p>
                    {f.description ? (
                      <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                        {f.description}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={f.enabled}
                    onClick={() => toggleFlag(f.key)}
                    style={{
                      ...styles.switch,
                      background: f.enabled ? 'var(--movr-gradient)' : 'var(--surface)',
                      border: `1px solid ${f.enabled ? 'transparent' : 'var(--border)'}`,
                    }}
                  >
                    <span
                      style={{
                        ...styles.knob,
                        transform: f.enabled ? 'translateX(18px)' : 'translateX(2px)',
                      }}
                    />
                  </button>
                </div>
              ))}
              {!flags.length ? (
                <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No flags loaded</p>
              ) : null}
            </div>
          </section>

          <section style={styles.card}>
            <h2 style={styles.sectionTitle}>Pricing & Fees</h2>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                gap: 14,
              }}
            >
              {PRICING_FIELDS.map((field) => (
                <label
                  key={field.key}
                  style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, minWidth: 0 }}
                >
                  <span style={styles.fieldLabel}>{field.label}</span>
                  <input
                    type="number"
                    step={field.step || '1'}
                    value={Number(pricing[field.key] ?? 0)}
                    onChange={(e) =>
                      setPricing((p) => ({ ...p, [field.key]: Number(e.target.value) }))
                    }
                    style={styles.input}
                  />
                </label>
              ))}
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, minWidth: 0 }}>
                <span style={styles.fieldLabel}>Currency</span>
                <input
                  value={pricing.currency || ''}
                  onChange={(e) => setPricing((p) => ({ ...p, currency: e.target.value }))}
                  style={styles.input}
                />
              </label>
            </div>
          </section>
        </div>

        <section style={{ ...styles.card, maxHeight: '70vh', overflow: 'auto', minHeight: 280 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ ...styles.sectionTitle, margin: 0 }}>Live Audit Log</h2>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Polling 15s</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {audit.map((row, i) => (
              <div
                key={`${row.time}-${i}`}
                style={{
                  padding: '12px 0',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span
                    style={{
                      ...actionPill(row.action, row.actionRaw),
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: 999,
                      textTransform: 'capitalize',
                    }}
                  >
                    {row.action}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {relativeTime(row.time)}
                  </span>
                </div>
                <p style={{ margin: '8px 0 0', fontSize: 13 }}>
                  <strong>{row.admin}</strong>
                  {row.target ? (
                    <span style={{ color: 'var(--text-secondary)' }}> · {row.target}</span>
                  ) : null}
                </p>
              </div>
            ))}
            {!audit.length ? (
              <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No audit events yet</p>
            ) : null}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: 'var(--surface-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: 20,
  },
  sectionTitle: {
    margin: '0 0 16px',
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  fieldLabel: {
    color: 'var(--text-secondary)',
    fontWeight: 600,
    fontSize: 12,
  },
  alert: {
    marginBottom: 16,
    padding: '12px 14px',
    borderRadius: 12,
    border: '1px solid rgba(225,29,72,0.35)',
    background: 'rgba(225,29,72,0.08)',
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
  primaryBtn: { ...adminBtn.primary },
  secondaryBtn: { ...adminBtn.secondary },
  input: {
    width: '100%',
    minWidth: 0,
    maxWidth: '100%',
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text-primary)',
    fontSize: 14,
    boxSizing: 'border-box' as const,
  },
  switch: {
    width: 44,
    height: 26,
    borderRadius: 999,
    position: 'relative' as const,
    cursor: 'pointer',
    flexShrink: 0,
    padding: 0,
  },
  knob: {
    position: 'absolute' as const,
    top: 2,
    left: 0,
    width: 20,
    height: 20,
    borderRadius: '50%',
    background: 'var(--brand-white)',
    transition: 'transform 0.15s ease',
  },
};
