import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, Award, ShieldCheck } from 'lucide-react';
import { useCmsPage } from '../../services/cms';
import { CmsSections } from '../../cms/sections';
import { BrandHeroBanner } from '../../brand/BrandHeroBanner';
import { BRAND } from '../../brand/assets';

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

/** Public driver landing — content only; SiteChrome supplies header/footer. */
export default function DriverLandingPage() {
  const navigate = useNavigate();
  const { page, loading } = useCmsPage('drivers');

  if (loading) {
    return (
      <div className="flex-1 bg-surface text-text-primary flex items-center justify-center py-24">
        Loading…
      </div>
    );
  }

  if (page?.sections?.length) {
    return (
      <div className="bg-surface text-text-primary">
        <CmsSections sections={page.sections} pageSlug="drivers" />
      </div>
    );
  }

  const go = (href: string) => {
    if (href.startsWith('http')) {
      window.open(href, '_blank', 'noreferrer');
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
    <div className="bg-surface text-text-primary">
      <BrandHeroBanner
        imageUrl={BRAND.courierMoto}
        eyebrow="Movr for drivers"
        headline={FALLBACK.headline}
        subhead={FALLBACK.lines.join(' ')}
      >
        <button type="button" onClick={() => go(FALLBACK.cta.href)} className="mkt-btn-primary">
          {FALLBACK.cta.label}
        </button>
      </BrandHeroBanner>

      <div className="mkt-shell py-16 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
        {FALLBACK.cards.map((c) => (
          <div key={c.title} className="rounded-2xl bg-surface-elevated border border-border p-6">
            <div className="text-text-primary mb-4">{icons[c.icon]}</div>
            <h3 className="font-bold text-lg">{c.title}</h3>
            <p className="mt-2 text-sm text-text-secondary leading-relaxed">{c.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
