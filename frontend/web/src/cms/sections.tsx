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
  Download,
} from 'lucide-react';
import { formatCurrency } from '../lib/currency';
import { useLocalCurrency } from '../hooks/useLocalCurrency';
import type { CmsSection } from '../services/cms';

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  car: Car,
  heart: Heart,
  package: Package,
  key: KeyRound,
  truck: Truck,
  chart: BarChart3,
  card: CreditCard,
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
      <div className="relative rounded-[2.4rem] border border-[#2A2A2A] bg-[#111] p-2.5 shadow-[0_30px_80px_rgba(0,85,255,0.25)]">
        <div className="rounded-[2rem] bg-black overflow-hidden border border-[#1A1A1A]">
          <div className="flex justify-center pt-2">
            <div className="w-20 h-1.5 rounded-full bg-[#2A2A2A]" />
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
      <div className="flex justify-between text-[10px] px-5 pt-2 text-[#A0A0A0]">
        <span>9:41</span>
        <span>●●●</span>
      </div>
      <p className="text-center font-bold mt-1 mb-2 text-sm">Movr</p>
      <div className="flex justify-center gap-6 text-xs border-b border-[#2A2A2A] pb-2 px-2">
        <span className="text-white border-b-2 border-[#0055FF] pb-2 font-medium">Ride</span>
        <span className="text-[#666]">Shop</span>
        <span className="text-[#666]">Deliver</span>
      </div>
      <div className="relative m-3 h-40 rounded-xl overflow-hidden bg-[#141414]">
        <div
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              'linear-gradient(#222 1px, transparent 1px), linear-gradient(90deg, #222 1px, transparent 1px)',
            backgroundSize: '18px 18px',
          }}
        />
        <div className="absolute left-[22%] top-[28%] w-2.5 h-2.5 rounded-full bg-[#0055FF] shadow-[0_0_12px_#0055FF]" />
        <div className="absolute right-[30%] bottom-[32%] w-2.5 h-2.5 rounded-full bg-white" />
      </div>
      <div className="px-3 space-y-2 pb-4">
        <div className="rounded-xl bg-[#1A1A1A] h-9 flex items-center px-3 text-xs text-[#888]">
          Pickup · Current location
        </div>
        <div className="rounded-xl bg-[#1A1A1A] h-9 flex items-center px-3 text-xs text-[#666]">
          Enter destination
        </div>
        <div className="rounded-full h-10 bg-gradient-to-r from-[#6A00FF] to-[#0055FF] flex items-center justify-center text-xs font-semibold">
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
    <header className="sticky top-0 z-40 bg-black/80 backdrop-blur-md border-b border-white/10">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
        <button type="button" onClick={() => navigate('/')} className="text-xl font-bold tracking-tight">
          {payload.brand || 'Movr'}
        </button>
        <nav className="hidden lg:flex items-center gap-7 text-sm text-white/90">
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
            className="rounded-full px-5 py-2.5 text-sm font-semibold bg-gradient-to-r from-[#6A00FF] to-[#0055FF]"
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
  const centered = payload.layout === 'centered';

  if (centered) {
    return (
      <section className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight">
          {payload.headline}
        </h1>
        {payload.subhead ? (
          <p className="mt-5 text-[#A0A0A0] text-lg max-w-2xl mx-auto">{payload.subhead}</p>
        ) : null}
        {payload.primaryCta ? (
          <button
            type="button"
            onClick={() => go(navigate, payload.primaryCta.href)}
            className="mt-8 rounded-full px-8 py-3.5 font-semibold bg-gradient-to-r from-[#6A00FF] to-[#0055FF]"
          >
            {payload.primaryCta.label}
          </button>
        ) : null}
        {payload.storeButtons?.length ? (
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            {payload.storeButtons.map((b: any) => (
              <button
                key={b.label}
                type="button"
                onClick={() => go(navigate, b.href)}
                className="inline-flex items-center gap-3 rounded-2xl bg-[#1A1A1A] border border-[#2A2A2A] px-6 py-4 font-semibold"
              >
                <Download size={18} /> {b.label}
              </button>
            ))}
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 75% 45%, rgba(0,85,255,0.35), transparent 60%)',
        }}
      />
      <div className="relative max-w-6xl mx-auto px-6 pt-16 pb-20 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-[1.05]">
            {payload.headline}
          </h1>
          {payload.subhead ? (
            <p className="mt-5 text-[#A0A0A0] text-lg max-w-md leading-relaxed">{payload.subhead}</p>
          ) : null}
          <div className="mt-8 flex flex-wrap gap-3">
            {payload.primaryCta ? (
              <button
                type="button"
                onClick={() => go(navigate, payload.primaryCta.href)}
                className="rounded-full px-7 py-3.5 font-semibold bg-gradient-to-r from-[#6A00FF] to-[#0055FF] shadow-[0_10px_40px_rgba(106,0,255,0.35)]"
              >
                {payload.primaryCta.label}
              </button>
            ) : null}
            {payload.secondaryCta ? (
              <button
                type="button"
                onClick={() => go(navigate, payload.secondaryCta.href)}
                className="rounded-full px-7 py-3.5 font-semibold border border-white/70 hover:bg-white/5"
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
              className="rounded-2xl bg-[#121212] border border-[#2A2A2A] p-5 hover:border-[#0055FF]/50 transition-colors block"
            >
              <Icon size={22} className="mb-4" />
              <h3 className="font-bold text-lg">{c.title}</h3>
              <p className="text-[#A0A0A0] text-sm mt-2 leading-relaxed">{c.body}</p>
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
          <div className="relative min-h-[260px] md:min-h-full overflow-hidden bg-[#0A0A0A]">
            {card.imageUrl ? (
              <img
                src={card.imageUrl}
                alt={card.title}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
            <button
              type="button"
              className="absolute inset-0 m-auto w-14 h-14 rounded-full bg-black/45 border border-white/35 flex items-center justify-center"
              aria-label="Play"
            >
              <Play size={22} fill="#fff" />
            </button>
          </div>
        );
        const text = (
          <div className="p-8 md:p-10 flex flex-col justify-center">
            <p className="text-xs tracking-wider text-[#8E8E93] mb-2">{card.eyebrow}</p>
            <h3 className="text-2xl font-bold mb-3">{card.title}</h3>
            <p className="text-[#A0A0A0] leading-relaxed mb-5">{card.quote}</p>
            <div className="flex flex-wrap gap-8 text-sm">
              {(card.stats || []).map((s: any) => (
                <span key={s.label}>
                  <strong className="text-white text-base">{statValue(s)}</strong>
                  <span className="text-[#A0A0A0]"> {s.label}</span>
                </span>
              ))}
            </div>
          </div>
        );
        const mediaLeft = card.mediaSide !== 'right';
        return (
          <div
            key={card.title}
            className="rounded-2xl bg-[#121212] border border-[#2A2A2A] overflow-hidden grid md:grid-cols-2"
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
    <section id={payload.anchor || 'drivers'} className="max-w-6xl mx-auto px-6 pb-16">
      <div className="rounded-2xl bg-gradient-to-r from-[#6A00FF] to-[#0055FF] p-8 md:p-10 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-[0_20px_60px_rgba(106,0,255,0.3)]">
        <p className="text-xl md:text-2xl font-bold max-w-2xl leading-snug">{payload.body}</p>
        {payload.button ? (
          <button
            type="button"
            onClick={() => go(navigate, payload.button.href)}
            className="shrink-0 rounded-full px-7 py-3.5 bg-black font-semibold"
          >
            {payload.button.label}
          </button>
        ) : null}
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
          <p className="text-[#A0A0A0] mt-4 max-w-md leading-relaxed">{payload.body}</p>
        ) : null}
        <div className="mt-8 flex flex-wrap gap-3">
          {(payload.storeButtons || []).map((b: any) => (
            <button
              key={b.label}
              type="button"
              onClick={() => go(navigate, b.href)}
              className="rounded-xl bg-[#121212] border border-[#3A3A3A] px-5 py-3 text-sm font-semibold"
            >
              {b.label}
            </button>
          ))}
        </div>
        {payload.qrHint ? (
          <div className="mt-8 flex items-center gap-4">
            <div className="w-24 h-24 rounded-lg bg-white p-2 shrink-0">
              <div
                className="w-full h-full opacity-80"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(90deg,#000 0 2px,transparent 2px 4px),repeating-linear-gradient(0deg,#000 0 2px,transparent 2px 4px)',
                }}
              />
            </div>
            <p className="text-sm text-[#A0A0A0] max-w-[160px]">{payload.qrHint}</p>
          </div>
        ) : null}
      </div>
      {payload.showPhoneMock !== false ? (
        <PhoneFrame>
          <div className="flex justify-between text-[10px] px-5 pt-2 text-[#A0A0A0]">
            <span>9:41</span>
            <span>●●●</span>
          </div>
          <p className="text-center font-bold mt-1 mb-2 text-sm">Movr</p>
          <div className="relative mx-3 h-52 rounded-xl overflow-hidden bg-[#141414] mb-3">
            <div
              className="absolute inset-0 opacity-45"
              style={{
                backgroundImage:
                  'linear-gradient(#222 1px, transparent 1px), linear-gradient(90deg, #222 1px, transparent 1px)',
                backgroundSize: '16px 16px',
              }}
            />
          </div>
          <div className="px-3 pb-5">
            <div className="rounded-full h-11 bg-gradient-to-r from-[#6A00FF] to-[#0055FF] flex items-center justify-center text-sm font-semibold">
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
    <section className="max-w-6xl mx-auto px-6 pb-24">
      <div className="grid md:grid-cols-3 gap-4">
        {(payload.items || []).map((c: any) => {
          const Icon = ICONS[c.iconKey] || Package;
          return (
            <div
              key={c.title}
              className="rounded-2xl bg-[#0d0d0d] border border-[#2A2A2A] p-6 text-left"
            >
              <Icon size={22} className="mb-4" />
              <h3 className="text-lg font-bold">{c.title}</h3>
              <p className="text-[#A0A0A0] mt-2 text-sm leading-relaxed">{c.body}</p>
            </div>
          );
        })}
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
          className="w-full rounded-full bg-[#1A1A1A] border border-[#2A2A2A] px-4 py-2.5 text-sm"
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
              className="text-left rounded-2xl bg-[#121212] border border-[#2A2A2A] p-6 hover:border-[#0055FF]"
            >
              <Icon size={22} className="mb-4" />
              <h2 className="font-bold text-lg">{c.title}</h2>
              <p className="text-[#888] text-sm mt-2 leading-relaxed">{c.body}</p>
            </button>
          );
        })}
      </div>
    </main>
  );
}

