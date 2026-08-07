import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, BarChart3, CreditCard } from 'lucide-react';
import { useCmsPage } from '../../services/cms';
import { CmsSections } from '../../cms/sections';
import { BrandHeroBanner } from '../../brand/BrandHeroBanner';
import { BRAND } from '../../brand/assets';

const FEATURES = [
  {
    icon: Truck,
    title: 'Your choice of courier',
    body: 'Use Movr couriers or your own delivery team.',
  },
  {
    icon: BarChart3,
    title: 'Real sales analytics',
    body: 'Top products, repeat customers, sales trends.',
  },
  {
    icon: CreditCard,
    title: 'Instant payouts',
    body: 'Withdraw earnings to bank or mobile money.',
  },
];

function MerchantLandingFallback() {
  const navigate = useNavigate();
  return (
    <div className="bg-surface text-text-primary">
      <BrandHeroBanner
        imageUrl={BRAND.shopPartner}
        eyebrow="Movr for merchants"
        headline={'Sell faster with an\nin-app storefront'}
        subhead="Order management, live delivery tracking, and instant payouts — all from one dashboard."
      >
        <button
          type="button"
          onClick={() => navigate('/merchant/onboarding')}
          className="mkt-btn-primary"
        >
          Create your storefront
        </button>
      </BrandHeroBanner>

      <section className="max-w-6xl mx-auto px-6 py-16 grid md:grid-cols-3 gap-4">
        {FEATURES.map((f) => {
          const Icon = f.icon;
          return (
            <div key={f.title} className="rounded-2xl bg-surface-elevated border border-border p-6 text-left">
              <Icon size={20} className="text-text-primary mb-4" />
              <h3 className="font-bold text-lg text-text-primary">{f.title}</h3>
              <p className="mt-2 text-sm text-text-secondary">{f.body}</p>
            </div>
          );
        })}
      </section>
    </div>
  );
}

/** Merchant landing — content only; SiteChrome supplies header/footer. */
export default function MerchantLandingPage() {
  const { page, loading, error } = useCmsPage('merchants');

  if (loading) {
    return (
      <div className="flex-1 bg-surface text-text-primary flex items-center justify-center py-24">
        Loading…
      </div>
    );
  }

  if (error || !page) {
    return <MerchantLandingFallback />;
  }

  return (
    <div className="bg-surface text-text-primary">
      <CmsSections sections={page.sections} pageSlug="merchants" />
    </div>
  );
}
