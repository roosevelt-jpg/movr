import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, BarChart3, CreditCard } from 'lucide-react';
import { useCmsPage } from '../../services/cms';
import { CmsSections } from '../../cms/sections';

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
    <div className="bg-black text-white">
      <section className="max-w-4xl mx-auto px-6 pt-16 sm:pt-24 pb-16 text-center">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight">
          Sell faster with an in-app storefront
        </h1>
        <p className="mt-5 text-[#888888] text-lg max-w-2xl mx-auto">
          Order management, live delivery tracking, and instant payouts — all from one dashboard.
        </p>
        <button
          type="button"
          onClick={() => navigate('/merchant/onboarding')}
          className="mt-8 rounded-full px-8 py-3.5 font-semibold bg-movr-gradient text-white"
        >
          Create your storefront
        </button>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-24 grid md:grid-cols-3 gap-4">
        {FEATURES.map((f) => {
          const Icon = f.icon;
          return (
            <div key={f.title} className="rounded-2xl bg-[#1A1A1A] p-6 text-left">
              <Icon size={20} className="text-white mb-4" />
              <h3 className="font-bold text-lg text-white">{f.title}</h3>
              <p className="mt-2 text-sm text-[#888888]">{f.body}</p>
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
      <div className="flex-1 bg-black text-white flex items-center justify-center py-24">
        Loading…
      </div>
    );
  }

  if (error || !page) {
    return <MerchantLandingFallback />;
  }

  return (
    <div className="bg-black text-white">
      <CmsSections sections={page.sections} pageSlug="merchants" />
    </div>
  );
}
