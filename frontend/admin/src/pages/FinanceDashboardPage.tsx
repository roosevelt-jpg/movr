import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';

function headers() {
  return { Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}` };
}

export default function FinanceDashboardPage() {
  const [gmv, setGmv] = useState<any[]>([]);
  const [batch, setBatch] = useState<any>(null);
  const [message, setMessage] = useState('');

  const load = async () => {
    const res = await axios.get(`${API}/admin/finance/gmv`, { headers: headers() });
    setGmv(res.data.data || []);
  };

  useEffect(() => {
    load().catch((e) => setMessage(e.message));
  }, []);

  const createBatch = async () => {
    const end = new Date();
    const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const res = await axios.post(
      `${API}/admin/finance/payout-batches`,
      {
        recipientType: 'driver',
        periodStart: start.toISOString(),
        periodEnd: end.toISOString(),
      },
      { headers: headers() }
    );
    setBatch(res.data.data);
    setMessage('Payout batch ready');
  };

  const exportCsv = () => {
    const to = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    window.open(
      `${API}/admin/finance/reconciliation?format=csv&from=${from}&to=${to}`,
      '_blank'
    );
  };

  const chartData = gmv.map((r) => ({
    name: `${r.date}-${r.service_type}`,
    gmv: Number(r.gmv_amount),
  }));

  return (
    <div style={styles.page}>
      <h1 style={styles.h1}>Finance</h1>
      <p style={styles.sub}>GMV rollups, payout batches, reconciliation.</p>
      {message ? <p style={{ color: '#00D97A' }}>{message}</p> : null}

      <div style={{ height: 280, marginBottom: 24 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid stroke="#2A2A2A" />
            <XAxis dataKey="name" hide />
            <YAxis stroke="#A0A0A0" />
            <Tooltip />
            <Bar dataKey="gmv" fill="#6A00FF" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={styles.actions}>
        <button style={styles.btn} onClick={createBatch}>Create driver payout batch</button>
        <button style={styles.btnGhost} onClick={exportCsv}>Export reconciliation CSV</button>
        <button
          style={styles.btnGhost}
          onClick={() => axios.post(`${API}/admin/finance/rollup`, {}, { headers: headers() }).then(load)}
        >
          Run GMV rollup
        </button>
      </div>

      {batch ? (
        <div style={styles.card}>
          <strong>Batch {batch.id?.slice?.(0, 8)}</strong>
          <div>Status: {batch.status}</div>
          <div>Total: GHS {Number(batch.total_amount).toFixed(2)}</div>
          <div>Items: {batch.items?.length || 0}</div>
        </div>
      ) : null}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: '#000', color: '#fff', padding: 32, fontFamily: 'Poppins, sans-serif' },
  h1: { fontSize: 24, marginBottom: 8 },
  sub: { color: '#A0A0A0', marginBottom: 16 },
  actions: { display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 },
  btn: {
    background: 'linear-gradient(135deg, #3F7048 0%, #6A00FF 50%, #0055FF 100%)',
    border: 'none',
    color: '#fff',
    borderRadius: 999,
    padding: '10px 16px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnGhost: {
    background: 'transparent',
    border: '1px solid #2A2A2A',
    color: '#fff',
    borderRadius: 999,
    padding: '10px 16px',
    cursor: 'pointer',
  },
  card: {
    border: '1px solid #2A2A2A',
    borderRadius: 12,
    padding: 16,
    background: '#0A0A0A',
  },
};
