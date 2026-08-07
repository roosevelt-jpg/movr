import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL || '/api/v1';

type Slide = { title: string; body: string; icon_key?: string };

const FALLBACK: Slide[] = [
  {
    title: 'Ride, shop, and deliver — all in one app',
    body: 'Book a ride, order from local stores, or send a parcel, all from the same place.',
    icon_key: 'van',
  },
  {
    title: 'Pay with wallet, MoMo, or card',
    body: 'Top up once and use Movr across rides, orders, and deliveries.',
    icon_key: 'wallet',
  },
  {
    title: 'Earn points on every trip',
    body: 'Redeem rewards or convert points when DVT launches.',
    icon_key: 'points',
  },
];

/** Onboarding carousel — live from /public/onboarding. */
export default function OnboardingIntroPage() {
  const navigate = useNavigate();
  const [slides, setSlides] = useState<Slide[]>(FALLBACK);
  const [i, setI] = useState(0);

  useEffect(() => {
    fetch(`${API}/public/onboarding`)
      .then((r) => r.json())
      .then((body) => {
        if (Array.isArray(body?.data) && body.data.length) setSlides(body.data);
      })
      .catch(() => undefined);
  }, []);

  const slide = slides[i] || FALLBACK[0];
  const last = i >= slides.length - 1;

  return (
    <div className="min-h-screen bg-black text-white font-[Poppins,Montserrat,sans-serif] flex flex-col items-center justify-between px-6 py-12">
      <div className="flex-1 flex flex-col items-center justify-center text-center max-w-md w-full">
        <div className="w-40 h-40 rounded-2xl bg-[#1a1a1a] flex items-center justify-center mb-10">
          <span className="text-5xl" style={{ color: '#3B5CFF' }}>
            {slide.icon_key === 'wallet' ? '💳' : slide.icon_key === 'points' ? '✦' : '🚐'}
          </span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight leading-snug">{slide.title}</h1>
        <p className="mt-4 text-white/55 leading-relaxed">{slide.body}</p>
      </div>

      <div className="w-full max-w-md">
        <div className="flex justify-center gap-2 mb-8">
          {slides.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setI(idx)}
              className={
                idx === i
                  ? 'h-2 w-7 rounded-full'
                  : 'h-2 w-2 rounded-full bg-white/20'
              }
              style={
                idx === i
                  ? { background: 'linear-gradient(90deg, #6B21A8 0%, #3B5CFF 100%)' }
                  : undefined
              }
              aria-label={`Slide ${idx + 1}`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            if (!last) {
              setI((x) => x + 1);
              return;
            }
            localStorage.setItem('movr_onboarding_done', '1');
            navigate('/register');
          }}
          className="w-full rounded-full py-4 font-semibold text-white"
          style={{
            background: 'linear-gradient(90deg, #0F766E 0%, #6B21A8 45%, #3B5CFF 100%)',
          }}
        >
          {last ? 'Get started' : 'Next'}
        </button>
      </div>
    </div>
  );
}
