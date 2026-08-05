import React, { useEffect, useState } from 'react';
import axios from 'axios';
import AdminShell from '../layouts/AdminShell';

const API = process.env.REACT_APP_API_URL || '/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}` });

type Rule = {
  event_type: string;
  label?: string;
  points_amount: number;
  points_display?: string;
  active: boolean;
};

/** Rewards rules — points live, DVT paused (Phase 5B hold). */
export default function RewardsRulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [points, setPoints] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const res = await axios.get(`${API}/admin/rewards-rules`, { headers: headers() });
      const data = res.data.data || [];
      setRules(
        data.map((r: any) => ({
          ...r,
          label: String(r.event_type || '').replace(/_/g, ' '),
          points_display:
            r.event_type === 'stake_created'
              ? `${r.points_amount} / week pts`
              : `${r.points_amount} pts`,
        }))
      );
      setError('');
    } catch (e: any) {
      setRules([]);
      setError(e?.response?.data?.message || e.message || 'Failed to load rules');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async (eventType: string) => {
    await axios.patch(
      `${API}/admin/rewards-rules/${eventType}`,
      { points_amount: Number(points) },
      { headers: headers() }
    );
    setEditing(null);
    await load();
  };

  const toggle = async (eventType: string, active: boolean) => {
    try {
      await axios.patch(
        `${API}/admin/rewards-rules/${eventType}`,
        { active },
        { headers: headers() }
      );
      await load();
    } catch {
      setRules((prev) => prev.map((r) => (r.event_type === eventType ? { ...r, active } : r)));
    }
  };

  return (
    <AdminShell activeLabel="Rewards">
      <h1 style={styles.h1}>Rewards rules</h1>
      <p style={styles.sub}>
        DVT column shows 0 while Phase 5B is on hold — points-only for now.
      </p>
      {error ? <p style={{ color: '#FF8FA0' }}>{error}</p> : null}

      <div style={styles.table}>
        <div style={styles.header}>
          <span>Event</span>
          <span>Points</span>
          <span>DVT (paused)</span>
          <span>Status</span>
          <span />
        </div>
        {rules.length === 0 ? (
          <div style={styles.empty}>No rewards rules configured</div>
        ) : (
          rules.map((r) => (
            <div key={r.event_type} style={styles.row}>
              <span style={{ textTransform: 'capitalize' }}>{r.label || r.event_type}</span>
              <span>
                {editing === r.event_type ? (
                  <input
                    style={styles.input}
                    value={points}
                    onChange={(e) => setPoints(e.target.value)}
                  />
                ) : (
                  r.points_display || `${r.points_amount} pts`
                )}
              </span>
              <span style={{ color: '#888' }}>0 (on hold)</span>
              <span>
                <button
                  type="button"
                  style={{
                    ...styles.badge,
                    ...(r.active ? styles.active : styles.paused),
                  }}
                  onClick={() => toggle(r.event_type, !r.active)}
                >
                  {r.active ? 'Active' : 'Paused'}
                </button>
              </span>
              <span>
                {editing === r.event_type ? (
                  <button style={styles.edit} type="button" onClick={() => save(r.event_type)}>
                    Save
                  </button>
                ) : (
                  <button
                    style={styles.edit}
                    type="button"
                    onClick={() => {
                      setEditing(r.event_type);
                      setPoints(String(r.points_amount));
                    }}
                  >
                    Edit
                  </button>
                )}
              </span>
            </div>
          ))
        )}
      </div>
    </AdminShell>
  );
}

const styles: Record<string, React.CSSProperties> = {
  h1: { fontSize: 28, fontWeight: 700, marginBottom: 8 },
  sub: { color: '#A0A0A0', marginBottom: 20, fontSize: 14 },
  table: { borderTop: '1px solid #1A1A1A' },
  header: {
    display: 'grid',
    gridTemplateColumns: '1.6fr 1fr 1.1fr 0.9fr 0.6fr',
    gap: 8,
    padding: '12px 4px',
    color: '#888',
    fontSize: 13,
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1.6fr 1fr 1.1fr 0.9fr 0.6fr',
    gap: 8,
    padding: '16px 4px',
    borderTop: '1px solid #1A1A1A',
    alignItems: 'center',
  },
  empty: { padding: '24px 4px', color: '#888' },
  input: {
    background: '#0A0A0A',
    border: '1px solid #2A2A2A',
    color: '#fff',
    borderRadius: 8,
    padding: '8px 10px',
    width: 80,
  },
  badge: {
    border: 'none',
    borderRadius: 999,
    padding: '4px 10px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  },
  active: { background: 'rgba(63,112,72,0.35)', color: '#9BE0A8' },
  paused: { background: 'rgba(120,40,40,0.45)', color: '#FFB0B0' },
  edit: {
    background: 'transparent',
    border: 'none',
    color: '#4A86E8',
    cursor: 'pointer',
    fontWeight: 600,
  },
};
