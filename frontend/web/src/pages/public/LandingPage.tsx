import React from 'react';
import { useCmsPage } from '../../services/cms';
import { CmsSections } from '../../cms/sections';
import {
  CmsChoiceHero,
  CmsTrustStrip,
  CmsHowItWorks,
  CmsProductGrid,
  CmsWhyGrid,
  CmsFinalCta,
} from '../../cms/marketing-sections';

/** Exact marketing fallback when CMS home is empty. */
function HomepageFallback() {
  return (
    <div className="bg-surface text-text-primary">
      <CmsChoiceHero
        pageSlug="home"
        payload={{
          eyebrow: 'The mobility & commerce platform',
          headline: 'Move. Shop. Deliver.\nOne app for Africa.',
          subhead:
            'Book rides, shop local stores, send parcels, and rent vehicles — built for Ghana and expanding across Africa.',
          backgroundImage: '/brand/ride-sedan.png',
          choices: [
            {
              emoji: '🚗',
              title: 'I need a ride',
              body: 'Cars, bikes, and tricycles on demand — tracked live.',
              cta: 'Book a ride',
              href: '/login',
              imageUrl: '/brand/ride-sedan.png',
            },
            {
              emoji: '🏪',
              title: 'I run a business',
              body: 'Sell in-app, deliver with Movr, get paid fast.',
              cta: 'Open a storefront',
              href: '/merchants',
              imageUrl: '/brand/shop-partner.png',
            },
          ],
        }}
      />
      <CmsTrustStrip
        payload={{
          label: 'Trusted by riders, drivers, and merchants across Ghana',
          items: ['Riders', 'Drivers', 'Merchants', 'Couriers', 'Fleet partners'],
        }}
      />
      <CmsHowItWorks
        payload={{
          eyebrow: 'How Movr works',
          heading: 'Transportation and commerce, exactly when you need it.',
          steps: [
            {
              number: '01',
              title: 'Choose how you move',
              body: 'Ride, shop, deliver, or rent — pick a service in seconds.',
            },
            {
              number: '02',
              title: 'Match with verified partners',
              body: 'Identity-checked drivers and merchants with live tracking.',
            },
            {
              number: '03',
              title: 'Pay securely and go',
              body: 'Wallet, card, or mobile money — with ratings and support.',
            },
          ],
        }}
      />
      <CmsProductGrid
        payload={{
          eyebrow: 'One platform. Four ways to move.',
          heading: 'Everything you need to move people and goods.',
          items: [
            {
              iconKey: 'car',
              eyebrow: 'Consumer',
              title: 'Ride',
              body: 'On-demand cars, bikes, and tricycles.',
              cta: 'Book a ride',
              href: '/login',
              imageUrl: '/brand/ride-sedan.png',
            },
            {
              iconKey: 'heart',
              eyebrow: 'Commerce',
              title: 'Shop',
              body: 'Buy from local stores with delivery.',
              cta: 'Browse stores',
              href: '/marketplace',
              imageUrl: '/brand/shop-partner.png',
            },
            {
              iconKey: 'package',
              eyebrow: 'Logistics',
              title: 'Deliver',
              body: 'Parcels tracked from pickup to drop-off.',
              cta: 'Send a parcel',
              href: '/login',
              imageUrl: '/brand/courier-moto.png',
            },
            {
              iconKey: 'key',
              eyebrow: 'Mobility',
              title: 'Rentals',
              body: 'Self-drive or chauffeured vehicles.',
              cta: 'Explore rentals',
              href: '/#rentals',
              imageUrl: '/brand/ride-sedan.png',
            },
          ],
        }}
      />
      <CmsWhyGrid
        payload={{
          eyebrow: 'Why Movr',
          heading: 'Built to be trusted.',
          items: [
            {
              iconKey: 'shield',
              title: 'Verified identity',
              body: 'National ID–linked profiles for safer trips.',
            },
            {
              iconKey: 'wallet',
              title: 'Drivers keep 100%',
              body: 'No per-ride commission — subscription only.',
            },
            {
              iconKey: 'store',
              title: 'Merchant-ready',
              body: 'Storefronts, orders, and payouts in one place.',
            },
          ],
        }}
      />
      <CmsFinalCta
        payload={{
          heading: 'Ready to move smarter?',
          body: 'Join riders, drivers, and merchants already building on Movr.',
          primaryCta: { label: 'Get started', href: '/register' },
          secondaryCta: { label: 'Get the app', href: '/download' },
        }}
      />
    </div>
  );
}

/** Homepage — CMS content; SiteChrome supplies header/footer. */
const LandingPage: React.FC = () => {
  const { page, loading, error } = useCmsPage('home');

  if (loading) {
    return (
      <div className="flex-1 bg-surface text-text-primary flex items-center justify-center py-24">
        Loading…
      </div>
    );
  }

  if (error || !page) {
    return <HomepageFallback />;
  }

  return (
    <div className="bg-surface text-text-primary">
      <CmsSections sections={page.sections} pageSlug="home" />
    </div>
  );
};

export default LandingPage;
