import React, { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import AdminShell from '../layouts/AdminShell';

const API = process.env.REACT_APP_API_URL || '/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}` });

type Flag = {
  key: string;
  label: string;
  phase: string;
  rolloutLabel: string;
  enabled: boolean;
};

function PurpleToggle({ on, onClick, title }: { on: boolean; onClick: () => void; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={on}
      onClick={onClick}
      style={{
        width: 48,
        height: 28,
        borderRadius: 999,
        border: 'none',
        padding: 3,
        cursor: 'pointer',
        background: on ? '#7C3AED' : '#333333',
        display: 'flex',
        alignItems: 'center',
        justifyContent: on ? 'flex-end' : 'flex-start',
        transition: 'background 0.15s ease',
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: 999,
          background: '#FFFFFF',
          display: 'block',
          boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
        }}
      />
    </button>
  );
}

/** Admin feature flags — mockup rollouts with purple toggles. */
export default function FeatureFlagsPage() {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const res = await axios.get(`${API}/admin/feature-flags`, { headers: headers() });
      const data = Array.isArray(res.data?.data) ? res.data.data : [];
      setFlags(
        data.map((f: any) => ({
          key: f.key,
          label: f.label || f.key,
          phase: f.phase || '',
          rolloutLabel: f.rolloutLabel || `${f.rollout_pct ?? 0}%`,
          enabled: !!f.enabled,
        }))
      );
      setError('');
    } catch (e: any) {
      setFlags([]);
      setError(e?.response?.data?.message || e.message || 'Failed to load flags');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggle = async (key: string, enabled: boolean) => {
    setFlags((rows) => rows.map((f) => (f.key === key ? { ...f, enabled } : f)));
    try {
      await axios.patch(
        `${API}/admin/feature-flags/${key}`,
        { enabled },
        { headers: headers() }
      );
      toast.success(enabled ? 'Enabled' : 'Disabled');
    } catch {
      toast.error('Failed to update flag');
      await load();
    }
  };

  return (
    <AdminShell activeLabel="Feature flags">
      <h1 style={styles.h1}>Feature flags</h1>
      {error ? <p style={{ color: 'var(--error)' }}>{error}</p> : null}

      <div style={styles.table}>
        <div style={{ ...styles.row, ...styles.head }}>
          <span>Feature</span>
          <span>Rollout</span>
          <span style={{ textAlign: 'right' }}>Enabled</span>
        </div>
        {flags.length === 0 ? (
          <div style={styles.empty}>No flags seeded</div>
        ) : (
          flags.map((f) => (
            <div key={f.key} style={styles.row}>
              <div>
                <div style={styles.label}>{f.label}</div>
                <div style={styles.phase}>{f.phase}</div>
              </div>
              <div style={styles.rollout}>{f.rolloutLabel}</div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <PurpleToggle
                  on={!!f.enabled}
                  onClick={() => toggle(f.key, !f.enabled)}
                  title={`${f.label}: ${f.enabled ? 'on' : 'off'}`}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </AdminShell>
  );
}

const styles: Record<string, React.CSSProperties> = {
  h1: { fontSize: 32, fontWeight: 700, marginBottom: 28, color: '#FFFFFF' },
  table: {
    background: '#111111',
    borderRadius: 16,
    overflowX: 'auto',
  },
  head: { color: 'rgba(255,255,255,0.45)', fontSize: 13 },
  row: {
    display: 'grid',
    gridTemplateColumns: '1.4fr 1.2fr 100px',
    gap: 16,
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid #222',
  },
  empty: { padding: '24px', color: 'rgba(255,255,255,0.5)' },
  label: { fontWeight: 600, fontSize: 16, color: '#FFFFFF' },
  phase: { color: 'rgba(255,255,255,0.45)', fontSize: 13, marginTop: 4 },
  rollout: { color: '#FFFFFF' },
};
