import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import AdminShell from '../layouts/AdminShell';

const API = process.env.REACT_APP_API_URL || '/api/v1';

function extractSmsReply(payload: any): string | null {
  if (!payload) return null;
  if (typeof payload === 'string') {
    const xmlMatch = payload.match(/<Message>([\s\S]*?)<\/Message>/i);
    if (xmlMatch) return xmlMatch[1].trim();
    if (payload.trim() && !payload.trim().startsWith('<')) return payload.trim();
    return null;
  }
  if (typeof payload === 'object') {
    return (
      payload.message ||
      payload.text ||
      payload.reply ||
      payload.data?.message ||
      payload.data?.text ||
      null
    );
  }
  return null;
}

/** Admin SMS channel tester — posts to /webhooks/sms and shows API replies. */
export default function SmsChannelPage() {
  const [messages, setMessages] = useState<{ from: 'user' | 'movr'; text: string }[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const body = input.trim();
    if (!body || busy) return;
    setInput('');
    setMessages((m) => [...m, { from: 'user', text: body }]);
    setBusy(true);

    try {
      const webhookBase = API.replace(/\/api\/v1\/?$/, '');
      const res = await axios.post(
        `${webhookBase}/webhooks/sms`,
        { From: '+233240000000', Body: body },
        { responseType: 'text', transformResponse: [(d) => d] }
      );
      const reply = extractSmsReply(res.data);
      if (reply) {
        setMessages((m) => [...m, { from: 'movr', text: reply.startsWith('Movr:') ? reply : `Movr: ${reply}` }]);
      } else {
        setMessages((m) => [
          ...m,
          { from: 'movr', text: 'Movr: (no reply body from webhook)' },
        ]);
      }
    } catch (e: any) {
      const fromErr =
        extractSmsReply(e?.response?.data) ||
        e?.response?.data?.message ||
        e.message ||
        'Webhook request failed';
      setMessages((m) => [...m, { from: 'movr', text: `Movr: ${fromErr}` }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminShell activeLabel="Channels">
      <div style={styles.wrap}>
        <h1 style={styles.h1}>SMS channel tester</h1>
        <p style={styles.sub}>
          Posts to webhook <code>/webhooks/sms</code> · replies come from the API only ·{' '}
          <Link to="/channels" style={{ color: '#4A86E8' }}>
            Funnel
          </Link>
        </p>
        <div style={styles.thread}>
          {messages.length === 0 ? (
            <p style={styles.hint}>Send a message such as RIDE pickup, destination</p>
          ) : (
            messages.map((m, i) => (
              <div
                key={i}
                style={{
                  ...styles.bubble,
                  ...(m.from === 'user' ? styles.user : styles.bot),
                }}
              >
                {m.text}
              </div>
            ))
          )}
        </div>
        <div style={styles.composer}>
          <input
            style={styles.input}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="RIDE Osu, Kotoka Airport"
            onKeyDown={(e) => e.key === 'Enter' && send()}
            disabled={busy}
          />
          <button type="button" style={styles.send} onClick={send} disabled={busy}>
            Send
          </button>
        </div>
      </div>
    </AdminShell>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 480, margin: '0 auto' },
  h1: { fontSize: 18, textAlign: 'center', color: '#888', fontWeight: 500 },
  sub: { textAlign: 'center', color: '#666', fontSize: 13, marginBottom: 16 },
  hint: { color: '#666', textAlign: 'center', margin: 'auto 0' },
  thread: {
    background: '#0A0A0A',
    border: '1px solid #2A2A2A',
    borderRadius: 16,
    padding: 16,
    minHeight: 360,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 16,
    padding: '10px 14px',
    fontSize: 14,
    lineHeight: 1.4,
  },
  user: {
    alignSelf: 'flex-end',
    background: '#0A84FF',
    color: '#fff',
  },
  bot: {
    alignSelf: 'flex-start',
    background: '#2C2C2E',
    color: '#fff',
  },
  composer: { display: 'flex', gap: 8, marginTop: 12 },
  input: {
    flex: 1,
    background: '#121212',
    border: '1px solid #2A2A2A',
    color: '#fff',
    borderRadius: 999,
    padding: '12px 16px',
  },
  send: {
    background: '#0A84FF',
    border: 'none',
    color: '#fff',
    borderRadius: 999,
    padding: '0 18px',
    fontWeight: 700,
    cursor: 'pointer',
  },
};
