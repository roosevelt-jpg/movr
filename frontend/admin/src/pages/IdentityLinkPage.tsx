import React, { useState } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}` });

export default function IdentityLinkPage() {
  const [userId, setUserId] = useState('');
  const [data, setData] = useState<any>(null);
  const [override, setOverride] = useState({
    checkType: 'id_to_vehicle',
    status: 'match',
    reason: '',
  });

  const load = async () => {
    const res = await axios.get(`${API}/identity/${userId}`, { headers: headers() });
    setData(res.data.data);
  };

  const runLink = async () => {
    await axios.post(`${API}/identity/link/${userId}`, {}, { headers: headers() });
    await load();
  };

  const applyOverride = async () => {
    await axios.post(`${API}/identity/${userId}/override`, override, { headers: headers() });
    await load();
  };

  const latestByType = (type: string) =>
    data?.checks?.find((c: any) => c.check_type === type);

  const pill = (status?: string) => {
    const color =
      status === 'match' ? '#3F7048' : status === 'mismatch' ? '#B00020' : '#666';
    return (
      <span style={{ ...styles.pill, background: color }}>{status || '—'}</span>
    );
  };

  return (
    <div style={styles.page}>
      <h1 style={styles.h1}>Identity link graph</h1>
      <p style={styles.sub}>National ID ↔ license ↔ vehicle ↔ phone — per-check status.</p>
      <div style={styles.form}>
        <input
          style={styles.input}
          placeholder="User / driver user id"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        />
        <button style={styles.btn} onClick={load}>Load</button>
        <button style={styles.btnSecondary} onClick={runLink}>Re-run linking</button>
      </div>

      {data ? (
        <>
          <p style={styles.meta}>
            Identity-Linked: <strong>{data.identityLinked ? 'yes' : 'no'}</strong>
          </p>
          <div style={styles.grid}>
            {[
              { label: 'National ID → License', type: 'id_to_license' },
              { label: 'National ID → Vehicle', type: 'id_to_vehicle' },
              { label: 'National ID → Phone', type: 'id_to_phone' },
            ].map((item) => {
              const c = latestByType(item.type);
              return (
                <div key={item.type} style={styles.card}>
                  <strong>{item.label}</strong>
                  <div style={{ marginTop: 8 }}>{pill(c?.status)}</div>
                  <div style={styles.meta}>{c?.checked_at || 'not checked'}</div>
                </div>
              );
            })}
          </div>

          <h2 style={styles.h2}>Manual override</h2>
          <div style={styles.form}>
            <select
              style={styles.input}
              value={override.checkType}
              onChange={(e) => setOverride({ ...override, checkType: e.target.value })}
            >
              <option value="id_to_license">id_to_license</option>
              <option value="id_to_vehicle">id_to_vehicle</option>
              <option value="id_to_phone">id_to_phone</option>
            </select>
            <select
              style={styles.input}
              value={override.status}
              onChange={(e) => setOverride({ ...override, status: e.target.value })}
            >
              <option value="match">match</option>
              <option value="mismatch">mismatch</option>
              <option value="unverifiable">unverifiable</option>
            </select>
            <input
              style={styles.input}
              placeholder="Reason (required)"
              value={override.reason}
              onChange={(e) => setOverride({ ...override, reason: e.target.value })}
            />
            <button style={styles.btn} onClick={applyOverride}>Override</button>
          </div>
        </>
      ) : null}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#000', color: '#fff', padding: 32, fontFamily: 'Poppins, sans-serif' },
  h1: { fontSize: 24, marginBottom: 8 },
  h2: { fontSize: 18, marginTop: 24 },
  sub: { color: '#A0A0A0', marginBottom: 16 },
  form: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  input: { background: '#0A0A0A', border: '1px solid #2A2A2A', color: '#fff', padding: '8px 12px', borderRadius: 8 },
  btn: { background: '#6A00FF', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer' },
  btnSecondary: { background: '#0055FF', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', cursor: 'pointer' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12 },
  card: { background: '#0A0A0A', border: '1px solid #2A2A2A', borderRadius: 12, padding: 14 },
  meta: { color: '#A0A0A0', fontSize: 13, marginTop: 6 },
  pill: { display: 'inline-block', padding: '4px 10px', borderRadius: 6, fontSize: 12, color: '#fff' },
};
