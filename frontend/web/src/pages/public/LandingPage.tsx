import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, Heart, Package, KeyRound } from 'lucide-react';
import SiteFooter from '../../components/SiteFooter';
import { useCmsPage } from '../../services/cms';
import { CmsNav, CmsSections } from '../../cms/sections';
import MovrWordmark from '../../components/MovrWordmark';

const WAYS = [
  { icon: Car, title: 'Ride', body: 'Cars, bikes, and tricycles on demand.' },
  { icon: Heart, title: 'Shop', body: 'Buy from local stores, in one app.' },
  { icon: Package, title: 'Deliver', body: 'Parcels and orders, tracked live.' },
  { icon: KeyRound, title: 'Rentals', body: 'Self-drive or with a chauffeur.' },
];

/** Exact mockup fallback when CMS home is empty. */
function HomepageFallback() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-black text-white font-[Poppins,Montserrat,sans-serif]">
      <header className="sticky top-0 z-40 bg-black/90 backdrop-blur-md border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <button type="button" onClick={() => navigate('/')} className="font-bold text-xl">
            <MovrWordmark height={28} />
          </button>
          <nav className="hidden lg:flex items-center gap-7 text-sm text-white/90">
            {[
              ['Ride', '/#ride'],
              ['Shop', '/#shop'],
              ['Deliver', '/#deliver'],
              ['Rentals', '/#rentals'],
              ['For drivers', '/drivers'],
              ['For merchants', '/merchants'],
            ].map(([label, href]) =>
              href.startsWith('/#') ? (
                <a key={label} href={href} className="hover:opacity-80">
                  {label}
                </a>
              ) : (
                <button
                  key={label}
                  type="button"
                  onClick={() => navigate(href)}
                  className="hover:opacity-80"
                >
                  {label}
                </button>
              )
            )}
          </nav>
          <button
            type="button"
            onClick={() => navigate('/download')}
            className="rounded-full px-5 py-2.5 text-sm font-semibold bg-movr-gradient"
          >
            Get the app
          </button>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 pt-16 pb-20 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-[1.05]">
            Move. Shop. Deliver.
          </h1>
          <p className="mt-5 text-white/70 text-lg max-w-md leading-relaxed">
            One platform for rides, local shopping, and delivery — built for Ghana and expanding
            across Africa.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="rounded-full px-7 py-3.5 font-semibold bg-movr-gradient"
            >
              Book a ride
            </button>
            <button
              type="button"
              onClick={() => navigate('/register')}
              className="rounded-full px-7 py-3.5 font-semibold border border-white/70"
            >
              Drive with Movr
            </button>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-[280px]">
          <div className="rounded-[2.4rem] border border-white/15 bg-[#111] p-2.5">
            <div className="rounded-[2rem] bg-black overflow-hidden border border-white/10">
              <div className="flex justify-between text-[10px] px-5 pt-2 text-white/50">
                <span>9:41</span>
                <span>100%</span>
              </div>
              <p className="text-center font-bold mt-1 mb-2 text-sm">Movr</p>
              <div className="flex justify-center gap-6 text-xs border-b border-white/10 pb-2 px-2">
                <span className="border-b-2 border-blue-500 pb-2 font-medium">Ride</span>
                <span className="text-white/50">Shop</span>
                <span className="text-white/50">Deliver</span>
              </div>
              <div className="relative m-3 h-40 rounded-xl bg-[#1A1A1A]" />
              <div className="px-3 space-y-2 pb-4">
                <div className="rounded-xl bg-[#1A1A1A] h-9 flex items-center px-3 text-xs text-white/50">
                  Pickup
                </div>
                <div className="rounded-xl bg-[#1A1A1A] h-9 flex items-center px-3 text-xs text-white/50">
                  Enter destination
                </div>
                <div className="rounded-full h-10 bg-movr-gradient flex items-center justify-center text-xs font-semibold">
                  Confirm pickup
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="ride" className="max-w-6xl mx-auto px-6 pb-20">
        <h2 className="text-2xl md:text-3xl font-bold mb-6">Four ways to move</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {WAYS.map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.title} className="rounded-2xl bg-[#1A1A1A] p-5">
                <Icon size={22} className="mb-4" />
                <h3 className="font-bold text-lg">{c.title}</h3>
                <p className="text-[#888] text-sm mt-2 leading-relaxed">{c.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="rounded-2xl bg-movr-gradient p-8 md:p-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <p className="text-xl md:text-2xl font-bold">Drive and keep 100% of every fare</p>
            <p className="mt-2 text-white/85 text-sm md:text-base">
              No per-ride commission. Just one flexible monthly subscription — cancel any time.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/register')}
            className="shrink-0 rounded-full px-7 py-3.5 bg-black font-semibold"
          >
            Become a driver
          </button>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

/** Homepage — CMS `home` + `global` nav, with mockup fallback. */
const LandingPage: React.FC = () => {
  const { page, loading, error } = useCmsPage('home');
  const global = useCmsPage('global');
  const nav = global.section('nav');

  if (loading || global.loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Loading…
      </div>
    );
  }

  if (error || !page) {
    return <HomepageFallback />;
  }

  const navPayload = nav?.payload || {
    brand: 'Movr',
    links: [
      { label: 'Ride', href: '/#ride' },
      { label: 'Shop', href: '/#shop' },
      { label: 'Deliver', href: '/#deliver' },
      { label: 'Rentals', href: '/#rentals' },
      { label: 'For drivers', href: '/drivers' },
      { label: 'For merchants', href: '/merchants' },
    ],
    cta: { label: 'Get the app', href: '/download' },
  };

  return (
    <div className="min-h-screen bg-black text-white font-[Poppins,Montserrat,sans-serif]">
      <CmsNav payload={navPayload} />
      <CmsSections sections={page.sections} />
      <SiteFooter />
    </div>
  );
};

export default LandingPage;
