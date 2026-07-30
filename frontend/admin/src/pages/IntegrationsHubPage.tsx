import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';

interface Integration {
  id: string;
  key: string;
  display_name: string;
  category: string;
  status: string;
  is_enabled: boolean;
  last_checked_at?: string;
  last_error?: string;
}

const CATEGORIES = [
  'payments',
  'messaging',
  'maps_location',
  'ai_voice',
  'identity_verification',
  'infrastructure',
];

export default function IntegrationsHubPage() {
  const [items, setItems] = useState<Integration[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const token = localStorage.getItem('movr_admin_token') || '';

  const headers = { Authorization: `Bearer ${token}` };

  const load = async () => {
    const res = await axios.get(`${API}/admin/integrations`, { headers });
    setItems(res.data.data || []);
  };

  useEffect(() => {
    load().catch((e) => setMessage(e.message));
  }, []);

  const grouped = useMemo(() => {
    const map: Record<string, Integration[]> = {};
    for (const cat of CATEGORIES) map[cat] = [];
    for (const item of items) {
      if (!map[item.category]) map[item.category] = [];
      map[item.category].push(item);
    }
    return map;
  }, [items]);

  const open = async (key: string) => {
    setSelected(key);
    const res = await axios.get(`${API}/admin/integrations/${key}`, { headers });
    setDetail(res.data.data);
    setCreds({});
  };

  const save = async () => {
    if (!selected) return;
    await axios.put(
      `${API}/admin/integrations/${selected}/credentials`,
      { credentials: creds },
      { headers }
    );
    setMessage('Credentials saved');
    await open(selected);
    await load();
  };

  const test = async () => {
    if (!selected) return;
    const res = await axios.post(
      `${API}/admin/integrations/${selected}/test`,
      {},
      { headers }
    );
    setMessage(`Test: ${res.data.data.status}`);
    await load();
  };

  const toggle = async (key: string, enable: boolean) => {
    await axios.patch(
      `${API}/admin/integrations/${key}/${enable ? 'enable' : 'disable'}`,
      {},
      { headers }
    );
    await load();
  };

  return (
    <div style={styles.page}>
      <h1 style={styles.h1}>Integrations hub</h1>
      <p style={styles.sub}>Configure, test, and enable every third-party service.</p>
      {message ? <p style={styles.msg}>{message}</p> : null}

      {CATEGORIES.map((cat) => (
        <section key={cat} style={styles.section}>
          <h2 style={styles.h2}>{cat.replace('_', ' ')}</h2>
          <div style={styles.grid}>
            {(grouped[cat] || []).map((item) => (
              <div key={item.key} style={styles.card}>
                <div style={styles.cardTop}>
                  <strong>{item.display_name}</strong>
                  <span style={statusStyle(item.status)}>{item.status}</span>
                </div>
                <p style={styles.meta}>
                  {item.last_checked_at
                    ? `Checked ${new Date(item.last_checked_at).toLocaleString()}`
                    : 'Never checked'}
                </p>
                <div style={styles.actions}>
                  <button style={styles.btn} onClick={() => open(item.key)}>
                    Configure
                  </button>
                  <button
                    style={styles.btnGhost}
                    onClick={() => toggle(item.key, !item.is_enabled)}
                  >
                    {item.is_enabled ? 'Disable' : 'Enable'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {selected && detail ? (
        <div style={styles.panel}>
          <h3 style={styles.h2}>{detail.display_name}</h3>
          <p style={styles.meta}>Secrets are masked after save. Re-enter to rotate.</p>
          {(detail.credentials || []).map((c: any) => (
            <p key={c.key} style={styles.meta}>
              {c.key}: {c.preview}
            </p>
          ))}
          <label style={styles.label}>
            secret_key
            <input
              style={styles.input}
              type="password"
              value={creds.secret_key || ''}
              onChange={(e) => setCreds({ ...creds, secret_key: e.target.value })}
            />
          </label>
          <label style={styles.label}>
            public_key
            <input
              style={styles.input}
              type="password"
              value={creds.public_key || ''}
              onChange={(e) => setCreds({ ...creds, public_key: e.target.value })}
            />
          </label>
          <div style={styles.actions}>
            <button style={styles.btn} onClick={save}>
              Save
            </button>
            <button style={styles.btn} onClick={test}>
              Test connection
            </button>
            <button style={styles.btnGhost} onClick={() => setSelected(null)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function statusStyle(status: string): React.CSSProperties {
  const color =
    status === 'connected'
      ? '#00D97A'
      : status === 'error'
        ? '#FF3B5C'
        : status === 'configured'
          ? '#0055FF'
          : '#A0A0A0';
  return {
    fontSize: 12,
    color,
    border: `1px solid ${color}`,
    borderRadius: 999,
    padding: '2px 10px',
  };
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#000',
    color: '#fff',
    padding: 32,
    fontFamily: 'Poppins, Montserrat, sans-serif',
  },
  h1: { fontSize: 24, marginBottom: 8 },
  h2: { fontSize: 18, marginBottom: 12, textTransform: 'capitalize' },
  sub: { color: '#A0A0A0', marginBottom: 24 },
  msg: { color: '#00D97A', marginBottom: 16 },
  section: { marginBottom: 32 },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: 16,
  },
  card: {
    background: '#0A0A0A',
    border: '1px solid #2A2A2A',
    borderRadius: 12,
    padding: 16,
  },
  cardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  meta: { color: '#A0A0A0', fontSize: 13, marginBottom: 8 },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 },
  btn: {
    background: 'linear-gradient(135deg, #3F7048 0%, #6A00FF 50%, #0055FF 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: 999,
    padding: '8px 14px',
    cursor: 'pointer',
    fontWeight: 600,
  },
  btnGhost: {
    background: 'transparent',
    color: '#fff',
    border: '1px solid #2A2A2A',
    borderRadius: 999,
    padding: '8px 14px',
    cursor: 'pointer',
  },
  panel: {
    position: 'fixed',
    right: 24,
    top: 24,
    bottom: 24,
    width: 360,
    background: '#1A1A1A',
    border: '1px solid #2A2A2A',
    borderRadius: 16,
    padding: 20,
    overflow: 'auto',
  },
  label: { display: 'block', fontSize: 13, color: '#A0A0A0', marginBottom: 12 },
  input: {
    display: 'block',
    width: '100%',
    marginTop: 6,
    background: '#0A0A0A',
    border: '1px solid #2A2A2A',
    borderRadius: 8,
    color: '#fff',
    padding: '10px 12px',
  },
};
