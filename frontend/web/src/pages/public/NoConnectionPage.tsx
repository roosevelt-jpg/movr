import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WifiOff } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '/api/v1';

/** Offline page — matches “No connection” mockup; Retry probes /health. */
export default function NoConnectionPage() {
  const navigate = useNavigate();
  const [copy, setCopy] = useState({
    title: 'No connection',
    body: 'Check your internet connection and try again. You can still book by SMS or a call.',
    cta_label: 'Retry',
  });
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    fetch(`${API}/public/status-copy/no_connection`)
      .then((r) => r.json())
      .then((body) => {
        if (body?.data?.title) setCopy(body.data);
      })
      .catch(() => undefined);
  }, []);

  const retry = useCallback(async () => {
    setChecking(true);
    try {
      const base = String(API).replace(/\/api\/v1\/?$/, '');
      const res = await fetch(`${base}/health`);
      if (res.ok && navigator.onLine !== false) {
        navigate(-1);
        return;
      }
    } catch {
      /* still offline */
    } finally {
      setChecking(false);
    }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-black text-white font-[Poppins,Montserrat,sans-serif] flex flex-col items-center justify-center px-6 text-center">
      <div
        className="w-24 h-24 rounded-full flex items-center justify-center mb-6"
        style={{ background: 'rgba(120, 40, 40, 0.45)' }}
      >
        <WifiOff size={40} strokeWidth={1.75} style={{ color: '#e8a0a0' }} />
      </div>
      <h1 className="text-3xl font-bold tracking-tight">{copy.title}</h1>
      <p className="mt-4 text-white/55 max-w-sm leading-relaxed">{copy.body}</p>
      <button
        type="button"
        onClick={retry}
        disabled={checking}
        className="mt-8 rounded-full bg-[#2a2a2a] hover:bg-[#333] px-10 py-3.5 font-semibold min-w-[140px]"
      >
        {checking ? 'Checking…' : copy.cta_label || 'Retry'}
      </button>
    </div>
  );
}
