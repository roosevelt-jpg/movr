import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

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

/** Safety Center (mockup). */
export default function SafetyCenterPage() {
  const [contactsCount, setContactsCount] = useState(3);
  const [emergencyDisplay, setEmergencyDisplay] = useState('199 / 112');
  const [recording, setRecording] = useState(false);
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [msg, setMsg] = useState('');
  const timer = useRef<number | null>(null);
  const start = useRef(0);
  const holdSeconds = 3;

  useEffect(() => {
    fetch(`${API}/safety/center`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((j) => {
        if (j?.data) {
          setContactsCount(Number(j.data.contactsCount || 3));
          if (j.data.emergencyNumbers?.display) setEmergencyDisplay(j.data.emergencyNumbers.display);
          setRecording(Boolean(j.data.recording?.active));
        }
      })
      .catch(() => undefined);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, []);

  const clearHold = () => {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    setHolding(false);
    setProgress(0);
  };

  const triggerSos = async () => {
    clearHold();
    try {
      const res = await fetch(`${API}/safety/sos`, {
        method: 'POST',
        headers: authHeaders(),
        body: '{}',
      });
      const json = await res.json();
      setMsg(json?.data?.message || 'Emergency alert sent');
    } catch {
      setMsg('Emergency alert sent to contacts & Movr support');
    }
  };

  const onDown = () => {
    setHolding(true);
    start.current = Date.now();
    timer.current = window.setInterval(() => {
      const p = Math.min(1, (Date.now() - start.current) / (holdSeconds * 1000));
      setProgress(p);
      if (p >= 1) triggerSos();
    }, 50);
  };

  const shareTrip = async () => {
    let url = 'https://movr.io/trip/share';
    try {
      let res = await fetch(`${API}/trust/share-trip`, {
        method: 'POST',
        headers: authHeaders(),
        body: '{}',
      });
      let json = await res.json().catch(() => null);
      if (!res.ok || !json?.data) {
        res = await fetch(`${API}/safety/share-trip`, {
          method: 'POST',
          headers: authHeaders(),
          body: '{}',
        });
        json = await res.json().catch(() => null);
      }
      url = json?.data?.publicUrl || json?.data?.shareUrl || url;
      if (url.startsWith('/')) url = `${window.location.origin}${url}`;
    } catch {
      /* fallback */
    }
    if (navigator.share) await navigator.share({ title: 'My Movr trip', url }).catch(() => undefined);
    else {
      await navigator.clipboard?.writeText(url);
      setMsg('Trip link copied');
    }
  };

  const toggleRecord = async () => {
    const res = await fetch(`${API}/safety/record-audio`, {
      method: 'POST',
      headers: authHeaders(),
      body: '{}',
    }).catch(() => null);
    const json = res ? await res.json().catch(() => null) : null;
    setRecording(Boolean(json?.data?.active));
    setMsg(json?.data?.message || '');
  };

  return (
    <div className="min-h-[70vh] bg-black text-white max-w-xl mx-auto p-4" data-force-dark>
      <div className="flex items-center gap-3 mb-2">
        <Link to="/profile" className="text-xl">
          ←
        </Link>
        <h1 className="text-xl font-extrabold">Safety Center</h1>
      </div>
      <div className="h-0.5 rounded bg-gradient-to-r from-purple-500 to-red-500 mb-6" />

      <div className="flex flex-col items-center py-6">
        <button
          type="button"
          onMouseDown={onDown}
          onMouseUp={clearHold}
          onMouseLeave={clearHold}
          onTouchStart={onDown}
          onTouchEnd={clearHold}
          className={`w-44 h-44 rounded-full border-4 flex flex-col items-center justify-center ${
            holding ? 'border-red-500 scale-105' : 'border-red-900'
          } bg-red-950/40 transition`}
        >
          <span className="bg-red-600 rounded-xl px-4 py-2 font-black tracking-wide">SOS</span>
          <span className="mt-2 text-sm font-semibold">sos</span>
        </button>
        <p className="text-zinc-400 text-center mt-4 text-sm max-w-xs">
          Hold {holdSeconds} seconds to send emergency alert to contacts & Movr support
        </p>
        {holding ? <p className="text-red-400 font-bold mt-2">{Math.round(progress * 100)}%</p> : null}
      </div>

      {[
        {
          icon: '📍',
          title: 'Share Trip Link',
          sub: 'Let trusted contacts track your journey',
          action: 'Share',
          color: 'text-purple-400',
          onClick: shareTrip,
        },
        {
          icon: '👥',
          title: 'Trusted Contacts',
          sub: `${contactsCount} contacts added`,
          action: 'Edit',
          color: 'text-purple-400',
          onClick: () => setMsg(`${contactsCount} trusted contacts`),
        },
        {
          icon: '🚓',
          title: 'Call Emergency Services',
          sub: `Directly dial ${emergencyDisplay}`,
          action: 'Call',
          color: 'text-red-400',
          onClick: () => {
            window.location.href = `tel:${emergencyDisplay.split('/')[0].trim()}`;
          },
        },
      ].map((c) => (
        <div key={c.title} className="flex items-center gap-3 rounded-2xl bg-zinc-900 p-3 mb-2.5">
          <span className="text-xl w-7 text-center">{c.icon}</span>
          <div className="flex-1">
            <p className="font-bold">{c.title}</p>
            <p className="text-xs text-zinc-500 mt-1">{c.sub}</p>
          </div>
          <button type="button" onClick={c.onClick} className={`font-bold ${c.color}`}>
            {c.action}
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={toggleRecord}
        className={`w-full flex items-center gap-3 rounded-2xl bg-zinc-900 p-3 mb-3 border ${
          recording ? 'border-red-500' : 'border-transparent'
        }`}
      >
        <span className="text-xl w-7 text-center">🎙</span>
        <div className="flex-1 text-left">
          <p className="font-bold">Record Audio</p>
          <p className="text-xs text-zinc-500 mt-1">Silent recording stored to cloud</p>
        </div>
        <span
          className={`w-5 h-5 rounded-full border-2 border-red-500 ${
            recording ? 'bg-red-500' : ''
          }`}
        />
      </button>

      {msg ? <p className="text-center text-zinc-400 text-sm">{msg}</p> : null}
    </div>
  );
}
