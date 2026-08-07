import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, BarChart3, CreditCard } from 'lucide-react';
import { useCmsPage } from '../../services/cms';
import { CmsNav, CmsSections } from '../../cms/sections';
import SiteFooter from '../../components/SiteFooter';
import MovrWordmark from '../../components/MovrWordmark';

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

/** Hardcoded mockup layout (also used when CMS is empty). */
function MerchantLandingFallback() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-black text-white font-[Poppins,Montserrat,sans-serif]">
      <header className="sticky top-0 z-40 bg-black/90 backdrop-blur-md border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <button type="button" onClick={() => navigate('/')} className="font-bold text-xl">
            <MovrWordmark height={28} />
          </button>
          <nav className="hidden md:flex items-center gap-8 text-sm text-white/70">
            {[
              { label: 'Ride', href: '/#ride' },
              { label: 'Shop', href: '/#shop' },
              { label: 'Deliver', href: '/#deliver' },
              { label: 'For merchants', href: '/merchants', active: true },
            ].map((l) =>
              l.href.startsWith('/#') ? (
                <a key={l.label} href={l.href} className="hover:text-white">
                  {l.label}
                </a>
              ) : (
                <button
                  key={l.label}
                  type="button"
                  onClick={() => navigate(l.href)}
                  className={l.active ? 'text-white font-semibold' : 'hover:text-white'}
                >
                  {l.label}
                </button>
              )
            )}
          </nav>
          <button
            type="button"
            onClick={() => navigate('/merchant/onboarding')}
            className="rounded-full px-5 py-2.5 text-sm font-semibold bg-movr-gradient text-white"
          >
            Start selling
          </button>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
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

      <SiteFooter />
    </div>
  );
}

/** Merchant landing — CMS slug `merchants`, with mockup-aligned fallback. */
export default function MerchantLandingPage() {
  const { page, loading, error } = useCmsPage('merchants');
  const global = useCmsPage('global');
  const nav = global.section('nav');

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">Loading…</div>
    );
  }

  // Prefer CMS when published; otherwise exact mockup fallback
  if (error || !page) {
    return <MerchantLandingFallback />;
  }

  // Inject Start selling into nav CTA when missing
  const navPayload = nav?.payload
    ? {
        ...nav.payload,
        cta: nav.payload.cta || { label: 'Start selling', href: '/merchant/onboarding' },
        links: (nav.payload.links || []).map((l: any) =>
          String(l.label || '').toLowerCase().includes('merchant')
            ? { ...l, label: 'For merchants', href: '/merchants' }
            : l
        ),
      }
    : {
        brand: 'Movr',
        links: [
          { label: 'Ride', href: '/#ride' },
          { label: 'Shop', href: '/#shop' },
          { label: 'Deliver', href: '/#deliver' },
          { label: 'For merchants', href: '/merchants' },
        ],
        cta: { label: 'Start selling', href: '/merchant/onboarding' },
      };

  return (
    <div className="min-h-screen bg-black text-white font-[Poppins,Montserrat,sans-serif]">
      <CmsNav payload={navPayload} />
      <CmsSections sections={page.sections} />
      <SiteFooter />
    </div>
  );
}
