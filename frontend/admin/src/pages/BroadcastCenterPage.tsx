import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import AdminShell from '../layouts/AdminShell';
import { adminBtn } from '../styles/adminButtons';

const API = process.env.REACT_APP_API_URL || '/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}` });

const AUDIENCES = [
  { value: 'all_users', label: 'All Users' },
  { value: 'expiring_soon', label: 'Expiring Soon' },
  { value: 'lagos_users', label: 'Lagos Users' },
  { value: 'post_ride', label: 'Post-ride' },
  { value: 'drivers', label: 'Drivers' },
  { value: 'merchants', label: 'Merchants' },
];

function formatCompact(n: number) {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return v.toLocaleString();
}

/** Notification & Broadcast Center — compose, recent sends, delivery stats. */
export default function BroadcastCenterPage() {
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [stats, setStats] = useState({ sentToday: 0, avgOpenRate: 0, totalRecipients: 0, unsubscribedPct: 0 });
  const [rows, setRows] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [target, setTarget] = useState('all_users');
  const [channels, setChannels] = useState<string[]>(['push', 'in_app']);
  const [title, setTitle] = useState('Double DVT Weekend Is Live!');
  const [body, setBody] = useState('Earn 2x DriveTokens on every ride and order this weekend only. Tap to start earning!');
  const [schedule, setSchedule] = useState('immediate');
  const [audienceCount, setAudienceCount] = useState(0);

  const load = async () => {
    try {
      const [s, b, t] = await Promise.all([
        axios.get(`${API}/admin/broadcasts/stats`, { headers: headers() }),
        axios.get(`${API}/admin/broadcasts`, { headers: headers() }),
        axios.get(`${API}/admin/broadcasts/templates`, { headers: headers() }),
      ]);
      setStats(s.data?.data || stats);
      setRows(b.data?.data || []);
      setTemplates(t.data?.data || []);
      setError('');
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Failed to load broadcasts');
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    axios
      .get(`${API}/admin/broadcasts/audience-count`, { headers: headers(), params: { target } })
      .then((res) => setAudienceCount(Number(res.data?.data?.count || 0)))
      .catch(() => setAudienceCount(0));
  }, [target]);

  const toggleChannel = (c: string) => {
    setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  const send = async () => {
    if (!title.trim() || !body.trim()) {
      setError('Title and message required');
      return;
    }
    if (!channels.length) {
      setError('Select at least one channel');
      return;
    }
    setSending(true);
    try {
      await axios.post(
        `${API}/admin/broadcasts`,
        {
          title,
          body,
          targetAudience: target,
          channels,
          scheduleMode: schedule,
        },
        { headers: headers() }
      );
      setMessage(`Broadcast sent to ${formatCompact(audienceCount)} recipients`);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Send failed');
    } finally {
      setSending(false);
    }
  };

  const previewTitle = useMemo(() => title || 'Notification title', [title]);
  const previewBody = useMemo(() => (body || '').slice(0, 90), [body]);

  return (
    <AdminShell activeLabel="Broadcasts" hidePageTitle>
      <div style={styles.headerRow}>
        <div>
          <h1 style={styles.h1}>Notification & Broadcast Center</h1>
          <p style={styles.sub}>Send messages to users, drivers or merchants</p>
        </div>
        <div style={styles.actions} className="admin-actions">
          <button type="button" style={styles.secondaryBtn} onClick={() => setShowTemplates((v) => !v)}>
            Templates
          </button>
          <button type="button" style={styles.primaryBtn} onClick={send} disabled={sending}>
            {sending ? 'Sending…' : 'Send Broadcast'}
          </button>
        </div>
      </div>

      {error ? <p style={styles.error}>{error}</p> : null}
      {message ? <p style={styles.message}>{message}</p> : null}

      {showTemplates ? (
        <div style={styles.templateBox}>
          {templates.length === 0 ? (
            <p style={styles.muted}>No templates yet.</p>
          ) : (
            templates.map((t) => (
              <button
                key={t.id}
                type="button"
                style={styles.templateItem}
                onClick={() => {
                  setTitle(t.title);
                  setBody(t.body);
                  setChannels(Array.isArray(t.channels) ? t.channels : ['push']);
                  setShowTemplates(false);
                }}
              >
                <strong>{t.name}</strong>
                <span style={styles.muted}>{t.title}</span>
              </button>
            ))
          )}
        </div>
      ) : null}

      <div style={styles.kpiRow}>
        {[
          { label: 'Sent Today', value: String(stats.sentToday) },
          { label: 'Avg Open Rate', value: `${stats.avgOpenRate}%` },
          { label: 'Total Recipients', value: formatCompact(stats.totalRecipients) },
          { label: 'Unsubscribed', value: `${stats.unsubscribedPct}%` },
        ].map((c) => (
          <div key={c.label} style={styles.kpi}>
            <div style={styles.label}>{c.label}</div>
            <div style={styles.kpiValue}>{c.value}</div>
          </div>
        ))}
      </div>

      <div style={styles.grid}>
        <div style={styles.card}>
          <div style={styles.cardHead}>
            <h2 style={styles.h2}>Recent Broadcasts</h2>
            <span style={styles.muted}>View all</span>
          </div>
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {['Title', 'Target', 'Sent To', 'Open Rate', 'Type', 'Date', ''].map((h) => (
                    <th key={h} style={styles.th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={styles.td}>
                      No broadcasts yet.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id}>
                      <td style={styles.td}>{r.title}</td>
                      <td style={styles.td}>{r.target}</td>
                      <td style={styles.td}>{Number(r.sentTo || 0).toLocaleString()}</td>
                      <td style={{ ...styles.td, color: '#4ade80' }}>{r.openRate}%</td>
                      <td style={styles.td}>{r.type}</td>
                      <td style={styles.td}>
                        {r.date
                          ? new Date(r.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                          : '—'}
                      </td>
                      <td style={styles.td}>
                        <span style={{ color: '#a78bfa', cursor: 'pointer' }}>View</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div style={styles.compose}>
          <h2 style={styles.h2}>Compose Broadcast</h2>
          <label style={styles.fieldLabel}>Target Audience</label>
          <select style={styles.input} value={target} onChange={(e) => setTarget(e.target.value)}>
            {AUDIENCES.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>

          <label style={styles.fieldLabel}>Channels</label>
          <div style={styles.channelRow}>
            {[
              { id: 'push', label: 'Push' },
              { id: 'in_app', label: 'In-App' },
              { id: 'email', label: 'Email' },
            ].map((c) => (
              <label key={c.id} style={styles.check}>
                <input
                  type="checkbox"
                  checked={channels.includes(c.id)}
                  onChange={() => toggleChannel(c.id)}
                />
                {c.label}
              </label>
            ))}
          </div>

          <label style={styles.fieldLabel}>Title</label>
          <input style={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} />

          <label style={styles.fieldLabel}>Message Body</label>
          <textarea style={{ ...styles.input, minHeight: 90 }} value={body} onChange={(e) => setBody(e.target.value)} />

          <label style={styles.fieldLabel}>Schedule</label>
          <select style={styles.input} value={schedule} onChange={(e) => setSchedule(e.target.value)}>
            <option value="immediate">Send Immediately</option>
            <option value="scheduled">Schedule for later</option>
          </select>

          <div style={styles.preview}>
            <div style={styles.previewLabel}>Push Preview</div>
            <div style={styles.previewCard}>
              <strong>{previewTitle}</strong>
              <p style={styles.previewBody}>{previewBody}</p>
            </div>
          </div>

          <button type="button" style={styles.sendBtn} onClick={send} disabled={sending}>
            {sending ? 'Sending…' : `Send to ${formatCompact(audienceCount)} Users`}
          </button>
        </div>
      </div>
    </AdminShell>
  );
}

const styles: Record<string, React.CSSProperties> = {
  headerRow: { display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 },
  h1: { margin: 0, fontSize: 28, color: 'var(--text-primary)' },
  h2: { margin: 0, fontSize: 16, color: 'var(--text-primary)' },
  sub: { margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: 14 },
  actions: { display: 'flex', gap: 10 },
  primaryBtn: { ...adminBtn.primary },
  secondaryBtn: { ...adminBtn.secondary },
  error: { color: '#f87171' },
  message: { color: '#4ade80' },
  muted: { color: 'var(--text-secondary)', fontSize: 13 },
  kpiRow: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 16 },
  kpi: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: 16,
  },
  label: { color: 'var(--text-secondary)', fontSize: 12 },
  kpiValue: { fontSize: 28, fontWeight: 700, marginTop: 8, color: 'var(--text-primary)' },
  grid: { display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, alignItems: 'start' },
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: 16,
  },
  cardHead: { display: 'flex', justifyContent: 'space-between', marginBottom: 12 },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left',
    fontSize: 12,
    color: 'var(--text-secondary)',
    padding: '8px 6px',
    borderBottom: '1px solid var(--border)',
  },
  td: { padding: '10px 6px', borderBottom: '1px solid var(--border)', fontSize: 13, color: 'var(--text-primary)' },
  compose: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  fieldLabel: { fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 },
  input: {
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '10px 12px',
    color: 'var(--text-primary)',
    width: '100%',
  },
  channelRow: { display: 'flex', gap: 14, flexWrap: 'wrap' },
  check: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-primary)' },
  preview: { marginTop: 8 },
  previewLabel: { fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 },
  previewCard: {
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 12,
  },
  previewBody: { margin: '6px 0 0', fontSize: 13, color: 'var(--text-secondary)' },
  sendBtn: { ...adminBtn.primary, marginTop: 10 },
  templateBox: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: 10,
    marginBottom: 16,
  },
  templateItem: {
    textAlign: 'left',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 12,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    color: 'var(--text-primary)',
  },
};
