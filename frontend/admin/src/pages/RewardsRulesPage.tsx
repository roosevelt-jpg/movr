import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}` });

export default function RewardsRulesPage() {
  const [rules, setRules] = useState<any[]>([]);

  const load = async () => {
    const res = await axios.get(`${API}/admin/rewards-rules`, { headers: headers() });
    setRules(res.data.data || []);
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

  const save = async (eventType: string, patch: any) => {
    await axios.patch(`${API}/admin/rewards-rules/${eventType}`, patch, { headers: headers() });
    await load();
  };

  return (
    <div style={styles.page}>
      <h1 style={styles.h1}>Rewards rules</h1>
      <p style={styles.sub}>Tune points without a redeploy.</p>
      <div style={styles.table}>
        <div style={styles.header}>
          <span>Event</span><span>Points</span><span>DVT</span><span>Active</span><span></span>
        </div>
        {rules.map((r) => (
          <RuleRow key={r.event_type} rule={r} onSave={save} />
        ))}
      </div>
    </div>
  );
}

function RuleRow({ rule, onSave }: { rule: any; onSave: (e: string, p: any) => void }) {
  const [points, setPoints] = useState(String(rule.points_amount));
  const [active, setActive] = useState(!!rule.active);

  return (
    <div style={styles.row}>
      <span>{rule.event_type}</span>
      <input style={styles.input} value={points} onChange={(e) => setPoints(e.target.value)} />
      <span>{rule.dvt_amount}</span>
      <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
      <button
        style={styles.btn}
        onClick={() => onSave(rule.event_type, { points_amount: Number(points), active })}
      >
        Save
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#000', color: '#fff', padding: 32, fontFamily: 'Poppins, sans-serif' },
  h1: { fontSize: 24, marginBottom: 8 },
  sub: { color: '#A0A0A0', marginBottom: 16 },
  table: { border: '1px solid #2A2A2A', borderRadius: 12, overflow: 'hidden' },
  header: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
    gap: 8,
    padding: 12,
    background: '#1A1A1A',
    color: '#A0A0A0',
    fontSize: 13,
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
    gap: 8,
    padding: 12,
    borderTop: '1px solid #2A2A2A',
    alignItems: 'center',
  },
  input: {
    background: '#0A0A0A',
    border: '1px solid #2A2A2A',
    color: '#fff',
    borderRadius: 8,
    padding: '8px 10px',
  },
  btn: {
    background: 'linear-gradient(135deg, #3F7048 0%, #6A00FF 50%, #0055FF 100%)',
    border: 'none',
    color: '#fff',
    borderRadius: 999,
    padding: '8px 12px',
    cursor: 'pointer',
  },
};
