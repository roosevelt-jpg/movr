import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Car,
  Heart,
  Package,
  KeyRound,
  Play,
  Truck,
  BarChart3,
  CreditCard,
  Award,
  ShieldCheck,
} from 'lucide-react';
import { formatCurrency } from '../lib/currency';
import { useLocalCurrency } from '../hooks/useLocalCurrency';
import MovrWordmark from '../components/MovrWordmark';
import { StoreBadgeButton } from '../components/StoreBadges';
import type { CmsSection } from '../services/cms';
import {
  CmsChoiceHero,
  CmsTrustStrip,
  CmsHowItWorks,
  CmsProductGrid,
  CmsWhyGrid,
  CmsTestimonials,
  CmsFinalCta,
  CmsAiShowcase,
} from './marketing-sections';
import { CmsMediaBackdrop } from './CmsMediaBackdrop';

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  car: Car,
  heart: Heart,
  package: Package,
  key: KeyRound,
  truck: Truck,
  chart: BarChart3,
  card: CreditCard,
  award: Award,
  shield: ShieldCheck,
};

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto w-full max-w-[280px]">
      <div
        className="absolute -inset-10 rounded-full opacity-60 blur-3xl pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 50% 40%, rgba(0,85,255,0.55), rgba(106,0,255,0.25), transparent 70%)',
        }}
      />
      <div className="relative rounded-[2.4rem] border border-border bg-surface-elevated p-2.5 shadow-active-glow">
        <div className="rounded-[2rem] bg-jet-black overflow-hidden border border-border">
          <div className="flex justify-center pt-2">
            <div className="w-20 h-1.5 rounded-full bg-border" />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

function PhoneRideMock() {
  return (
    <PhoneFrame>
      <div className="flex justify-between text-[10px] px-5 pt-2 text-text-secondary">
        <span>9:41</span>
        <span>●●●</span>
      </div>
      <p className="text-center font-bold mt-1 mb-2 text-sm">Movr</p>
      <div className="flex justify-center gap-6 text-xs border-b border-border pb-2 px-2">
        <span className="text-pure-white border-b-2 border-motion-blue pb-2 font-medium">Ride</span>
        <span className="text-text-secondary">Shop</span>
        <span className="text-text-secondary">Deliver</span>
      </div>
      <div className="relative m-3 h-40 rounded-xl overflow-hidden bg-surface-elevated">
        <div
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
            backgroundSize: '18px 18px',
          }}
        />
        <div className="absolute left-[22%] top-[28%] w-2.5 h-2.5 rounded-full bg-motion-blue shadow-active-glow" />
        <div className="absolute right-[30%] bottom-[32%] w-2.5 h-2.5 rounded-full bg-white" />
      </div>
      <div className="px-3 space-y-2 pb-4">
        <div className="rounded-xl bg-surface-elevated h-9 flex items-center px-3 text-xs text-text-secondary">
          Pickup
        </div>
        <div className="rounded-xl bg-surface-elevated h-9 flex items-center px-3 text-xs text-text-secondary">
          Enter destination
        </div>
        <div className="rounded-full h-10 bg-movr-gradient flex items-center justify-center text-xs font-semibold">
          Confirm pickup
        </div>
      </div>
    </PhoneFrame>
  );
}

function go(navigate: ReturnType<typeof useNavigate>, href?: string) {
  if (!href) return;
  if (href.startsWith('http')) {
    window.open(href, '_blank', 'noreferrer');
    return;
  }
  if (href.startsWith('/#')) {
    window.location.href = href;
    return;
  }
  navigate(href);
}

