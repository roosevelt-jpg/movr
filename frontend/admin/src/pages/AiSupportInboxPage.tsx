import React, { useEffect, useState } from 'react';
import axios from 'axios';
import AdminShell from '../layouts/AdminShell';
import { adminBtn } from '../styles/adminButtons';

const API = process.env.REACT_APP_API_URL || '/api/v1';
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem('movr_admin_token') || ''}` });

/**
 * AI Support Inbox — escalations from Movr AI with triage + suggested replies.
 */
export default function AiSupportInboxPage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [reply, setReply] = useState('');
  const [filter, setFilter] = useState('open');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const res = await axios.get(`${API}/admin/ai/tickets`, {
        headers: headers(),
        params: { status: filter },
      });
      setTickets(res.data?.data || []);
      setError('');
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || 'Failed to load');
    }
  };

  useEffect(() => {
    load();
    const id = window.setInterval(load, 20000);
    return () => window.clearInterval(id);
  }, [filter]);

  const openTicket = async (t: any) => {
    setSelected(t);
    setReply(t.suggested_reply || '');
    try {
      const res = await axios.get(`${API}/admin/ai/tickets/${t.id}`, { headers: headers() });
      setSelected(res.data?.data || t);
      setMessages(res.data?.data?.messages || []);
      if (res.data?.data?.suggested_reply) setReply(res.data.data.suggested_reply);
    } catch {
      setMessages([]);
    }
  };

  const sendReply = async (closeAfter?: boolean) => {
    if (!selected?.id) return;
    setBusy(true);
    try {
      await axios.patch(
        `${API}/admin/ai/tickets/${selected.id}`,
        {
          reply: reply || undefined,
          status: closeAfter ? 'resolved' : selected.status,
          opsNote: closeAfter ? 'Resolved from AI inbox' : undefined,
        },
        { headers: headers() }
      );
      setMsg(closeAfter ? 'Ticket resolved' : 'Reply sent');
      await load();
      await openTicket(selected);
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message);
    } finally {
      setBusy(false);
    }
  };

  const refreshRankings = async () => {
    setBusy(true);
    try {
      const res = await axios.post(`${API}/admin/ai/rankings/refresh`, {}, { headers: headers() });
      setMsg(`Rankings refreshed · ${JSON.stringify(res.data?.data || {})}`);
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminShell activeLabel="AI Support" hidePageTitle>
      <div style={styles.wrap}>
        <div style={styles.head}>
          <div>
            <h1 style={styles.h1}>AI Support Inbox</h1>
            <p style={styles.sub}>Escalations from Movr AI · triage · suggested replies</p>
          </div>
          <button
            type="button"
            className="admin-btn"
            style={adminBtn.primary}
            disabled={busy}
            onClick={refreshRankings}
          >
            Refresh rankings
          </button>
        </div>

        {msg ? <p style={styles.ok}>{msg}</p> : null}
        {error ? <p style={styles.err}>{error}</p> : null}

        <div style={styles.filters}>
          {['open', 'all', 'resolved', 'closed'].map((f) => (
            <button
              key={f}
              type="button"
              className="admin-btn"
              style={filter === f ? adminBtn.primary : undefined}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>

        <div style={styles.grid}>
          <section style={styles.card}>
            <h2 style={styles.h2}>Tickets ({tickets.length})</h2>
            <div className="admin-table-scroll">
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Subject</th>
                    <th style={styles.th}>Triage</th>
                    <th style={styles.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={styles.muted}>
                        No tickets
                      </td>
                    </tr>
                  ) : (
                    tickets.map((t) => (
                      <tr
                        key={t.id}
                        style={{
                          cursor: 'pointer',
                          background: selected?.id === t.id ? '#1f1f23' : undefined,
                        }}
                        onClick={() => openTicket(t)}
                      >
                        <td style={styles.td}>
                          {t.subject}
                          <div style={styles.small}>
                            {t.customer_name || t.guest_name || 'Guest'} ·{' '}
                            {t.created_at ? new Date(t.created_at).toLocaleString() : ''}
                          </div>
                        </td>
                        <td style={styles.td}>
                          {t.triage_category || '—'}
                          <div style={styles.small}>{t.triage_priority || t.priority}</div>
                        </td>
                        <td style={styles.td}>{t.status}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section style={styles.card}>
            <h2 style={styles.h2}>Detail</h2>
            {!selected ? (
              <p style={styles.muted}>Select a ticket</p>
            ) : (
              <>
                <p style={styles.detailTitle}>{selected.subject}</p>
                <p style={styles.small}>
                  {selected.triage_category || 'general'} · {selected.triage_priority || selected.priority}{' '}
                  · {selected.channel || 'in_app'}
                </p>
                {selected.suggested_reply ? (
                  <div style={styles.suggest}>
                    <strong>Suggested reply</strong>
                    <p style={{ margin: '6px 0 0' }}>{selected.suggested_reply}</p>
                    <button
                      type="button"
                      className="admin-btn"
                      style={{ marginTop: 8 }}
                      onClick={() => setReply(selected.suggested_reply)}
                    >
                      Use suggestion
                    </button>
                  </div>
                ) : null}
                <div style={styles.thread}>
                  {(Array.isArray(selected.transcript) ? selected.transcript : [])
                    .slice(-12)
                    .map((m: any, i: number) => (
                      <p key={i} style={styles.bubble}>
                        <strong>{m.role || m.from || 'user'}:</strong> {m.content || m.text}
                      </p>
                    ))}
                  {messages.map((m) => (
                    <p key={m.id} style={styles.bubble}>
                      <strong>{m.sender}:</strong> {m.body}
                    </p>
                  ))}
                </div>
                <textarea
                  style={styles.textarea}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Agent reply"
                  rows={4}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button
                    type="button"
                    className="admin-btn"
                    style={adminBtn.primary}
                    disabled={busy || !reply.trim()}
                    onClick={() => sendReply(false)}
                  >
                    Send reply
                  </button>
                  <button
                    type="button"
                    className="admin-btn"
                    disabled={busy}
                    onClick={() => sendReply(true)}
                  >
                    Resolve
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </AdminShell>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { padding: 24, maxWidth: 1200, margin: '0 auto' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 },
  h1: { margin: 0, fontSize: 28, color: '#fff' },
  sub: { margin: '6px 0 0', color: '#a1a1aa', fontSize: 14 },
  ok: { color: '#34d399' },
  err: { color: '#f87171' },
  filters: { display: 'flex', gap: 8, marginTop: 16 },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(280px, 1fr) minmax(320px, 1.1fr)',
    gap: 16,
    marginTop: 16,
  },
  card: {
    padding: 16,
    borderRadius: 14,
    background: '#111',
    border: '1px solid #27272a',
  },
  h2: { margin: '0 0 12px', fontSize: 16, color: '#fff' },
  table: { width: '100%', borderCollapse: 'collapse' as const },
  th: { textAlign: 'left' as const, color: '#71717a', fontSize: 11, padding: '8px 6px' },
  td: { color: '#e4e4e7', fontSize: 13, padding: '10px 6px', borderTop: '1px solid #1f1f23' },
  muted: { color: '#71717a', padding: 12 },
  small: { fontSize: 11, color: '#a1a1aa', marginTop: 2 },
  detailTitle: { color: '#fff', fontWeight: 700, margin: 0 },
  suggest: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    background: 'rgba(167,139,250,0.12)',
    border: '1px solid rgba(167,139,250,0.35)',
    color: '#e9d5ff',
    fontSize: 13,
  },
  thread: { marginTop: 12, maxHeight: 240, overflow: 'auto' },
  bubble: { color: '#d4d4d8', fontSize: 13, margin: '0 0 8px' },
  textarea: {
    width: '100%',
    marginTop: 12,
    background: '#000',
    border: '1px solid #3f3f46',
    borderRadius: 10,
    color: '#fff',
    padding: 10,
    resize: 'vertical' as const,
  },
};
