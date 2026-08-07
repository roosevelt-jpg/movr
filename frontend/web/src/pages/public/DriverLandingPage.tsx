import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CreditCard, Award, ShieldCheck } from 'lucide-react';
import MovrWordmark from '../../components/MovrWordmark';
import SiteFooter from '../../components/SiteFooter';
import { useCmsPage } from '../../services/cms';
import { CmsNav, CmsSections } from '../../cms/sections';

const FALLBACK = {
  headline: 'Keep 100% of every fare',
  lines: [
    'No commission. One flexible subscription, cancel any time.',
    'Drive Sedan, SUV, Motorcycle, Tricycle, or Van.',
  ],
  cta: { label: 'Become a driver', href: '/register?role=driver' },
  cards: [
    {
      icon: 'card',
      title: '100% earnings',
      body: 'Every fare, yours. No per-ride cut, ever.',
    },
    {
      icon: 'award',
      title: 'Tiered rewards',
      body: 'Lite, Pro, Premium — unlock priority matching.',
    },
    {
      icon: 'shield',
      title: 'Verified identity',
      body: 'Ghana Card-linked, on-chain attested trust.',
    },
  ],
};

const NAV_FALLBACK = [
  { label: 'Ride', href: '/#ride' },
  { label: 'Shop', href: '/#shop' },
  { label: 'Deliver', href: '/#deliver' },
  { label: 'For drivers', href: '/drivers', active: true },
];

/** Public driver landing — mockup-aligned; CMS slug `drivers` when published. */
export default function DriverLandingPage() {
  const navigate = useNavigate();
  const { page, loading } = useCmsPage('drivers');
  const global = useCmsPage('global');
  const nav = global.section('nav');

  if (loading || global.loading) {
    return (
      <div className="min-h-screen bg-jet-black text-pure-white flex items-center justify-center">
        Loading…
      </div>
    );
  }

  // Prefer CMS when published with sections
  if (page?.sections?.length) {
    return (
      <div className="min-h-screen bg-jet-black text-pure-white font-[Poppins,Montserrat,sans-serif]">
        {nav ? <CmsNav payload={nav.payload} /> : null}
        <CmsSections sections={page.sections} />
        <SiteFooter />
      </div>
    );
  }

  const go = (href: string) => {
    if (href.startsWith('http')) {
      window.open(href, '_blank', 'noreferrer');
      return;
    }
    if (href.startsWith('/#')) {
      window.location.href = href;
      return;
    }
    navigate(href);
  };

  const icons: Record<string, React.ReactNode> = {
    card: <CreditCard size={22} />,
    award: <Award size={22} />,
    shield: <ShieldCheck size={22} />,
  };

  return (
    <div className="min-h-screen bg-jet-black text-pure-white font-[Poppins,Montserrat,sans-serif]">
      <header className="sticky top-0 z-40 bg-jet-black/80 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2" aria-label="Movr">
            <MovrWordmark height={28} />
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm">
            {NAV_FALLBACK.map((l) => (
              <button
                key={l.label}
                type="button"
                onClick={() => go(l.href)}
                className={
                  l.active
                    ? 'text-pure-white font-semibold'
                    : 'text-text-secondary hover:text-pure-white'
                }
              >
                {l.label}
              </button>
            ))}
          </nav>
          <button
            type="button"
            onClick={() => go('/download')}
            className="rounded-full px-5 py-2.5 text-sm font-semibold bg-movr-gradient"
          >
            Get the app
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-tight">
          {FALLBACK.headline}
        </h1>
        <div className="mt-6 space-y-2 text-base sm:text-lg text-pure-white/90">
          {FALLBACK.lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        <button
          type="button"
          onClick={() => go(FALLBACK.cta.href)}
          className="mt-10 rounded-full px-8 py-3.5 text-base font-semibold bg-movr-gradient shadow-active-glow"
        >
          {FALLBACK.cta.label}
        </button>

        <div className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
          {FALLBACK.cards.map((c) => (
            <div
              key={c.title}
              className="rounded-2xl bg-surface-elevated border border-border p-6"
            >
              <div className="text-pure-white mb-4">{icons[c.icon]}</div>
              <h3 className="font-bold text-lg">{c.title}</h3>
              <p className="mt-2 text-sm text-text-secondary leading-relaxed">{c.body}</p>
            </div>
          ))}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
