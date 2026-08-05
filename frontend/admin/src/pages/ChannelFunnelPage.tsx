import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const API = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}` });

export default function ChannelFunnelPage() {
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    axios
      .get(`${API}/admin/channels/funnel`, { headers: headers() })
      .then((r) => setRows(r.data.data || []))
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
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
