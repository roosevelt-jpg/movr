import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}` });

export default function ChannelFunnelPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [failures, setFailures] = useState<any[]>([]);

  useEffect(() => {
    axios
      .get(`${API}/admin/channels/funnel`, { headers: headers() })
      .then((r) => {
        const data = r.data.data;
        if (Array.isArray(data)) setRows(data);
        else {
          setRows(data?.channels || []);
          setFailures(data?.parseFailures || []);
        }
      })
      .catch(() => undefined);
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--jet-black)', color: 'var(--pure-white)', padding: 32, fontFamily: 'Poppins, sans-serif' }}>
      <h1 style={{ fontSize: 24 }}>Channel funnel</h1>
      <p style={{ color: 'var(--text-secondary)' }}>Rides by source_channel (app, whatsapp, telegram, sms, ussd, ivr, voice).</p>
      <div style={{ height: 280, marginTop: 24 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows}>
            <XAxis dataKey="channel" stroke="var(--text-secondary)" />
            <YAxis stroke="var(--text-secondary)" />
            <Tooltip />
            <Bar dataKey="rides" fill="var(--electric-violet)" name="Started" />
            <Bar dataKey="completed" fill="var(--success)" name="Completed" />
            <Bar dataKey="cancelled" fill="var(--error)" name="Cancelled" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {failures.length ? (
        <div style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 18 }}>Voice parse failures (30d)</h2>
          <ul>
            {failures.map((f) => (
              <li key={f.channel}>
                {f.channel}: {f.failures}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
