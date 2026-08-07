import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Car,
  Heart,
  Package,
  KeyRound,
  Store,
  Users,
  Building2,
  Sparkles,
  ShieldCheck,
  Wallet,
  MapPin,
  CheckCircle2,
} from 'lucide-react';
import { StoreBadgeButton } from '../components/StoreBadges';
import { CmsMediaBackdrop } from './CmsMediaBackdrop';

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  car: Car,
  heart: Heart,
  package: Package,
  key: KeyRound,
  store: Store,
  users: Users,
  building: Building2,
  sparkles: Sparkles,
  shield: ShieldCheck,
  wallet: Wallet,
  map: MapPin,
  check: CheckCircle2,
};

function go(navigate: ReturnType<typeof useNavigate>, href?: string) {
  if (!href) return;
  if (href.startsWith('http')) {
    window.open(href, '_blank', 'noreferrer');
    return;
  }
  if (href.startsWith('/#') || href.startsWith('#')) {
    window.location.href = href.startsWith('#') ? `/${href}` : href;
    return;
  }
  navigate(href);
}

/** PerfectRide-style choice hero — eyebrow, large headline, two path cards. */
export function CmsChoiceHero({ payload }: { payload: any }) {
  const navigate = useNavigate();
  return (
    <section className="mkt-hero relative" data-force-dark>
      <CmsMediaBackdrop imageUrl={payload.backgroundImage} videoUrl={payload.backgroundVideo} />
      <div className="mkt-shell relative pt-16 sm:pt-24 pb-16 sm:pb-20">
        {payload.eyebrow ? <p className="mkt-eyebrow">{payload.eyebrow}</p> : null}
        <h1 className="mkt-display mt-5 max-w-4xl whitespace-pre-line">{payload.headline}</h1>
        {payload.subhead ? (
          <p className="mt-6 text-lg sm:text-xl text-white/60 max-w-2xl leading-relaxed">
            {payload.subhead}
          </p>
        ) : null}

        {payload.choices?.length ? (
          <div className="mt-12 grid sm:grid-cols-2 gap-4 max-w-3xl">
            {payload.choices.map((c: any) => (
              <button
                key={c.title}
                type="button"
                onClick={() => go(navigate, c.href)}
                className="mkt-choice text-left group overflow-hidden"
              >
                {c.imageUrl ? (
                  <img
                    src={c.imageUrl}
                    alt=""
                    className="w-full h-28 object-cover rounded-xl mb-4 opacity-90"
                  />
                ) : (
                  <span className="text-2xl mb-3 block" aria-hidden>
                    {c.emoji || '•'}
                  </span>
                )}
                <span className="block text-lg font-semibold text-white group-hover:text-white">
                  {c.title}
                </span>
                <span className="block mt-2 text-sm text-white/55 leading-relaxed">{c.body}</span>
                {c.cta ? (
                  <span className="inline-block mt-4 text-sm font-semibold text-motion-blue">
                    {c.cta} →
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}

        {(payload.primaryCta || payload.secondaryCta) && !payload.choices?.length ? (
          <div className="mt-10 flex flex-wrap gap-3">
            {payload.primaryCta ? (
              <button
                type="button"
                onClick={() => go(navigate, payload.primaryCta.href)}
                className="mkt-btn-primary"
              >
                {payload.primaryCta.label}
              </button>
            ) : null}
            {payload.secondaryCta ? (
              <button
                type="button"
                onClick={() => go(navigate, payload.secondaryCta.href)}
                className="mkt-btn-ghost"
              >
                {payload.secondaryCta.label}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function CmsTrustStrip({ payload }: { payload: any }) {
  const items = payload.items || payload.logos || [];
  if (!items.length) return null;
  return (
    <section className="border-y border-white/8 py-10">
      <div className="mkt-shell">
        {payload.label ? (
          <p className="text-center text-xs tracking-[0.14em] uppercase text-white/40 mb-6">
            {payload.label}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {items.map((item: any) => (
            <span
              key={typeof item === 'string' ? item : item.label}
              className="text-sm sm:text-base font-medium text-white/35"
            >
              {typeof item === 'string' ? item : item.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CmsHowItWorks({ payload }: { payload: any }) {
  return (
    <section className="mkt-section" id={payload.anchor || 'how'}>
      <div className="mkt-shell">
        {payload.eyebrow ? <p className="mkt-eyebrow">{payload.eyebrow}</p> : null}
        <h2 className="mkt-h2 mt-4 max-w-3xl">{payload.heading}</h2>
        <div className="mt-14 grid md:grid-cols-3 gap-10 md:gap-8">
          {(payload.steps || []).map((s: any, i: number) => (
            <div key={s.title || i} className="relative">
              <p className="text-sm font-semibold tracking-widest text-motion-blue mb-4">
                {s.number || String(i + 1).padStart(2, '0')}
              </p>
              <h3 className="text-xl font-semibold text-white">{s.title}</h3>
              <p className="mt-3 text-white/55 leading-relaxed">{s.body}</p>
              {s.imageUrl ? (
                <img
                  src={s.imageUrl}
                  alt=""
                  className="mt-5 w-full h-36 object-cover rounded-xl border border-white/10"
                />
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CmsProductGrid({ payload }: { payload: any }) {
  const navigate = useNavigate();
  return (
    <section className="mkt-section" id={payload.anchor || 'products'}>
      <div className="mkt-shell">
        {payload.eyebrow ? <p className="mkt-eyebrow">{payload.eyebrow}</p> : null}
        <h2 className="mkt-h2 mt-4 max-w-3xl">{payload.heading}</h2>
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(payload.items || []).map((c: any) => {
            const Icon = ICONS[c.iconKey] || Car;
            return (
              <button
                key={c.title}
                type="button"
                onClick={() => go(navigate, c.href)}
                className="mkt-product text-left"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 mb-5 overflow-hidden">
                  {c.imageUrl ? (
                    <img src={c.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Icon size={20} className="text-white" />
                  )}
                </span>
                <p className="text-xs tracking-[0.12em] uppercase text-white/40 mb-2">
                  {c.eyebrow || c.category}
                </p>
                <h3 className="text-lg font-semibold text-white">{c.title}</h3>
                <p className="mt-2 text-sm text-white/55 leading-relaxed">{c.body}</p>
                {c.cta ? (
                  <span className="inline-block mt-5 text-sm font-semibold text-motion-blue">
                    {c.cta} →
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function CmsWhyGrid({ payload }: { payload: any }) {
  return (
    <section className="mkt-section" id={payload.anchor || 'why'}>
      <div className="mkt-shell">
        {payload.eyebrow ? <p className="mkt-eyebrow">{payload.eyebrow}</p> : null}
        <h2 className="mkt-h2 mt-4 max-w-3xl">{payload.heading}</h2>
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {(payload.items || []).map((c: any) => {
            const Icon = ICONS[c.iconKey] || CheckCircle2;
            return (
              <div key={c.title} className="py-2">
                <Icon size={22} className="text-movr-green mb-4" />
                <h3 className="text-lg font-semibold text-white">{c.title}</h3>
                <p className="mt-2 text-sm text-white/55 leading-relaxed">{c.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function CmsTestimonials({ payload }: { payload: any }) {
  return (
    <section className="mkt-section" id={payload.anchor || 'stories'}>
      <div className="mkt-shell">
        {payload.eyebrow ? <p className="mkt-eyebrow">{payload.eyebrow}</p> : null}
        <h2 className="mkt-h2 mt-4 max-w-3xl">{payload.heading}</h2>
        <div className="mt-12 grid md:grid-cols-3 gap-6">
          {(payload.items || payload.quotes || []).map((q: any) => (
            <blockquote key={q.name || q.quote} className="mkt-quote">
              <p className="text-white/85 leading-relaxed text-base">“{q.quote || q.body}”</p>
              <footer className="mt-6 flex items-center gap-3">
                {q.avatarUrl || q.imageUrl ? (
                  <img
                    src={q.avatarUrl || q.imageUrl}
                    alt=""
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : null}
                <div>
                  <p className="font-semibold text-white">{q.name}</p>
                  <p className="text-sm text-white/45 mt-0.5">{q.role}</p>
                </div>
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CmsFinalCta({ payload }: { payload: any }) {
  const navigate = useNavigate();
  return (
    <section className="mkt-section pb-24">
      <div className="mkt-shell">
        <div className="mkt-final relative overflow-hidden">
          <CmsMediaBackdrop
            imageUrl={payload.backgroundImage}
            videoUrl={payload.backgroundVideo}
            className="rounded-[1.75rem]"
          />
          <div className="relative">
            <h2 className="mkt-h2 max-w-2xl">{payload.heading}</h2>
            {payload.body ? (
              <p className="mt-4 text-white/60 max-w-xl leading-relaxed">{payload.body}</p>
            ) : null}
            <div className="mt-8 flex flex-wrap gap-3">
              {payload.primaryCta ? (
                <button
                  type="button"
                  onClick={() => go(navigate, payload.primaryCta.href)}
                  className="mkt-btn-primary"
                >
                  {payload.primaryCta.label}
                </button>
              ) : null}
              {payload.secondaryCta ? (
                <button
                  type="button"
                  onClick={() => go(navigate, payload.secondaryCta.href)}
                  className="mkt-btn-ghost"
                >
                  {payload.secondaryCta.label}
                </button>
              ) : null}
            </div>
            {payload.note ? <p className="mt-5 text-sm text-white/40">{payload.note}</p> : null}
            {payload.storeButtons?.length ? (
              <div className="mt-8 flex flex-wrap gap-3">
                {payload.storeButtons.map((b: any) => (
                  <StoreBadgeButton
                    key={b.label}
                    label={b.label}
                    store={b.store}
                    href={b.href}
                    onClick={() => go(navigate, b.href)}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
