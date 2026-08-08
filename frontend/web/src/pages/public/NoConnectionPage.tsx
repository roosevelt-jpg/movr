import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCmsPage } from '../../services/cms';
import { CmsUnavailable } from '../../cms/CmsUnavailable';

const API = import.meta.env.VITE_API_URL || '/api/v1';

/** Offline page — CMS slug `no-connection` + live offline capabilities API. */
export default function NoConnectionPage() {
  const navigate = useNavigate();
  const { page, loading: cmsLoading, error: cmsError } = useCmsPage('no-connection');
  const [features, setFeatures] = useState<{ id: string; label: string; icon: string }[]>([]);
  const [checking, setChecking] = useState(false);

  const hero = page?.sections?.find((s) => s.type === 'hero' || s.type === 'choice_hero');
  const title = hero?.payload?.headline || page?.title || 'No connection';
  const body =
    hero?.payload?.subhead ||
    'Please check your internet connection and try again.';
  const ctaLabel = hero?.payload?.primaryCta?.label || 'Retry Connection';
  const secondaryCta = hero?.payload?.secondaryCta?.label || 'Go to Settings';

  useEffect(() => {
    fetch(`${API}/public/offline-capabilities`)
      .then((r) => r.json())
      .then((j) => {
        if (Array.isArray(j?.data) && j.data.length) {
          setFeatures(
            j.data.map((f: any) => ({
              id: String(f.id),
              label: String(f.label || ''),
              icon: f.icon_key === 'wallet' ? '💳' : f.icon_key === 'sos' ? '🆘' : '📋',
            }))
          );
        } else {
          setFeatures([]);
        }
      })
      .catch(() => setFeatures([]));
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

  if (cmsLoading) {
    return (
      <div className="min-h-[70vh] bg-black text-white flex items-center justify-center">Loading…</div>
    );
  }

  if (cmsError || !page?.sections?.length) {
    return (
      <div className="min-h-screen bg-surface">
        <CmsUnavailable title="Offline page unpublished" />
      </div>
    );
  }

  return (
    <div
      className="min-h-[70vh] bg-black text-white flex flex-col items-center justify-center px-6 py-16"
      data-force-dark
    >
      <div className="relative w-24 h-24 rounded-full bg-zinc-900 flex items-center justify-center text-5xl mb-6">
        📡
        <span className="absolute right-2 bottom-2 w-6 h-6 rounded-full bg-red-500 text-xs font-bold flex items-center justify-center">
          ✕
        </span>
      </div>
      <h1 className="text-3xl font-extrabold text-center">{title}</h1>
      <p className="text-zinc-400 text-center mt-3 mb-8 max-w-sm leading-relaxed">{body}</p>

      {features.length ? (
        <div className="w-full max-w-md rounded-2xl bg-zinc-900 p-4 mb-6">
          <p className="text-[11px] tracking-wider text-zinc-500 font-bold mb-2">AVAILABLE OFFLINE</p>
          {features.map((f) => (
            <div key={f.id} className="flex items-center gap-3 py-2.5 border-b border-zinc-800 last:border-0">
              <span>{f.icon}</span>
              <span className="text-sm">{f.label}</span>
            </div>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        onClick={retry}
        disabled={checking}
        className="w-full max-w-md rounded-2xl py-3.5 font-extrabold bg-movr-gradient disabled:opacity-60"
      >
        {checking ? 'Checking…' : ctaLabel}
      </button>
      <button
        type="button"
        onClick={() => navigate('/settings')}
        className="mt-3 text-sm text-zinc-400 font-semibold"
      >
        {secondaryCta}
      </button>
    </div>
  );
}