export function CmsRichText({ payload }: { payload: any }) {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl md:text-4xl font-bold mb-8">{payload.heading}</h1>
      <div className="space-y-4 text-[#A0A0A0] leading-relaxed">
        {(payload.paragraphs || []).map((p: string, i: number) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </main>
  );
}

export function CmsLegal({ payload }: { payload: any }) {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-3xl md:text-4xl font-bold">{payload.heading}</h1>
      {payload.updatedLabel ? (
        <p className="text-[#A0A0A0] mt-3 mb-10">{payload.updatedLabel}</p>
      ) : (
        <div className="mb-10" />
      )}
      <ol className="space-y-6 text-[#A0A0A0] leading-relaxed list-none">
        {(payload.clauses || []).map((c: any) => (
          <li key={c.title}>
            <span className="text-white font-medium">{c.title}</span> — {c.body}
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
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-6 text-center">
      <h1 className="text-3xl font-bold mb-3">{slide.title}</h1>
      <p className="text-[#A0A0A0] max-w-md mb-8">{slide.body}</p>
      <div className="flex gap-2 mb-8">
        {slides.map((_: any, idx: number) => (
          <button
            key={idx}
            type="button"
            onClick={() => setI(idx)}
            className={`w-2 h-2 rounded-full ${idx === i ? 'bg-[#0055FF]' : 'bg-[#333]'}`}
          />
        ))}
      </div>
      {i < slides.length - 1 ? (
        <button
          type="button"
          onClick={() => setI((x) => x + 1)}
          className="rounded-full px-8 py-3 font-semibold bg-gradient-to-r from-[#6A00FF] to-[#0055FF]"
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
          className="rounded-full px-8 py-3 font-semibold bg-gradient-to-r from-[#6A00FF] to-[#0055FF]"
        >
          {payload.cta.label}
        </button>
      ) : null}
    </div>
  );
}

const RENDERERS: Record<string, React.FC<{ payload: any }>> = {
  hero: CmsHero,
  four_ways: CmsFourWays,
  stories: CmsStories,
  cta_banner: CmsCtaBanner,
  download: CmsDownload,
  feature_cards: CmsFeatureCards,
  help_hub: CmsHelpHub,
  rich_text: CmsRichText,
  legal: CmsLegal,
  onboarding_slides: CmsOnboarding,
};

export function CmsSectionView({ section }: { section: CmsSection }) {
  const Comp = RENDERERS[section.type];
  if (!Comp || section.enabled === false) return null;
  return <Comp payload={section.payload || {}} />;
}

export function CmsSections({ sections }: { sections?: CmsSection[] }) {
  if (!sections?.length) return null;
  return (
    <>
      {sections
        .filter((s) => s.type !== 'nav' && s.type !== 'footer')
        .map((s) => (
          <CmsSectionView key={s.id || `${s.type}-${s.sortOrder}`} section={s} />
        ))}
    </>
  );
}
