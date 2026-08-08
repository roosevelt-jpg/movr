import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL || '/api/v1';

/** Offline page — Available Offline + Retry / Settings (mockup). */
export default function NoConnectionPage() {
  const navigate = useNavigate();
  const [copy, setCopy] = useState({
    title: 'No connection',
    body: 'Please check your internet connection and try again. Your data is safe.',
    cta_label: 'Retry Connection',
    secondaryCta: 'Go to Settings',
  });
  const [features, setFeatures] = useState([
    { id: 'history', label: 'View recent trip history', icon: '📋' },
    { id: 'wallet', label: 'View wallet balance', icon: '💳' },
    { id: 'sos', label: 'Access SOS contacts', icon: '🆘' },
  ]);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    fetch(`${API}/public/status-copy/no_connection`)
      .then((r) => r.json())
      .then((body) => {
        if (body?.data?.title) {
          setCopy((c) => ({
            ...c,
            ...body.data,
            secondaryCta: body.data.meta?.secondaryCta || c.secondaryCta,
          }));
        }
      })
      .catch(() => undefined);
    fetch(`${API}/public/offline-capabilities`)
      .then((r) => r.json())
      .then((j) => {
        if (Array.isArray(j?.data) && j.data.length) {
          setFeatures(
            j.data.map((f: any) => ({
              id: f.id,
              label: f.label,
              icon: f.icon_key === 'wallet' ? '💳' : f.icon_key === 'sos' ? '🆘' : '📋',
            }))
          );
        }
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
    <div className="min-h-[70vh] bg-black text-white flex flex-col items-center justify-center px-6 py-16" data-force-dark>
      <div className="relative w-24 h-24 rounded-full bg-zinc-900 flex items-center justify-center text-5xl mb-6">
        📡
        <span className="absolute right-2 bottom-2 w-6 h-6 rounded-full bg-red-500 text-xs font-bold flex items-center justify-center">
          ✕
        </span>
      </div>
      <h1 className="text-3xl font-extrabold text-center">{copy.title}</h1>
      <p className="text-zinc-400 text-center mt-3 mb-8 max-w-sm leading-relaxed">{copy.body}</p>

      <div className="w-full max-w-md rounded-2xl bg-zinc-900 p-4 mb-6">
        <p className="text-[11px] tracking-wider text-zinc-500 font-bold mb-2">AVAILABLE OFFLINE</p>
        {features.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => {
              if (f.id === 'history') navigate('/history');
              if (f.id === 'wallet') navigate('/wallet');
              if (f.id === 'sos') navigate('/safety');
            }}
            className="w-full flex items-center gap-3 py-2.5 text-left"
          >
            <span>{f.icon}</span>
            <span className="flex-1 font-semibold">{f.label}</span>
            <span className="text-green-500 font-extrabold">✓</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={retry}
        disabled={checking}
        className="w-full max-w-md rounded-2xl py-4 font-extrabold bg-indigo-500 mb-3 disabled:opacity-60"
      >
        {checking ? 'Checking…' : copy.cta_label}
      </button>
      <button
        type="button"
        onClick={() => {
          // Browser cannot open OS settings; send users to help.
          window.open('https://support.google.com/chrome/answer/95617', '_blank');
        }}
        className="w-full max-w-md rounded-2xl py-4 font-bold border border-zinc-700 text-zinc-300"
      >
        {copy.secondaryCta || 'Go to Settings'}
      </button>
    </div>
  );
}
