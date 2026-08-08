import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

const API =
  (import.meta as any).env?.VITE_API_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3000/api/v1';

function authHeaders() {
  const t = localStorage.getItem('movr_token') || localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
  };
}

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

/** In-ride chat (mockup). */
export default function RideChatPage() {
  const { id = 'active' } = useParams();
  const [driver, setDriver] = useState<any>({ name: 'Driver', online: true });
  const [messages, setMessages] = useState<any[]>([]);
  const [quick, setQuick] = useState<any[]>([]);
  const [banner, setBanner] = useState(
    'These messages are secure. Messages are encrypted and will be deleted after the ride ends.'
  );
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const load = () => {
    fetch(`${API}/rides/${id}/chat`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (j?.data) {
          setDriver(j.data.driver || { online: true });
          setMessages(j.data.messages || []);
          setQuick(j.data.quickReplies || []);
          if (j.data.privacyBanner) setBanner(j.data.privacyBanner);
        }
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (body: string) => {
    const trimmed = body.trim();
    if (!trimmed) return;
    setText('');
    setMessages((m) => [
      ...m,
      { id: `l-${Date.now()}`, body: trimmed, mine: true, status: 'sent', createdAt: new Date().toISOString() },
    ]);
    await fetch(`${API}/rides/${id}/chat`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ body: trimmed }),
    }).catch(() => undefined);
    load();
  };

  return (
    <div className="min-h-[70vh] max-w-xl mx-auto flex flex-col bg-white text-zinc-900">
      <div className="flex items-center gap-3 px-3 py-3 border-b border-black">
        <Link to={`/ride/active/${id}`} className="text-lg">
          ←
        </Link>
        <div className="w-9 h-9 rounded-full bg-zinc-200 flex items-center justify-center font-bold">
          {(driver.name || 'D')[0]}
        </div>
        <p className="flex-1 font-bold text-green-600 text-sm">
          {driver.online !== false ? '• Online - Driver' : '• Offline - Driver'}
        </p>
        <a href="tel:" className="text-xl">
          📞
        </a>
      </div>

      <div className="flex-1 overflow-y-auto bg-zinc-50 p-4 space-y-3">
        <div className="flex justify-center">
          <span className="rounded-full bg-zinc-700 text-white text-[11px] px-3 py-1 font-semibold">
            Today · 9:08 AM
          </span>
        </div>
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'} gap-2`}>
            {!m.mine ? (
              <div className="w-6 h-6 rounded-full bg-zinc-300 text-[10px] flex items-center justify-center self-end">
                D
              </div>
            ) : null}
            <div
              className={`max-w-[75%] rounded-2xl px-3 py-2 text-white text-sm ${
                m.mine ? 'bg-gradient-to-r from-purple-600 to-blue-500' : 'bg-black'
              }`}
            >
              <p>{m.body}</p>
              <p className="text-[10px] text-zinc-300 text-right mt-1">
                {fmtTime(m.createdAt)}
                {m.mine ? (m.status === 'read' ? ' ✓✓' : ' ✓') : ''}
              </p>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="flex gap-2 overflow-x-auto px-3 py-2">
        {(quick.length
          ? quick
          : [
              { label: '👍 OK', body: '👍 OK' },
              { label: 'I am ready', body: 'I am ready' },
              { label: 'Wait 2 mins', body: 'Wait 2 mins' },
            ]
        ).map((q: any) => (
          <button
            key={q.label}
            type="button"
            onClick={() => send(q.body)}
            className="rounded-full bg-black text-white text-sm font-semibold px-3 py-1.5 whitespace-nowrap"
          >
            {q.label}
          </button>
        ))}
      </div>

      <div className="mx-3 mb-2 rounded-xl bg-violet-100 px-3 py-2 flex gap-2 text-xs text-violet-800">
        <span>🔐</span>
        <p>{banner}</p>
      </div>

      <div className="flex gap-2 px-3 pb-4">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send(text)}
          placeholder="Type a message..."
          className="flex-1 rounded-full bg-black text-white px-4 py-3 outline-none text-sm"
        />
        <button
          type="button"
          onClick={() => send(text)}
          className="w-11 h-11 rounded-full bg-gradient-to-r from-purple-600 to-blue-500 text-white font-bold"
        >
          ↑
        </button>
      </div>
    </div>
  );
}
