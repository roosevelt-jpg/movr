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

/** Admin feature flags — toggle rollouts without removing APIs. */
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
      {error ? <p style={{ color: '#FF8FA0' }}>{error}</p> : null}

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
                <button
                  type="button"
                  aria-label={`Toggle ${f.label}`}
                  onClick={() => toggle(f.key, !f.enabled)}
                  style={{
                    ...styles.toggle,
                    background: f.enabled ? '#6A00FF' : '#3A3A3A',
                    justifyContent: f.enabled ? 'flex-end' : 'flex-start',
                  }}
                >
                  <span style={styles.knob} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </AdminShell>
  );
}

const styles: Record<string, React.CSSProperties> = {
  h1: { fontSize: 32, fontWeight: 700, marginBottom: 28 },
  table: {
    background: '#111',
    borderRadius: 16,
    border: '1px solid #2A2A2A',
    overflow: 'hidden',
  },
  head: { color: '#8E8E93', fontSize: 13 },
  row: {
    display: 'grid',
    gridTemplateColumns: '1.4fr 1.2fr 100px',
    gap: 16,
    alignItems: 'center',
    padding: '18px 24px',
    borderBottom: '1px solid #2A2A2A',
  },
  empty: { padding: '24px', color: '#888' },
  label: { fontWeight: 600, fontSize: 16 },
  phase: { color: '#8E8E93', fontSize: 13, marginTop: 4 },
  rollout: { color: '#C8C8C8' },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 999,
    border: 'none',
    padding: 3,
    display: 'flex',
    cursor: 'pointer',
  },
  knob: {
    width: 22,
    height: 22,
    borderRadius: '50%',
    background: '#fff',
    display: 'block',
  },
};
