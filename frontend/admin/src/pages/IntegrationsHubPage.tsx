import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import AdminShell from '../layouts/AdminShell';

const API = process.env.REACT_APP_API_URL || '/api/v1';

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

const CATEGORY_LABEL: Record<string, string> = {
  payments: 'PAYMENTS',
  messaging: 'MESSAGING',
  maps_location: 'MAPS',
  ai_voice: 'AI & VOICE',
  identity_verification: 'IDENTITY',
  infrastructure: 'INFRASTRUCTURE',
  pricing_signals: 'PRICING SIGNALS',
};

function statusBadge(status: string) {
  const s = status.toLowerCase().replace(/\s+/g, '_');
  if (s.includes('connected') || s === 'active') {
    return { background: 'rgba(63,112,72,0.35)', color: 'var(--success)', label: 'Connected' };
  }
  if (s.includes('configur') && !s.includes('not')) {
    return { background: 'rgba(255,184,0,0.2)', color: 'var(--warning)', label: 'Configured' };
  }
  return { background: 'rgba(255,59,92,0.2)', color: 'var(--error)', label: 'Not configured' };
}

/** Integrations hub — categorized cards matching admin mockup. */
export default function IntegrationsHubPage() {
  const [items, setItems] = useState<Integration[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [creds, setCreds] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const token = localStorage.getItem('movr_admin_token') || '';
  const headers = { Authorization: `Bearer ${token}` };

  const load = async () => {
    const res = await axios.get(`${API}/admin/integrations`, { headers });
    setItems(res.data.data || []);
  };

  useEffect(() => {
    load()
      .then(() => setError(''))
      .catch((e) => {
        setItems([]);
        setError(e?.response?.data?.message || e.message || 'Failed to load integrations');
      });
  }, []);

  const grouped = useMemo(() => {
    const map: Record<string, Integration[]> = {};
    for (const item of items) {
      if (!map[item.category]) map[item.category] = [];
      map[item.category].push(item);
    }
    return map;
  }, [items]);

  const open = async (key: string) => {
    setSelected(key);
    try {
      const res = await axios.get(`${API}/admin/integrations/${key}`, { headers });
      setDetail(res.data.data);
    } catch {
      setDetail({ display_name: key, credentials: [] });
    }
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
    const res = await axios.post(`${API}/admin/integrations/${selected}/test`, {}, { headers });
    setMessage(`Test: ${res.data.data.status}`);
    await load();
  };

  return (
    <AdminShell activeLabel="Integrations">
      <h1 style={styles.h1}>Integrations</h1>
      {message ? <p style={styles.msg}>{message}</p> : null}
      {error ? <p style={{ color: 'var(--error)' }}>{error}</p> : null}

      {items.length === 0 && !error ? (
        <p style={{ color: 'var(--text-secondary)' }}>No integrations configured</p>
      ) : null}

      {Object.keys(grouped).map((cat) => (
        <section key={cat} style={styles.section}>
          <p style={styles.cat}>{CATEGORY_LABEL[cat] || cat.toUpperCase()}</p>
          <div style={styles.grid}>
            {grouped[cat].map((item) => {
              const badge = statusBadge(item.status);
              return (
                <div key={item.key} style={styles.card}>
                  <div style={styles.cardTop}>
                    <div>
                      <strong style={styles.cardTitle}>{item.display_name}</strong>
                      <p style={styles.cardCat}>
                        {CATEGORY_LABEL[item.category]?.replace(/_/g, ' ') || item.category}
                      </p>
                    </div>
                    <span style={{ ...styles.badge, background: badge.background, color: badge.color }}>
                      {badge.label}
                    </span>
                  </div>
                  <button style={styles.link} onClick={() => open(item.key)}>
                    Configure →
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {selected && detail ? (
        <div style={styles.panel}>
          <h3 style={{ marginTop: 0 }}>{detail.display_name}</h3>
          <p style={styles.cardCat}>Secrets are masked after save. Re-enter to rotate.</p>
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
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button style={styles.primary} onClick={save}>Save</button>
            <button style={styles.primary} onClick={test}>Test connection</button>
            <button style={styles.ghost} onClick={() => setSelected(null)}>Close</button>
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}

const styles: Record<string, React.CSSProperties> = {
  h1: { fontSize: 28, fontWeight: 700, marginBottom: 8 },
  msg: { color: 'var(--electric-violet)' },
  section: { marginTop: 28 },
  cat: { color: 'var(--text-secondary)', fontSize: 12, letterSpacing: 1.2, marginBottom: 12, fontWeight: 600 },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: 12,
  },
  card: {
    background: 'var(--surface-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: 16,
    minHeight: 120,
    display: 'flex',
    flexDirection: 'column',
  },
  cardTop: { display: 'flex', justifyContent: 'space-between', gap: 8 },
  cardTitle: { fontSize: 16 },
  cardCat: { color: 'var(--text-secondary)', fontSize: 13, marginTop: 6 },
  badge: {
    borderRadius: 999,
    padding: '4px 10px',
    fontSize: 11,
    fontWeight: 700,
    height: 'fit-content',
    whiteSpace: 'nowrap',
  },
  link: {
    marginTop: 'auto',
    background: 'transparent',
    border: 'none',
    color: 'var(--motion-blue)',
    padding: 0,
    textAlign: 'left',
    cursor: 'pointer',
    fontWeight: 600,
  },
  panel: {
    marginTop: 24,
    background: 'var(--surface-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: 20,
  },
  label: { display: 'block', marginTop: 10, fontSize: 13, color: 'var(--text-secondary)' },
  input: {
    display: 'block',
    width: '100%',
    marginTop: 6,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    color: 'var(--pure-white)',
    borderRadius: 8,
    padding: '8px 12px',
  },
  primary: {
    background: 'linear-gradient(90deg, var(--electric-violet), var(--motion-blue))',
    color: 'var(--pure-white)',
    border: 'none',
    borderRadius: 8,
    padding: '8px 14px',
    cursor: 'pointer',
    fontWeight: 700,
  },
  ghost: {
    background: 'transparent',
    color: 'var(--pure-white)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '8px 14px',
    cursor: 'pointer',
  },
};
