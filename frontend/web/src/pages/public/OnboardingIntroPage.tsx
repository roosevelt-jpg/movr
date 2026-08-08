import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL || '/api/v1';

type Landing = {
  brand: string;
  tagline: string;
  headline: string;
  body: string;
  ctaPrimary: string;
  ctaSecondary: string;
  chips: { label: string; icon: string }[];
};

const FALLBACK: Landing = {
  brand: 'Movr',
  tagline: 'MOVE · SHOP · DELIVER',
  headline: "Africa's Super-App Is Here",
  body: 'One platform for rides, shopping, deliveries, and rentals — powered by blockchain rewards.',
  ctaPrimary: 'Get Started',
  ctaSecondary: 'Already have an account? Sign in',
  chips: [
    { label: 'Ride', icon: '🚗' },
    { label: 'Shop', icon: '🛍️' },
    { label: 'Deliver', icon: '📦' },
  ],
};

/** Onboarding landing — brand hero matching mobile mockup. */
export default function OnboardingIntroPage() {
  const navigate = useNavigate();
  const [landing, setLanding] = useState<Landing>(FALLBACK);

  useEffect(() => {
    fetch(`${API}/public/onboarding`)
      .then((r) => r.json())
      .then((body) => {
        if (body?.landing) {
          const L = body.landing;
          setLanding({
            ...FALLBACK,
            ...L,
            chips: (L.chips || FALLBACK.chips).map((c: any, i: number) => ({
              label: c.label,
              icon: FALLBACK.chips[i]?.icon || '✨',
            })),
          });
        }
      })
      .catch(() => undefined);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white font-[Poppins,Montserrat,sans-serif] flex flex-col items-center justify-between px-6 py-12 relative overflow-hidden">
      <div
        className="absolute top-0 inset-x-0 h-[3px]"
        style={{ background: 'linear-gradient(90deg, #8E2DE2, #3B5CFF)' }}
      />
      <div className="absolute top-24 w-64 h-64 rounded-full bg-[#8E2DE2]/20 blur-3xl pointer-events-none" />

      <div className="flex-1 flex flex-col items-center justify-center text-center max-w-md w-full relative z-10">
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight drop-shadow-[0_0_40px_rgba(142,45,226,0.5)]">
          {landing.brand}
        </h1>
        <p className="mt-3 text-xs tracking-[0.3em] text-white/50 font-medium">{landing.tagline}</p>

        <div className="flex flex-wrap justify-center gap-2 mt-8 mb-10">
          {landing.chips.map((c) => (
            <span
              key={c.label}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3.5 py-1.5 text-sm font-semibold"
            >
              <span>{c.icon}</span>
              {c.label}
            </span>
          ))}
        </div>

        <h2 className="text-2xl md:text-3xl font-extrabold leading-snug">{landing.headline}</h2>
        <p className="mt-4 text-white/55 leading-relaxed">{landing.body}</p>
      </div>

      <div className="w-full max-w-md relative z-10 space-y-4">
        <button
          type="button"
          onClick={() => {
            localStorage.setItem('movr_onboarding_done', '1');
            navigate('/phone');
          }}
          className="w-full rounded-2xl py-4 font-bold text-white text-lg"
          style={{ background: 'linear-gradient(90deg, #8E2DE2 0%, #3B5CFF 100%)' }}
        >
          {landing.ctaPrimary}
        </button>
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="w-full text-center text-sm text-white/55"
        >
          Already have an account? <span className="text-white font-semibold">Sign in</span>
        </button>
      </div>
    </div>
  );
}
