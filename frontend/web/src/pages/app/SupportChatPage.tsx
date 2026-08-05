import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API =
  (import.meta as any).env?.VITE_API_URL ||
  process.env.REACT_APP_API_URL ||
  'http://localhost:3000/api/v1';

type Msg = { id: string; from: 'user' | 'support'; text: string };

/** Web Movr Support chat. */
export default function SupportChatPage() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const seq = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);

  const send = async () => {
    const t = input.trim();
    if (!t) return;
    setInput('');
    setMessages((m) => [...m, { id: String(seq.current++), from: 'user', text: t }]);
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
      await fetch(`${API}/inbox/support`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: t }),
      });
    } catch {
      /* network */
    }
    setTimeout(() => {
      setMessages((m) => [
        ...m,
        {
          id: String(seq.current++),
          from: 'support',
          text: 'Thanks — a specialist is reviewing this. We typically reply in 2 min.',
        },
      ]);
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 500);
  };

  return (
    <div className="min-h-[70vh] bg-black text-white flex flex-col max-w-lg mx-auto font-[Poppins,Montserrat,sans-serif]">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#2A2A2A]">
        <button type="button" onClick={() => navigate('/help')} className="text-[#888]">
          ←
        </button>
        <div className="w-10 h-10 rounded-full bg-[#2A6B45] flex items-center justify-center font-bold">
          ?
        </div>
        <div>
          <p className="font-semibold">Movr Support</p>
          <p className="text-xs text-[#7CFC9A]">Typically replies in 2 min</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <p className="text-[#A0A0A0] text-sm text-center py-8">
            Send a message to start a conversation with support.
          </p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.from === 'user'
                  ? 'ml-auto bg-gradient-to-r from-[#6A00FF] to-[#0055FF]'
                  : 'bg-[#1A1A1A]'
              }`}
            >
              {m.text}
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      <div className="p-3 border-t border-[#2A2A2A]">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Type a message..."
          className="w-full rounded-full bg-[#1A1A1A] px-5 py-3 text-white outline-none placeholder:text-[#666]"
        />
      </div>
    </div>
  );
}