export function CmsNav({ payload }: { payload: any }) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-40 bg-jet-black/80 backdrop-blur-md border-b border-border">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-xl font-bold tracking-tight"
          aria-label={payload.brand || 'MOVR'}
        >
          <MovrWordmark height={28} />
          <span className="sr-only">{payload.brand || 'MOVR'}</span>
        </button>
        <nav className="hidden lg:flex items-center gap-7 text-sm text-text-primary/90">
          {(payload.links || []).map((l: any) =>
            l.href?.startsWith('/#') || l.href?.startsWith('#') ? (
              <a key={l.label} href={l.href} className="hover:opacity-80">
                {l.label}
              </a>
            ) : (
              <button
                key={l.label}
                type="button"
                onClick={() => go(navigate, l.href)}
                className="hover:opacity-80"
              >
                {l.label}
              </button>
            )
          )}
        </nav>
        {payload.cta ? (
          <button
            type="button"
            onClick={() => go(navigate, payload.cta.href)}
            className="rounded-pill px-5 py-2.5 text-sm font-semibold bg-movr-gradient"
          >
            {payload.cta.label}
          </button>
        ) : null}
      </div>
    </header>
  );
}

export function CmsHero({ payload }: { payload: any }) {
  const navigate = useNavigate();

  /* New choice-card heroes use dedicated renderer via type, but support inline choices too */
  if (payload.choices?.length) {
    return <CmsChoiceHero payload={payload} />;
  }

  const centered = payload.layout === 'centered';

  if (centered) {
    return (
      <section className="mkt-hero relative">
        <CmsMediaBackdrop imageUrl={payload.backgroundImage} videoUrl={payload.backgroundVideo} />
        <div className="mkt-shell relative pt-20 sm:pt-28 pb-16 text-center">
          {payload.eyebrow ? <p className="mkt-eyebrow">{payload.eyebrow}</p> : null}
          <h1 className="mkt-display mt-5 mx-auto max-w-4xl">{payload.headline}</h1>
          {payload.subhead ? (
            <p className="mt-6 text-lg text-white/60 max-w-2xl mx-auto leading-relaxed whitespace-pre-line">
              {payload.subhead}
            </p>
          ) : null}
          {payload.primaryCta ? (
            <button
              type="button"
              onClick={() => go(navigate, payload.primaryCta.href)}
              className="mkt-btn-primary mt-10"
            >
              {payload.primaryCta.label}
            </button>
          ) : null}
          {payload.storeButtons?.length ? (
            <div className="relative mt-10 flex flex-wrap justify-center gap-4">
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
      </section>
    );
  }

  return (
    <section className="mkt-hero relative">
      <CmsMediaBackdrop imageUrl={payload.backgroundImage} videoUrl={payload.backgroundVideo} />
      <div className="mkt-shell relative pt-16 sm:pt-24 pb-20 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          {payload.eyebrow ? <p className="mkt-eyebrow mb-5">{payload.eyebrow}</p> : null}
          <h1 className="mkt-display">{payload.headline}</h1>
          {payload.subhead ? (
            <p className="mt-6 text-lg text-white/60 max-w-md leading-relaxed">{payload.subhead}</p>
          ) : null}
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
        </div>
        {payload.showPhoneMock !== false ? <PhoneRideMock /> : null}
      </div>
    </section>
  );
}

export function CmsFourWays({ payload }: { payload: any }) {
  return (
    <section id="ride" className="max-w-6xl mx-auto px-6 pb-20">
      <h2 className="text-2xl md:text-3xl font-bold mb-6">{payload.heading}</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {(payload.items || []).map((c: any) => {
          const Icon = ICONS[c.iconKey] || Car;
          return (
            <a
              key={c.title}
              href={c.anchor ? `#${c.anchor}` : undefined}
              id={c.anchor && c.anchor !== 'ride' ? c.anchor : undefined}
              className="rounded-2xl bg-surface-elevated border border-border p-5 hover:border-motion-blue/50 transition-colors block"
            >
              <Icon size={22} className="mb-4" />
              <h3 className="font-bold text-lg">{c.title}</h3>
              <p className="text-text-secondary text-sm mt-2 leading-relaxed">{c.body}</p>
            </a>
          );
        })}
      </div>
    </section>
  );
}

export function CmsStories({ payload }: { payload: any }) {
  const { currency } = useLocalCurrency();

  const statValue = (s: any) => {
    if (s.valueKey === 'avgMonthlySales' && s.amountsByCurrency) {
      const amount = s.amountsByCurrency[currency] ?? s.amountsByCurrency.GHS ?? 18000;
      return formatCurrency(amount, currency).replace(/\.00$/, '');
    }
    return s.value;
  };

  return (
    <section className="max-w-6xl mx-auto px-6 pb-20 space-y-6">
      <h2 className="text-2xl md:text-3xl font-bold">{payload.heading}</h2>
      {(payload.cards || []).map((card: any) => {
        const media = (
          <div className="relative min-h-[260px] md:min-h-full overflow-hidden bg-surface">
            {card.videoUrl ? (
              <video
                className="absolute inset-0 w-full h-full object-cover"
                src={card.videoUrl}
                autoPlay
                muted
                loop
                playsInline
              />
            ) : card.imageUrl ? (
              <img
                src={card.imageUrl}
                alt={card.title}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
            {!card.videoUrl ? (
              <button
                type="button"
                className="absolute inset-0 m-auto w-14 h-14 rounded-full bg-jet-black/45 border border-pure-white/35 flex items-center justify-center"
                aria-label="Play"
              >
                <Play size={22} fill="var(--pure-white)" />
              </button>
            ) : null}
          </div>
        );
        const text = (
          <div className="p-8 md:p-10 flex flex-col justify-center">
            <p className="text-xs tracking-wider text-text-secondary mb-2">{card.eyebrow}</p>
            <h3 className="text-2xl font-bold mb-3">{card.title}</h3>
            <p className="text-text-secondary leading-relaxed mb-5">{card.quote}</p>
            <div className="flex flex-wrap gap-8 text-sm">
              {(card.stats || []).map((s: any) => (
                <span key={s.label}>
                  <strong className="text-pure-white text-base">{statValue(s)}</strong>
                  <span className="text-text-secondary"> {s.label}</span>
                </span>
              ))}
            </div>
          </div>
        );
        const mediaLeft = card.mediaSide !== 'right';
        return (
          <div
            key={card.title}
            className="rounded-2xl bg-surface-elevated border border-border overflow-hidden grid md:grid-cols-2"
          >
            {mediaLeft ? (
              <>
                {media}
                {text}
              </>
            ) : (
              <>
                <div className="order-2 md:order-1">{text}</div>
                <div className="order-1 md:order-2">{media}</div>
              </>
            )}
          </div>
        );
      })}
    </section>
  );
}

export function CmsCtaBanner({ payload }: { payload: any }) {
  const navigate = useNavigate();
  return (
    <section id={payload.anchor || 'drivers'} className="mkt-section py-8 sm:py-10">
      <div className="mkt-shell">
        <div className="relative overflow-hidden rounded-[1.5rem] bg-movr-gradient p-8 md:p-10 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-active-glow">
          <CmsMediaBackdrop
            imageUrl={payload.backgroundImage}
            videoUrl={payload.backgroundVideo}
            className="rounded-[1.5rem] opacity-80"
          />
          <div className="relative max-w-2xl">
            {payload.headline ? (
              <p className="text-xl md:text-2xl font-bold leading-snug text-brand-white">
                {payload.headline}
              </p>
            ) : null}
            <p
              className={`${payload.headline ? 'mt-2 text-brand-white/85 text-sm md:text-base' : 'text-xl md:text-2xl font-bold'} leading-snug`}
            >
              {payload.body}
            </p>
          </div>
          {payload.button ? (
            <button
              type="button"
              onClick={() => go(navigate, payload.button.href)}
              className="relative shrink-0 rounded-full px-7 py-3.5 bg-brand-jet font-semibold text-brand-white"
            >
              {payload.button.label}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function CmsDownload({ payload }: { payload: any }) {
  const navigate = useNavigate();
  return (
    <section className="max-w-6xl mx-auto px-6 pb-24 grid lg:grid-cols-2 gap-12 items-center">
      <div>
        <h2 className="text-3xl md:text-4xl font-bold leading-tight">{payload.heading}</h2>
        {payload.body ? (
          <p className="text-text-secondary mt-4 max-w-md leading-relaxed">{payload.body}</p>
        ) : null}
        <div className="mt-8 flex flex-wrap gap-3">
          {(payload.storeButtons || []).map((b: any) => (
            <StoreBadgeButton
              key={b.label}
              label={b.label}
              store={b.store}
              href={b.href}
              onClick={() => go(navigate, b.href)}
            />
          ))}
        </div>
        {payload.qrHint ? (
          <div className="mt-8 flex items-center gap-4">
            <div className="w-24 h-24 rounded-lg bg-white p-2 shrink-0">
              <div
                className="w-full h-full opacity-80"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(90deg,var(--jet-black) 0 2px,transparent 2px 4px),repeating-linear-gradient(0deg,var(--jet-black) 0 2px,transparent 2px 4px)',
                }}
              />
            </div>
            <p className="text-sm text-text-secondary max-w-[160px]">{payload.qrHint}</p>
          </div>
        ) : null}
      </div>
      {payload.showPhoneMock !== false ? (
        <PhoneFrame>
          <div className="flex justify-between text-[10px] px-5 pt-2 text-text-secondary">
            <span>9:41</span>
            <span>●●●</span>
          </div>
          <p className="text-center font-bold mt-1 mb-2 text-sm">Movr</p>
          <div className="relative mx-3 h-52 rounded-xl overflow-hidden bg-surface-elevated mb-3">
            <div
              className="absolute inset-0 opacity-45"
              style={{
                backgroundImage:
                  'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
                backgroundSize: '16px 16px',
              }}
            />
          </div>
          <div className="px-3 pb-5">
            <div className="rounded-full h-11 bg-movr-gradient flex items-center justify-center text-sm font-semibold">
              Confirm pickup
            </div>
          </div>
        </PhoneFrame>
      ) : null}
    </section>
  );
}

export function CmsFeatureCards({ payload }: { payload: any }) {
  return (
    <section className="mkt-section pt-0">
      <div className="mkt-shell">
        <div className="grid md:grid-cols-3 gap-4">
          {(payload.items || []).map((c: any) => {
            const Icon = ICONS[c.iconKey] || Package;
            return (
              <div key={c.title} className="mkt-product">
                <Icon size={22} className="mb-4 text-white" />
                <h3 className="text-lg font-semibold text-white">{c.title}</h3>
                <p className="text-white/55 mt-2 text-sm leading-relaxed">{c.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function CmsHelpHub({ payload }: { payload: any }) {
  const navigate = useNavigate();
  const [q, setQ] = React.useState('');
  const articles = (payload.articles || []).filter((a: any) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return (
      a.title?.toLowerCase().includes(s) ||
      a.body?.toLowerCase().includes(s) ||
      (a.keywords || '').includes(s)
    );
  });

  return (
    <main className="max-w-5xl mx-auto px-6 py-16">
      <div className="max-w-xs mx-auto mb-10">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={payload.searchPlaceholder || 'Search'}
          className="w-full rounded-full bg-surface-elevated border border-border px-4 py-2.5 text-sm"
        />
      </div>
      <h1 className="text-4xl md:text-5xl font-bold text-center mb-12">{payload.heading}</h1>
      <div className="grid md:grid-cols-3 gap-4">
        {articles.map((c: any) => {
          const Icon = ICONS[c.iconKey] || Car;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => navigate(`/help/${c.id}`)}
              className="text-left rounded-2xl bg-surface-elevated border border-border p-6 hover:border-motion-blue"
            >
              <Icon size={22} className="mb-4" />
              <h2 className="font-bold text-lg">{c.title}</h2>
              <p className="text-text-secondary text-sm mt-2 leading-relaxed">{c.body}</p>
            </button>
          );
        })}
      </div>
    </main>
  );
}

export function CmsRichText({ payload }: { payload: any }) {
  const html = sanitizeCmsHtml(
    payload?.html ||
      (Array.isArray(payload?.paragraphs)
        ? payload.paragraphs.map((p: string) => `<p>${escapeText(p)}</p>`).join('')
        : '')
  );

  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      {payload?.heading ? (
        <h1 className="text-3xl md:text-4xl font-bold mb-8">{payload.heading}</h1>
      ) : null}
      {html ? (
        <div
          className="cms-rich-text space-y-4 text-text-secondary leading-relaxed prose prose-invert max-w-none [&_a]:text-motion-blue [&_a]:underline [&_strong]:text-pure-white [&_em]:italic"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : null}
    </main>
  );
}

function escapeText(s: string) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Allowlist-style sanitize for CMS rich text (no scripts/handlers). */
function sanitizeCmsHtml(raw: string) {
  if (!raw) return '';
  let html = String(raw);
  html = html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
  html = html.replace(/on\w+\s*=\s*(['"]).*?\1/gi, '');
  html = html.replace(/on\w+\s*=\s*[^\s>]+/gi, '');
  html = html.replace(/javascript:/gi, '');
  html = html.replace(/<\/?(iframe|object|embed|link|meta|form)[^>]*>/gi, '');
  return html;
}

export function CmsForm({ payload, pageSlug }: { payload: any; pageSlug?: string }) {
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [status, setStatus] = React.useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [error, setError] = React.useState('');
  const fields = Array.isArray(payload?.fields) ? payload.fields : [];
  const API =
    (import.meta as any).env?.VITE_API_URL ||
    process.env.REACT_APP_API_URL ||
    'http://localhost:3000/api/v1';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pageSlug) return;
    setStatus('saving');
    setError('');
    try {
      const res = await fetch(`${API}/public/cms/forms/${encodeURIComponent(pageSlug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formKey: payload?.formKey || 'default',
          payload: values,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Submit failed');
      setStatus('done');
      setValues({});
    } catch (err: any) {
      setStatus('error');
      setError(err.message || 'Submit failed');
    }
  };

  if (status === 'done') {
    return (
      <section className="max-w-xl mx-auto px-6 py-10">
        <p className="text-lg text-pure-white">
          {payload?.successMessage || 'Thanks — we received your message.'}
        </p>
      </section>
    );
  }

  return (
    <section className="max-w-xl mx-auto px-6 py-10">
      {payload?.heading ? <h2 className="text-2xl font-bold mb-6">{payload.heading}</h2> : null}
      <form onSubmit={submit} className="space-y-4">
        {fields.map((f: any) => (
          <label key={f.name} className="block">
            <span className="text-sm text-text-secondary">
              {f.label || f.name}
              {f.required ? ' *' : ''}
            </span>
            {f.type === 'textarea' ? (
              <textarea
                className="mt-2 w-full rounded-xl bg-surface-elevated border border-border px-4 py-3"
                rows={4}
                required={!!f.required}
                value={values[f.name] || ''}
                onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
              />
            ) : (
              <input
                type={f.type || 'text'}
                className="mt-2 w-full rounded-xl bg-surface-elevated border border-border px-4 py-3"
                required={!!f.required}
                value={values[f.name] || ''}
                onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
              />
            )}
          </label>
        ))}
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <button
          type="submit"
          disabled={status === 'saving'}
          className="rounded-full px-6 py-3 font-semibold bg-movr-gradient"
        >
          {status === 'saving' ? 'Sending…' : payload?.submitLabel || 'Submit'}
        </button>
      </form>
    </section>
  );
}

export function CmsLegal({ payload }: { payload: any }) {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl md:text-4xl font-bold">{payload.heading}</h1>
      {payload.updatedLabel ? (
        <p className="text-text-secondary mt-3 mb-10">{payload.updatedLabel}</p>
      ) : (
        <div className="mb-10" />
      )}
      <ol className="space-y-6 text-text-secondary leading-relaxed list-none">
        {(payload.clauses || []).map((c: any) => (
          <li key={c.title}>
            <span className="text-pure-white font-medium">{c.title}</span> — {c.body}
          </li>
        ))}
      </ol>
    </main>
  );
}

export function CmsOnboarding({ payload }: { payload: any }) {
  const navigate = useNavigate();
  const [i, setI] = React.useState(0);
  const slides = payload.slides || [];
  const slide = slides[i] || {};
  return (
    <div className="min-h-screen flex flex-col items-center justify-between px-6 py-12 text-center bg-black text-white">
      <div className="flex-1 flex flex-col items-center justify-center max-w-md">
        <div className="w-40 h-40 rounded-2xl bg-[#1a1a1a] flex items-center justify-center mb-10 text-5xl text-[#3B5CFF]">
          🚐
        </div>
        <h1 className="text-2xl md:text-3xl font-bold mb-3">{slide.title}</h1>
        <p className="text-white/55 max-w-md leading-relaxed">{slide.body}</p>
      </div>
      <div className="w-full max-w-md">
        <div className="flex gap-2 mb-8 justify-center items-center">
          {slides.map((_: any, idx: number) => (
            <button
              key={idx}
              type="button"
              onClick={() => setI(idx)}
              className={
                idx === i ? 'h-2 w-7 rounded-full bg-movr-gradient' : 'w-2 h-2 rounded-full bg-white/20'
              }
            />
          ))}
        </div>
        {i < slides.length - 1 ? (
          <button
            type="button"
            onClick={() => setI((x) => x + 1)}
            className="w-full rounded-full px-8 py-4 font-semibold bg-movr-gradient"
          >
            Next
          </button>
        ) : payload.cta ? (
          <button
            type="button"
            onClick={() => {
              localStorage.setItem('movr_onboarding_done', '1');
              go(navigate, payload.cta.href);
            }}
            className="w-full rounded-full px-8 py-4 font-semibold bg-movr-gradient"
          >
            {payload.cta.label}
          </button>
        ) : null}
      </div>
    </div>
  );
}

const RENDERERS: Record<string, React.FC<{ payload: any; pageSlug?: string }>> = {
  hero: CmsHero,
  choice_hero: CmsChoiceHero,
  trust_strip: CmsTrustStrip,
  how_it_works: CmsHowItWorks,
  ai_showcase: CmsAiShowcase,
  product_grid: CmsProductGrid,
  why_grid: CmsWhyGrid,
  testimonials: CmsTestimonials,
  final_cta: CmsFinalCta,
  four_ways: CmsFourWays,
  stories: CmsStories,
  cta_banner: CmsCtaBanner,
  download: CmsDownload,
  feature_cards: CmsFeatureCards,
  help_hub: CmsHelpHub,
  rich_text: CmsRichText,
  form: CmsForm,
  legal: CmsLegal,
  onboarding_slides: CmsOnboarding,
};

export function CmsSectionView({
  section,
  pageSlug,
}: {
  section: CmsSection;
  pageSlug?: string;
}) {
  const Comp = RENDERERS[section.type];
  if (!Comp || section.enabled === false) return null;
  return <Comp payload={section.payload || {}} pageSlug={pageSlug} />;
}

export function CmsSections({
  sections,
  pageSlug,
}: {
  sections?: CmsSection[];
  pageSlug?: string;
}) {
  if (!sections?.length) return null;
  return (
    <>
      {sections
        .filter((s) => s.type !== 'nav' && s.type !== 'footer')
        .map((s) => (
          <CmsSectionView
            key={s.id || `${s.type}-${s.sortOrder}`}
            section={s}
            pageSlug={pageSlug}
          />
        ))}
    </>
  );
}
