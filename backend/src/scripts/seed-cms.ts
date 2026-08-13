/**
 * Seed Movr CMS pages from the homepage / marketing mockups.
 * Run: pnpm --filter @movr/backend run db:seed-cms
 */
import path from 'path';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { DatabaseService } from '../services/database.service';
import { CmsService } from '../services/cms.service';
import { PLAYSTORE_CMS_PAGES } from './cms-playstore-pages';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const DRIVER_IMG =
  'https://images.unsplash.com/photo-1544620341-1adc1b71c46f?auto=format&fit=crop&w=900&q=80';
const RIDER_IMG =
  'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&w=900&q=80';
const MERCHANT_IMG =
  'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=900&q=80';

export const CMS_SEED: Array<{
  slug: string;
  title: string;
  status: string;
  meta?: Record<string, any>;
  sections: Array<{ type: string; payload: Record<string, any> }>;
}> = [
  {
    slug: 'global',
    title: 'Site chrome (nav + footer)',
    status: 'published',
    sections: [
      {
        type: 'nav',
        payload: {
          brand: 'Movr',
          logoUrl: '/brand/movr-logo.png',
          faviconUrl: '/favicon.png',
          links: [
            { label: 'AI', href: '/ai' },
            { label: 'Drivers', href: '/drivers' },
            { label: 'Merchants', href: '/merchants' },
            { label: 'About', href: '/about' },
          ],
          secondaryCta: { label: 'Log in', href: '/login' },
          cta: { label: 'Get started', href: '/register' },
        },
      },
      {
        type: 'footer',
        payload: {
          brand: 'Movr',
          tagline:
            'Move. Shop. Deliver.\nGlobal mobility, commerce, and logistics in one platform.',
          social: [],
          columns: [
            {
              title: 'SERVICES',
              links: [
                { label: 'Ride', href: '/ride' },
                { label: 'Shop', href: '/shop' },
                { label: 'Deliver', href: '/deliver' },
                { label: 'Rentals', href: '/rent' },
              ],
            },
            {
              title: 'PLATFORM',
              links: [
                { label: 'Movr AI', href: '/ai' },
                { label: 'Wallet', href: '/wallet' },
                { label: 'Marketplace', href: '/marketplace' },
                { label: 'Download app', href: '/download' },
              ],
            },
            {
              title: 'COMPANY',
              links: [
                { label: 'About Movr', href: '/about' },
                { label: 'For drivers', href: '/drivers' },
                { label: 'For merchants', href: '/merchants' },
                { label: 'Careers', href: '/about' },
              ],
            },
            {
              title: 'SUPPORT',
              links: [
                { label: 'Help centre', href: '/help' },
                { label: 'Talk to Movr AI', href: '/ai' },
                { label: 'Contact us', href: '/contact' },
                { label: 'Safety', href: '/help' },
                { label: 'Terms of Service', href: '/terms' },
                { label: 'Privacy Policy', href: '/privacy' },
                { label: 'Delete account', href: '/delete-account' },
                { label: 'Refunds', href: '/refund-policy' },
              ],
            },
          ],
          appButtons: [
            { label: 'App Store', store: 'ios', href: '/download' },
            { label: 'Google Play', store: 'android', href: '/download' },
          ],
          copyright: '© 2026 Movr Global Technologies. All rights reserved.',
          legalLinks: [
            { label: 'Privacy', href: '/privacy' },
            { label: 'Terms', href: '/terms' },
            { label: 'Cookies', href: '/cookies' },
          ],
        },
      },
    ],
  },
  {
    slug: 'home',
    title: 'Homepage',
    status: 'published',
    sections: [
      {
        type: 'choice_hero',
        payload: {
          eyebrow: 'The mobility & commerce platform',
          headline: 'Move. Shop. Deliver.\nOne app for Africa.',
          subhead:
            'Book rides, shop local stores, send parcels, and rent vehicles — built for Ghana and expanding across Africa.',
          backgroundImage: '/brand/movr-car-in-motion.jpg',
          choices: [
            {
              emoji: '🚗',
              title: 'I need a ride',
              body: 'Cars, bikes, and tricycles on demand — tracked live.',
              cta: 'Book a ride',
              href: '/#book',
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
        },
      },
      {
        type: 'booking_engine',
        payload: {
          headline: 'Compare your travel options',
          subhead:
            'Enter your pickup and destination to review estimated travel times and pricing across every way to move.',
          formTitle: 'Trip details',
          cityLabel: 'Accra, GH',
          countryCode: 'GH',
          ctaLabel: 'See prices',
          mapImageUrl: '/brand/compare-map.svg',
          mapImageAlt: 'Trip map preview',
          sideTitle: '',
          sideCtaLabel: '',
          sideCtaHref: '/register',
          defaultLat: 5.6037,
          defaultLng: -0.187,
        },
      },
      {
        type: 'trust_strip',
        payload: {
          label: 'Trusted by riders, drivers, and merchants across Ghana',
          items: ['Riders', 'Drivers', 'Merchants', 'Couriers', 'Fleet partners'],
        },
      },
      {
        type: 'how_it_works',
        payload: {
          eyebrow: 'How Movr works',
          heading: 'Transportation and commerce, exactly when you need it.',
          steps: [
            {
              number: '01',
              title: 'Choose how you move',
              body: 'Ride, shop, deliver, or rent — pick a service and set your pickup or order in seconds.',
            },
            {
              number: '02',
              title: 'Match with verified partners',
              body: 'Drivers and merchants are identity-checked. See ratings, vehicle details, and live tracking.',
            },
            {
              number: '03',
              title: 'Pay securely and go',
              body: 'Wallet, card, or mobile money. Ratings and support keep every trip accountable.',
            },
          ],
        },
      },
      {
        type: 'ai_showcase',
        payload: {
          anchor: 'ai',
          eyebrow: 'Movr AI',
          heading: "Talk. Don't tap.",
          body:
            'Movr AI understands. Plans. Books. Coordinates — so a ride, an order, or a delivery is one message, not a hundred taps. Ask about rates, book a trip, or find a store.',
          primaryCta: { label: 'Tell Movr AI', href: '/ai' },
          secondaryCta: { label: 'Get the app', href: '/download' },
          note: 'Available in the app, on the web, and over messaging channels.',
          demo: {
            title: 'Movr AI',
            status: 'Online',
            userMessage: 'How much from Osu to the airport?',
            botMessage:
              'Economy about GHS 45 · 12 min, or Comfort GHS 62 · 10 min. Want me to book one?',
            quoteCard: {
              title: 'Economy · Sedan',
              badge: 'Fare estimate',
              price: 'GHS 45',
              footer: 'Live quote · confirm in chat to book',
            },
          },
        },
      },
      {
        type: 'product_grid',
        payload: {
          eyebrow: 'One platform. Four ways to move.',
          heading: 'Everything you need to move people and goods.',
          anchor: 'ride',
          items: [
            {
              iconKey: 'car',
              eyebrow: 'Consumer',
              title: 'Ride',
              body: 'On-demand cars, bikes, and tricycles across the city.',
              cta: 'Book a ride',
              href: '/ride',
              imageUrl: '/brand/ride-sedan.png',
            },
            {
              iconKey: 'heart',
              eyebrow: 'Commerce',
              title: 'Shop',
              body: 'Buy from local stores with delivery to your door.',
              cta: 'Browse stores',
              href: '/shop',
              imageUrl: '/brand/shop-partner.png',
            },
            {
              iconKey: 'package',
              eyebrow: 'Logistics',
              title: 'Deliver',
              body: 'Parcels and orders tracked from pickup to drop-off.',
              cta: 'Send a parcel',
              href: '/deliver',
              imageUrl: '/brand/courier-moto.png',
            },
            {
              iconKey: 'key',
              eyebrow: 'Mobility',
              title: 'Rentals',
              body: 'Self-drive or chauffeured vehicles when you need them.',
              cta: 'Explore rentals',
              href: '/rent',
              imageUrl: '/brand/ride-sedan.png',
            },
          ],
        },
      },
      {
        type: 'why_grid',
        payload: {
          eyebrow: 'Why Movr',
          heading: 'Built to be trusted.',
          items: [
            {
              iconKey: 'shield',
              title: 'Verified identity',
              body: 'National ID–linked profiles and on-chain attestation for safer trips.',
            },
            {
              iconKey: 'wallet',
              title: 'Drivers keep 100%',
              body: 'No per-ride commission — one flexible subscription for drivers.',
            },
            {
              iconKey: 'store',
              title: 'Merchant-ready',
              body: 'Storefronts, orders, couriers, and payouts in one dashboard.',
            },
            {
              iconKey: 'map',
              title: 'Live tracking',
              body: 'Follow rides and deliveries in real time from pickup to arrival.',
            },
            {
              iconKey: 'sparkles',
              title: 'Wallet & rewards',
              body: 'Top up, earn points, and redeem across the Movr ecosystem.',
            },
            {
              iconKey: 'building',
              title: 'Built for Africa',
              body: 'Local payments, multi-country ready, designed for real city mobility.',
            },
          ],
        },
      },
      {
        type: 'testimonials',
        payload: {
          eyebrow: 'What people say',
          heading: 'The platform that keeps cities moving.',
          items: [
            {
              quote:
                'The app for my commute, my groceries, and sending things to my mom — all in one place.',
              name: 'Ama',
              role: 'Rider · Kumasi',
              avatarUrl: '/brand/testimonials/ama.jpg',
            },
            {
              quote:
                'I keep everything I earn. The subscription pays for itself in two days.',
              name: 'Enoch',
              role: 'Driver · Accra',
              avatarUrl: '/brand/testimonials/enoch.jpg',
            },
            {
              quote:
                'Orders come straight to my phone. Delivery is handled — I just focus on the shop.',
              name: 'Boutique 22',
              role: 'Merchant · Osu',
              avatarUrl: '/brand/testimonials/boutique22.jpg',
            },
          ],
        },
      },
      {
        type: 'cta_banner',
        payload: {
          headline: 'Drive and keep 100% of every fare',
          body: 'No per-ride commission. Just one flexible monthly subscription — cancel any time.',
          button: { label: 'Become a driver', href: '/drivers' },
          anchor: 'drivers',
        },
      },
      {
        type: 'final_cta',
        payload: {
          heading: 'Ready to move smarter?',
          body: 'Join riders, drivers, and merchants already building on Movr.',
          primaryCta: { label: 'Get started', href: '/register' },
          secondaryCta: { label: 'Get the app', href: '/download' },
          note: 'Available on iOS and Android.',
          showPhoneMock: true,
          phoneImageUrl: '',
          storeButtons: [
            { label: 'App Store', store: 'ios', href: '/download' },
            { label: 'Google Play', store: 'android', href: '/download' },
          ],
        },
      },
    ],
  },
  {
    slug: 'merchants',
    title: 'For merchants',
    status: 'published',
    sections: [
      {
        type: 'business_split',
        payload: {
          eyebrow: 'Movr for Business',
          headline: 'The best of Movr\nfor your business',
          subhead:
            'Give your shop more control, clearer sales insights, and tools built for African merchants. Manage orders, deliveries, and payouts from one dashboard.',
          imageUrl: '/brand/shop-partner.png',
          imageAlt: 'Merchant using Movr on a phone',
          backgroundColor: '#000000',
          textColor: '#ffffff',
          mutedColor: 'rgba(255,255,255,0.72)',
          primaryButtonStyle: 'light',
          primaryCta: { label: 'How to get started', href: '/merchant/onboarding' },
          secondaryCta: { label: 'Check out our solutions', href: '/merchants#solutions' },
        },
      },
      {
        type: 'how_it_works',
        payload: {
          eyebrow: 'How selling works',
          heading: 'From listing to payout, without the chaos.',
          steps: [
            {
              number: '01',
              title: 'Set up your store',
              body: 'Add products, photos, and hours. Movr hosts your storefront in the app.',
            },
            {
              number: '02',
              title: 'Fulfil with your courier',
              body: 'Use Movr couriers or your own delivery team — you choose.',
            },
            {
              number: '03',
              title: 'Get paid',
              body: 'Track sales and withdraw earnings to bank or mobile money.',
            },
          ],
        },
      },
      {
        type: 'why_grid',
        payload: {
          eyebrow: 'Built for local commerce',
          heading: 'Everything a growing shop needs.',
          anchorId: 'solutions',
          items: [
            {
              iconKey: 'package',
              title: 'Your choice of courier',
              body: 'Use Movr couriers or your own delivery team.',
            },
            {
              iconKey: 'sparkles',
              title: 'Real sales analytics',
              body: 'Top products, repeat customers, and sales trends.',
            },
            {
              iconKey: 'wallet',
              title: 'Instant payouts',
              body: 'Withdraw earnings to bank or mobile money.',
            },
          ],
        },
      },
      {
        type: 'final_cta',
        payload: {
          heading: 'Ready to sell on Movr?',
          body: 'Create your storefront and start taking orders today.',
          primaryCta: { label: 'Create your storefront', href: '/merchant/onboarding' },
          secondaryCta: { label: 'Merchant login', href: '/merchant/login' },
        },
      },
    ],
  },
  {
    slug: 'drivers',
    title: 'For drivers',
    status: 'published',
    sections: [
      {
        type: 'choice_hero',
        payload: {
          eyebrow: 'Movr for drivers',
          headline: 'Keep 100% of\nevery fare.',
          subhead:
            'No commission. One flexible subscription, cancel any time. Drive Sedan, SUV, Motorcycle, Tricycle, or Van.',
          backgroundImage: '/brand/movr-bike-in-motion.jpg',
          choices: [
            {
              emoji: '🔑',
              title: 'Become a driver',
              body: 'Verify your identity and start earning on your schedule.',
              cta: 'Apply now',
              href: '/register?role=driver',
              imageUrl: '/brand/courier-moto.png',
            },
            {
              emoji: '📱',
              title: 'I already drive',
              body: 'Log in to accept trips and track your earnings.',
              cta: 'Driver login',
              href: '/login',
              imageUrl: '/brand/ride-sedan.png',
            },
          ],
        },
      },
      {
        type: 'how_it_works',
        payload: {
          eyebrow: 'How driving works',
          heading: 'Pickups sorted. You just drive.',
          steps: [
            {
              number: '01',
              title: 'Verify once',
              body: 'National ID–linked onboarding with on-chain attestation.',
            },
            {
              number: '02',
              title: 'Choose your tier',
              body: 'Lite, Pro, or Premium — unlock priority matching as you grow.',
            },
            {
              number: '03',
              title: 'Earn every fare',
              body: '100% of the fare is yours. No per-ride cut, ever.',
            },
          ],
        },
      },
      {
        type: 'why_grid',
        payload: {
          eyebrow: 'Why drivers switch',
          heading: 'Built to be fair.',
          items: [
            {
              iconKey: 'wallet',
              title: '100% earnings',
              body: 'Every fare, yours. No per-ride cut, ever.',
            },
            {
              iconKey: 'sparkles',
              title: 'Tiered rewards',
              body: 'Lite, Pro, Premium — unlock priority matching.',
            },
            {
              iconKey: 'shield',
              title: 'Verified identity',
              body: 'Ghana Card-linked, on-chain attested trust.',
            },
          ],
        },
      },
      {
        type: 'final_cta',
        payload: {
          heading: 'Ready to drive with Movr?',
          body: 'Join drivers keeping 100% of every fare.',
          primaryCta: { label: 'Become a driver', href: '/register?role=driver' },
          secondaryCta: { label: 'Get the app', href: '/download' },
        },
      },
    ],
  },
  {
    slug: 'ride',
    title: 'Ride',
    status: 'published',
    meta: { path: '/ride', menuLabel: 'Ride' },
    sections: [
      {
        type: 'hero',
        payload: {
          eyebrow: 'Movr Ride',
          headline: 'Go anywhere,\nanytime.',
          subhead:
            'Cars, okada, tricycles, and shared rides — priced in your local currency with live ETAs.',
          layout: 'split',
          backgroundImage: '/brand/movr-car-in-motion.jpg',
          primaryCta: { label: 'Book a ride', href: '/login' },
          secondaryCta: { label: 'Get the app', href: '/download' },
          showPhoneMock: true,
        },
      },
      {
        type: 'how_it_works',
        payload: {
          eyebrow: 'How Ride works',
          heading: 'Request. Match. Arrive.',
          steps: [
            {
              number: '01',
              title: 'Set your trip',
              body: 'Enter pickup and drop-off. See options and fares before you confirm.',
            },
            {
              number: '02',
              title: 'Match with a driver',
              body: 'Verified drivers nearby accept your trip. Track them live on the map.',
            },
            {
              number: '03',
              title: 'Pay your way',
              body: 'Wallet, mobile money, or card — receipt and rating when you arrive.',
            },
          ],
        },
      },
      {
        type: 'why_grid',
        payload: {
          eyebrow: 'Why Ride with Movr',
          heading: 'Built for African cities.',
          items: [
            {
              iconKey: 'car',
              title: 'Every vehicle type',
              body: 'Sedan, SUV, motorcycle, tricycle, and van — pick what fits the trip.',
            },
            {
              iconKey: 'sparkles',
              title: 'Share & save',
              body: 'Pool with riders going your way when you want a lower fare.',
            },
            {
              iconKey: 'shield',
              title: 'Safety first',
              body: 'Verified drivers, trip sharing, and in-app support when you need it.',
            },
          ],
        },
      },
      {
        type: 'rich_text',
        payload: {
          heading: 'Edit this page in Admin → CMS',
          paragraphs: [
            'Replace this copy, swap hero and section images, and add banners from the CMS editor. Sections here are fully editable.',
          ],
        },
      },
      {
        type: 'final_cta',
        payload: {
          heading: 'Ready to ride?',
          body: 'Book in the app or on the web in seconds.',
          primaryCta: { label: 'Book a ride', href: '/login' },
          secondaryCta: { label: 'Download Movr', href: '/download' },
        },
      },
    ],
  },
  {
    slug: 'shop',
    title: 'Shop',
    status: 'published',
    meta: { path: '/shop', menuLabel: 'Shop' },
    sections: [
      {
        type: 'hero',
        payload: {
          eyebrow: 'Movr Shop',
          headline: 'Local stores,\ndelivered.',
          subhead:
            'Browse neighbourhood merchants, order what you need, and get it to your door — same platform as your rides.',
          layout: 'split',
          backgroundImage: '/brand/shop-partner.png',
          primaryCta: { label: 'Browse stores', href: '/marketplace' },
          secondaryCta: { label: 'Become a merchant', href: '/merchants' },
          showPhoneMock: false,
        },
      },
      {
        type: 'how_it_works',
        payload: {
          eyebrow: 'How Shop works',
          heading: 'Discover. Order. Receive.',
          steps: [
            {
              number: '01',
              title: 'Find local stores',
              body: 'Explore categories and merchants near you with live availability.',
            },
            {
              number: '02',
              title: 'Checkout in one wallet',
              body: 'Pay with Movr wallet, mobile money, or card — no juggling apps.',
            },
            {
              number: '03',
              title: 'Track delivery',
              body: 'Follow your order from the store to your doorstep.',
            },
          ],
        },
      },
      {
        type: 'why_grid',
        payload: {
          eyebrow: 'Why Shop on Movr',
          heading: 'Commerce that moves with you.',
          items: [
            {
              iconKey: 'heart',
              title: 'Neighbourhood first',
              body: 'Support local merchants who know your area.',
            },
            {
              iconKey: 'package',
              title: 'Delivery built in',
              body: 'Couriers on the same network as rides — fewer handoffs.',
            },
            {
              iconKey: 'wallet',
              title: 'One account',
              body: 'Rides, shopping, and payouts in a single Movr wallet.',
            },
          ],
        },
      },
      {
        type: 'rich_text',
        payload: {
          heading: 'Edit this page in Admin → CMS',
          paragraphs: [
            'Add banners, product stories, and merchant features here. Swap images and CTAs anytime from the CMS.',
          ],
        },
      },
      {
        type: 'final_cta',
        payload: {
          heading: 'Start shopping',
          body: 'Open the marketplace or partner with Movr as a merchant.',
          primaryCta: { label: 'Browse stores', href: '/marketplace' },
          secondaryCta: { label: 'For merchants', href: '/merchants' },
        },
      },
    ],
  },
  {
    slug: 'deliver',
    title: 'Deliver',
    status: 'published',
    meta: { path: '/deliver', menuLabel: 'Deliver' },
    sections: [
      {
        type: 'hero',
        payload: {
          eyebrow: 'Movr Deliver',
          headline: 'Send anything\nacross the city.',
          subhead:
            'Parcels, documents, and store orders — tracked from pickup to drop-off with verified couriers.',
          layout: 'split',
          backgroundImage: '/brand/movr-bike-in-motion.jpg',
          primaryCta: { label: 'Send a parcel', href: '/login' },
          secondaryCta: { label: 'Get the app', href: '/download' },
          showPhoneMock: false,
        },
      },
      {
        type: 'how_it_works',
        payload: {
          eyebrow: 'How Deliver works',
          heading: 'Pickup. Route. Confirm.',
          steps: [
            {
              number: '01',
              title: 'Create a delivery',
              body: 'Add pickup and drop-off, package size, and any special notes.',
            },
            {
              number: '02',
              title: 'Courier assigned',
              body: 'A nearby courier accepts and heads to pickup with live tracking.',
            },
            {
              number: '03',
              title: 'Proof of delivery',
              body: 'Recipient confirms; you get a receipt and status history.',
            },
          ],
        },
      },
      {
        type: 'why_grid',
        payload: {
          eyebrow: 'Why Deliver with Movr',
          heading: 'Logistics on the same rails.',
          items: [
            {
              iconKey: 'package',
              title: 'Same-day city moves',
              body: 'Built for dense African cities — motos and vans when you need them.',
            },
            {
              iconKey: 'sparkles',
              title: 'Live tracking',
              body: 'Share status with senders and recipients in real time.',
            },
            {
              iconKey: 'shield',
              title: 'Trusted couriers',
              body: 'Identity-verified riders on the Movr network.',
            },
          ],
        },
      },
      {
        type: 'rich_text',
        payload: {
          heading: 'Edit this page in Admin → CMS',
          paragraphs: [
            'Use this page for delivery use cases, pricing notes, and courier stories. All sections and media are CMS-editable.',
          ],
        },
      },
      {
        type: 'final_cta',
        payload: {
          heading: 'Send your next parcel',
          body: 'Log in to create a delivery or download the app.',
          primaryCta: { label: 'Send a parcel', href: '/login' },
          secondaryCta: { label: 'Download Movr', href: '/download' },
        },
      },
    ],
  },
  {
    slug: 'rentals',
    title: 'Rentals',
    status: 'published',
    meta: { path: '/rent', menuLabel: 'Rentals' },
    sections: [
      {
        type: 'hero',
        payload: {
          eyebrow: 'Movr Rentals',
          headline: 'A vehicle when\nyou need one.',
          subhead:
            'Self-drive or chauffeured rentals for days, weekends, or longer — booked in the same Movr account.',
          layout: 'split',
          backgroundImage: '/brand/movr-car-in-motion.jpg',
          primaryCta: { label: 'Explore rentals', href: '/login' },
          secondaryCta: { label: 'List your vehicle', href: '/login' },
          showPhoneMock: false,
        },
      },
      {
        type: 'how_it_works',
        payload: {
          eyebrow: 'How Rentals works',
          heading: 'Choose. Book. Drive.',
          steps: [
            {
              number: '01',
              title: 'Browse vehicles',
              body: 'Filter by type, price, and whether you want a chauffeur.',
            },
            {
              number: '02',
              title: 'Confirm your dates',
              body: 'See the total upfront — no surprise add-ons at pickup.',
            },
            {
              number: '03',
              title: 'Pick up & go',
              body: 'Meet the owner or chauffeur, start the trip, return when done.',
            },
          ],
        },
      },
      {
        type: 'why_grid',
        payload: {
          eyebrow: 'Why Rent with Movr',
          heading: 'Flexibility beyond a single trip.',
          items: [
            {
              iconKey: 'key',
              title: 'Self-drive or chauffeur',
              body: 'Pick the mode that matches your plans.',
            },
            {
              iconKey: 'car',
              title: 'City-ready fleet',
              body: 'Sedans, SUVs, and more from owners on Movr.',
            },
            {
              iconKey: 'wallet',
              title: 'Pay in-app',
              body: 'Same wallet and receipts as rides and shopping.',
            },
          ],
        },
      },
      {
        type: 'rich_text',
        payload: {
          heading: 'Edit this page in Admin → CMS',
          paragraphs: [
            'Add fleet photos, owner stories, and rental policies here. Public URL is /rent so it does not conflict with the in-app /rentals product.',
          ],
        },
      },
      {
        type: 'final_cta',
        payload: {
          heading: 'Need a vehicle?',
          body: 'Log in to browse rentals or list yours on Movr.',
          primaryCta: { label: 'Explore rentals', href: '/login' },
          secondaryCta: { label: 'Get the app', href: '/download' },
        },
      },
    ],
  },
  {
    slug: 'download',
    title: 'Get the app',
    status: 'published',
    sections: [
      {
        type: 'hero',
        payload: {
          headline: 'Get the Movr app',
          subhead: 'Available on iOS and Android',
          layout: 'centered',
          backgroundImage: '/brand/movr-wordmark.png',
          storeButtons: [
            { label: 'App Store', href: 'https://apps.apple.com' },
            { label: 'Google Play', href: 'https://play.google.com' },
          ],
          showPhoneMock: false,
        },
      },
    ],
  },
  {
    slug: 'help',
    title: 'Help centre',
    status: 'published',
    sections: [
      {
        type: 'help_hub',
        payload: {
          heading: 'How can we help?',
          searchPlaceholder: 'Search help articles',
          articles: [
            {
              id: 'ride',
              iconKey: 'car',
              title: 'Ride issues',
              body: 'Fare disputes, lost items, safety concerns.',
              keywords: 'ride fare dispute lost safety sos',
            },
            {
              id: 'order',
              iconKey: 'package',
              title: 'Order & delivery',
              body: 'Track orders, report a delivery issue.',
              keywords: 'order delivery track parcel shop',
            },
            {
              id: 'pay',
              iconKey: 'card',
              title: 'Payments & wallet',
              body: 'Refunds, payout issues, top-ups.',
              keywords: 'payment wallet refund payout top-up',
            },
          ],
        },
      },
    ],
  },
  {
    slug: 'help-ride',
    title: 'Ride help',
    status: 'published',
    sections: [
      {
        type: 'rich_text',
        payload: {
          heading: 'Ride issues',
          paragraphs: [
            'If your fare looks wrong, open the trip in History and tap Report a fare issue.',
            'Lost an item? Contact your driver from the trip screen within 24 hours, or message Support.',
            'For safety concerns, use in-app SOS during an active ride or contact local emergency services.',
          ],
        },
      },
    ],
  },
  {
    slug: 'help-order',
    title: 'Order help',
    status: 'published',
    sections: [
      {
        type: 'rich_text',
        payload: {
          heading: 'Order & delivery',
          paragraphs: [
            'Track live delivery from your order confirmation screen.',
            'If a parcel is late or damaged, open the order and tap Report an issue.',
          ],
        },
      },
    ],
  },
  {
    slug: 'help-pay',
    title: 'Payments help',
    status: 'published',
    sections: [
      {
        type: 'rich_text',
        payload: {
          heading: 'Payments & wallet',
          paragraphs: [
            'Top up from Wallet using mobile money or card.',
            'Refunds appear in your wallet currency within 1–3 business days after approval.',
          ],
        },
      },
    ],
  },
  // Play Store + compliance pack (editable in Admin → Site content)
  ...PLAYSTORE_CMS_PAGES,
  {
    slug: 'onboarding',
    title: 'Onboarding intro',
    status: 'published',
    sections: [
      {
        type: 'onboarding_slides',
        payload: {
          slides: [
            {
              title: 'Ride, shop, and deliver — all in one app',
              body: 'Book a ride, order from local stores, or send a parcel, all from the same place.',
              iconKey: 'van',
            },
            {
              title: 'Pay with wallet, MoMo, or card',
              body: 'Top up once and use Movr across rides, orders, and deliveries.',
              iconKey: 'wallet',
            },
            {
              title: 'Earn points on every trip',
              body: 'Redeem loyalty points for ride credit and discounts.',
              iconKey: 'points',
            },
          ],
          cta: { label: 'Get started', href: '/register' },
        },
      },
    ],
  },
  {
    slug: 'ai',
    title: 'Movr AI',
    status: 'published',
    sections: [
      {
        type: 'hero',
        payload: {
          headline: 'Movr AI',
          subhead: 'Talk. Don’t tap. Book rides, find stores, and escalate to live agents.',
          layout: 'centered',
          backgroundImage: '/brand/movr-car-in-motion.jpg',
          showPhoneMock: false,
        },
      },
    ],
  },
  {
    slug: 'about',
    title: 'About Movr',
    status: 'published',
    sections: [
      {
        type: 'hero',
        payload: {
          headline: 'Built for Africa',
          subhead:
            'Movr is the super-app for rides, local shopping, and delivery — priced in your local currency.',
          layout: 'centered',
          backgroundImage: '/brand/movr-car-in-motion.jpg',
          primaryCta: { label: 'Get the app', href: '/download' },
          showPhoneMock: false,
        },
      },
      {
        type: 'rich_text',
        payload: {
          heading: 'Our mission',
          paragraphs: [
            'We connect riders, drivers, and merchants across African cities on one platform.',
            'Drivers keep 100% of every fare with a simple subscription. Merchants get storefronts, delivery, and payouts.',
          ],
        },
      },
    ],
  },
  {
    slug: 'not-found',
    title: '404 Not found',
    status: 'published',
    sections: [
      {
        type: 'hero',
        payload: {
          headline: 'Page not found',
          subhead: 'That link doesn’t exist or has moved.',
          layout: 'centered',
          primaryCta: { label: 'Go home', href: '/' },
          showPhoneMock: false,
        },
      },
    ],
  },
  {
    slug: 'no-connection',
    title: 'No connection',
    status: 'published',
    sections: [
      {
        type: 'hero',
        payload: {
          headline: 'No connection',
          subhead:
            'Check your internet connection and try again. You can still book by SMS or a call.',
          layout: 'centered',
          primaryCta: { label: 'Retry', href: '/' },
          showPhoneMock: false,
        },
      },
    ],
  },
  {
    slug: 'claim-transfer',
    title: 'Claim transfer',
    status: 'published',
    sections: [
      {
        type: 'hero',
        payload: {
          headline: 'You’ve received money',
          subhead: 'Create an account or log in to claim this transfer to your Movr wallet.',
          layout: 'centered',
          primaryCta: { label: 'Claim now', href: '/register' },
          secondaryCta: { label: 'Log in', href: '/login' },
          showPhoneMock: false,
        },
      },
    ],
  },
];

async function ensureTables(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cms_pages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      slug VARCHAR(64) NOT NULL UNIQUE,
      title VARCHAR(256) NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'draft',
      locale VARCHAR(16) NOT NULL DEFAULT 'en',
      meta JSONB NOT NULL DEFAULT '{}'::jsonb,
      published_at TIMESTAMPTZ,
      updated_by UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS cms_sections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      page_id UUID NOT NULL REFERENCES cms_pages(id) ON DELETE CASCADE,
      type VARCHAR(64) NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

export async function seedCms(db?: DatabaseService, opts: { overwrite?: boolean } = {}) {
  const overwrite = opts.overwrite !== false; // seed script overwrites by default
  const ownPool =
    !db &&
    new Pool({
      connectionString: process.env.DATABASE_URL,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT || 5432),
      database: process.env.DB_NAME || 'movr',
    });

  if (ownPool) await ensureTables(ownPool);

  const service = new CmsService(db || new DatabaseService());
  let created = 0;
  let updated = 0;
  for (const page of CMS_SEED) {
    const existing = await service.getPageBySlug(page.slug, { publishedOnly: false });
    const wantPack = page.meta?.playstorePack;
    const havePack = existing?.meta?.playstorePack;
    const adminLocked = Boolean(existing?.meta?.adminLocked);
    const shouldRefreshPack =
      Boolean(wantPack) && !adminLocked && existing && havePack !== wantPack;
    if (existing && !overwrite && !shouldRefreshPack) {
      continue;
    }
    await service.upsertPage({
      slug: page.slug,
      title: page.title,
      status: page.status,
      meta: page.meta || {},
      sections: page.sections.map((s, i) => ({
        type: s.type,
        sortOrder: i,
        enabled: true,
        payload: s.payload,
      })),
    });
    if (existing) updated += 1;
    else created += 1;
    console.log(`CMS seeded: ${page.slug}${shouldRefreshPack ? ' (playstore pack refresh)' : ''}`);
  }

  if (ownPool) await ownPool.end();
  return { created, updated, total: CMS_SEED.length };
}

/** Insert any missing default pages without overwriting admin edits. */
export async function ensureCmsDefaults(db?: DatabaseService) {
  const result = await seedCms(db, { overwrite: false });
  const service = new CmsService(db || new DatabaseService());

  // Ensure homepage booking engine exists even if home was seeded earlier
  try {
    const home = await service.getPageBySlug('home', { publishedOnly: false });
    const seedHome = CMS_SEED.find((p) => p.slug === 'home');
    const bookingSeed = seedHome?.sections?.find((s) => s.type === 'booking_engine');
    if (home?.sections && bookingSeed) {
      const sections = [...home.sections];
      const idx = sections.findIndex((s: any) => s.type === 'booking_engine');
      if (idx < 0) {
        const heroIdx = sections.findIndex(
          (s: any) => s.type === 'choice_hero' || s.type === 'hero'
        );
        const insertAt = heroIdx >= 0 ? heroIdx + 1 : 0;
        sections.splice(insertAt, 0, {
          type: 'booking_engine',
          sortOrder: insertAt,
          enabled: true,
          payload: bookingSeed.payload,
        } as any);
        await service.upsertPage({
          slug: 'home',
          title: home.title || 'Homepage',
          status: home.status || 'published',
          sections: sections.map((s: any, i: number) => ({
            type: s.type,
            sortOrder: i,
            enabled: s.enabled !== false,
            payload: s.payload || {},
          })),
        });
        console.log('CMS: injected booking_engine into home');
      } else if (!sections[idx].payload?.mapImageUrl) {
        // Upgrade legacy booking_engine to compare-travel layout defaults (keep admin text if set)
        sections[idx] = {
          ...sections[idx],
          payload: {
            ...bookingSeed.payload,
            ...sections[idx].payload,
            mapImageUrl:
              sections[idx].payload?.mapImageUrl || bookingSeed.payload.mapImageUrl,
            formTitle: sections[idx].payload?.formTitle || bookingSeed.payload.formTitle,
            headline:
              sections[idx].payload?.headline === 'Go anywhere with Movr' ||
              !sections[idx].payload?.headline
                ? bookingSeed.payload.headline
                : sections[idx].payload.headline,
            subhead:
              sections[idx].payload?.subhead?.includes('local currency') ||
              !sections[idx].payload?.subhead
                ? bookingSeed.payload.subhead
                : sections[idx].payload.subhead,
          },
        };
        await service.upsertPage({
          slug: 'home',
          title: home.title || 'Homepage',
          status: home.status || 'published',
          sections: sections.map((s: any, i: number) => ({
            type: s.type,
            sortOrder: i,
            enabled: s.enabled !== false,
            payload: s.payload || {},
          })),
        });
        console.log('CMS: upgraded booking_engine compare-travel payload');
      }
    }
  } catch (e: any) {
    console.warn(`CMS booking_engine inject: ${e?.message || e}`);
  }

  // Ensure merchants page has Uber-style business_split hero
  try {
    const merchants = await service.getPageBySlug('merchants', { publishedOnly: false });
    const seedMerchants = CMS_SEED.find((p) => p.slug === 'merchants');
    const splitSeed = seedMerchants?.sections?.find((s) => s.type === 'business_split');
    if (merchants?.sections && splitSeed && !merchants.sections.some((s: any) => s.type === 'business_split')) {
      const sections = [...merchants.sections];
      // Replace leading choice_hero with business_split, else prepend
      const choiceIdx = sections.findIndex((s: any) => s.type === 'choice_hero');
      if (choiceIdx === 0) {
        sections[0] = {
          type: 'business_split',
          sortOrder: 0,
          enabled: true,
          payload: splitSeed.payload,
        } as any;
      } else {
        sections.unshift({
          type: 'business_split',
          sortOrder: 0,
          enabled: true,
          payload: splitSeed.payload,
        } as any);
      }
      // Ensure solutions anchor on why_grid
      const why = sections.find((s: any) => s.type === 'why_grid');
      if (why?.payload && !why.payload.anchorId) {
        why.payload = { ...why.payload, anchorId: 'solutions' };
      }
      await service.upsertPage({
        slug: 'merchants',
        title: merchants.title || 'For merchants',
        status: merchants.status || 'published',
        sections: sections.map((s: any, i: number) => ({
          type: s.type,
          sortOrder: i,
          enabled: s.enabled !== false,
          payload: s.payload || {},
        })),
      });
      console.log('CMS: injected business_split into merchants');
    }
  } catch (e: any) {
    console.warn(`CMS business_split inject: ${e?.message || e}`);
  }

  // Drop duplicate "Delete account" from footer legalLinks (kept under SUPPORT)
  try {
    const global = await service.getPageBySlug('global', { publishedOnly: false });
    const footerIdx = global?.sections?.findIndex((s: any) => s.type === 'footer') ?? -1;
    if (global?.sections && footerIdx >= 0) {
      const legalLinks = global.sections[footerIdx].payload?.legalLinks;
      if (
        Array.isArray(legalLinks) &&
        legalLinks.some(
          (l: any) =>
            /delete.?account/i.test(String(l?.label || '')) ||
            /delete-account/i.test(String(l?.href || ''))
        )
      ) {
        const sections = [...global.sections];
        sections[footerIdx] = {
          ...sections[footerIdx],
          payload: {
            ...sections[footerIdx].payload,
            legalLinks: legalLinks.filter(
              (l: any) =>
                !/delete.?account/i.test(String(l?.label || '')) &&
                !/delete-account/i.test(String(l?.href || ''))
            ),
          },
        };
        await service.upsertPage({
          slug: 'global',
          title: global.title || 'Site chrome (nav + footer)',
          status: global.status || 'published',
          sections: sections.map((s: any, i: number) => ({
            type: s.type,
            sortOrder: i,
            enabled: s.enabled !== false,
            payload: s.payload || {},
          })),
        });
        console.log('CMS: removed duplicate Delete account from footer legalLinks');
      }
    }
  } catch (e: any) {
    console.warn(`CMS footer legalLinks cleanup: ${e?.message || e}`);
  }

  // Point Services footer/nav links at dedicated marketing pages (not homepage hashes)
  try {
    const hrefMap: Record<string, string> = {
      '/#ride': '/ride',
      '#ride': '/ride',
      '/#shop': '/shop',
      '#shop': '/shop',
      '/#deliver': '/deliver',
      '#deliver': '/deliver',
      '/#rentals': '/rent',
      '#rentals': '/rent',
    };
    const remapHref = (href?: string) => {
      const h = String(href || '').trim();
      return hrefMap[h] || h;
    };
    const remapLinks = (links: any[]) =>
      (links || []).map((l) => ({ ...l, href: remapHref(l?.href) }));

    const global = await service.getPageBySlug('global', { publishedOnly: false });
    if (global?.sections?.length) {
      let changed = false;
      const dropFromNav = /^(ride|shop|deliver)$/i;
      const sections = global.sections.map((s: any) => {
        if (s.type === 'nav' && Array.isArray(s.payload?.links)) {
          const remapped = remapLinks(s.payload.links);
          // Services live in the footer — keep header to AI / Drivers / Merchants / About
          const next = remapped.filter(
            (l: any) =>
              !dropFromNav.test(String(l?.label || '').trim()) &&
              !['/ride', '/shop', '/deliver'].includes(String(l?.href || '').trim())
          );
          if (JSON.stringify(next) !== JSON.stringify(s.payload.links)) {
            changed = true;
            return { ...s, payload: { ...s.payload, links: next } };
          }
        }
        if (s.type === 'footer' && Array.isArray(s.payload?.columns)) {
          const columns = s.payload.columns.map((col: any) => ({
            ...col,
            links: remapLinks(col.links || []),
          }));
          if (JSON.stringify(columns) !== JSON.stringify(s.payload.columns)) {
            changed = true;
            return { ...s, payload: { ...s.payload, columns } };
          }
        }
        return s;
      });
      if (changed) {
        await service.upsertPage({
          slug: 'global',
          title: global.title || 'Site chrome (nav + footer)',
          status: global.status || 'published',
          sections: sections.map((s: any, i: number) => ({
            type: s.type,
            sortOrder: i,
            enabled: s.enabled !== false,
            payload: s.payload || {},
          })),
        });
        console.log('CMS: updated nav/footer service links (services in footer only)');
      }
    }

    const home = await service.getPageBySlug('home', { publishedOnly: false });
    if (home?.sections?.length) {
      let changed = false;
      const sections = home.sections.map((s: any) => {
        if (s.type === 'product_grid' && Array.isArray(s.payload?.items)) {
          const items = s.payload.items.map((it: any) => ({
            ...it,
            href: remapHref(it?.href) || it?.href,
          }));
          // Also upgrade legacy login/marketplace CTAs for the four service cards
          const byTitle: Record<string, string> = {
            ride: '/ride',
            shop: '/shop',
            deliver: '/deliver',
            rentals: '/rent',
          };
          const upgraded = items.map((it: any) => {
            const key = String(it.title || '').toLowerCase();
            if (byTitle[key] && (it.href === '/login' || it.href === '/marketplace' || !it.href)) {
              return { ...it, href: byTitle[key] };
            }
            return it;
          });
          if (JSON.stringify(upgraded) !== JSON.stringify(s.payload.items)) {
            changed = true;
            return { ...s, payload: { ...s.payload, items: upgraded } };
          }
        }
        return s;
      });
      if (changed) {
        await service.upsertPage({
          slug: 'home',
          title: home.title || 'Homepage',
          status: home.status || 'published',
          sections: sections.map((s: any, i: number) => ({
            type: s.type,
            sortOrder: i,
            enabled: s.enabled !== false,
            payload: s.payload || {},
          })),
        });
        console.log('CMS: remapped home product_grid service card links');
      }
    }
  } catch (e: any) {
    console.warn(`CMS service link remap: ${e?.message || e}`);
  }

  // Heroes use motion brand art; cards/grids keep stock stills
  try {
    const heroCar = '/brand/movr-car-in-motion.jpg';
    const heroBike = '/brand/movr-bike-in-motion.jpg';
    const carStills = new Set([
      '/brand/ride-sedan.png',
      '/brand/ride-sedan.png',
      '/brand/movr-car-in-motion.jpg',
    ]);
    const bikeStills = new Set([
      '/brand/courier-moto.png',
      '/brand/courier-moto.png',
      '/brand/movr-bike-in-motion.jpg',
    ]);
    const carHeroSlugs = new Set(['home', 'ride', 'rentals', 'about', 'ai', 'features', 'contact']);
    const bikeHeroSlugs = new Set(['drivers', 'deliver']);
    const slugs = [
      'home',
      'ride',
      'shop',
      'deliver',
      'rentals',
      'about',
      'ai',
      'drivers',
      'features',
      'contact',
    ];
    for (const slug of slugs) {
      const page = await service.getPageBySlug(slug, { publishedOnly: false });
      if (!page?.sections?.length) continue;
      let changed = false;
      const sections = page.sections.map((s: any) => {
        const payload = { ...(s.payload || {}) };
        const isHero = s.type === 'hero' || s.type === 'choice_hero' || s.type === 'business_split';
        if (isHero && payload.backgroundImage) {
          const bg = String(payload.backgroundImage);
          if (carHeroSlugs.has(slug) && (carStills.has(bg) || bg.includes('ride-sedan'))) {
            if (payload.backgroundImage !== heroCar) {
              payload.backgroundImage = heroCar;
              changed = true;
            }
          }
          if (bikeHeroSlugs.has(slug) && (bikeStills.has(bg) || bg.includes('courier-moto'))) {
            if (payload.backgroundImage !== heroBike) {
              payload.backgroundImage = heroBike;
              changed = true;
            }
          }
        }
        // Card/choice images: always stock stills (not motion heroes)
        const fixUrl = (url?: string) => {
          const u = String(url || '');
          if (u === '/brand/ride-sedan.png' || u === heroCar) return '/brand/ride-sedan.png';
          if (u === '/brand/courier-moto.png' || u === heroBike) return '/brand/courier-moto.png';
          return url;
        };
        if (payload.imageUrl && !isHero) {
          const next = fixUrl(payload.imageUrl);
          if (next !== payload.imageUrl) {
            payload.imageUrl = next;
            changed = true;
          }
        }
        if (Array.isArray(payload.items)) {
          const items = payload.items.map((it: any) => {
            const hrefImg = fixUrl(it.imageUrl);
            if (hrefImg !== it.imageUrl) {
              changed = true;
              return { ...it, imageUrl: hrefImg };
            }
            return it;
          });
          payload.items = items;
        }
        if (Array.isArray(payload.choices)) {
          const choices = payload.choices.map((it: any) => {
            const hrefImg = fixUrl(it.imageUrl);
            if (hrefImg !== it.imageUrl) {
              changed = true;
              return { ...it, imageUrl: hrefImg };
            }
            return it;
          });
          payload.choices = choices;
        }
        return changed ? { ...s, payload } : s;
      });
      // Recompute changed flag properly — map above mutates `changed`
      if (changed) {
        await service.upsertPage({
          slug,
          title: page.title || slug,
          status: page.status || 'published',
          sections: sections.map((s: any, i: number) => ({
            type: s.type,
            sortOrder: i,
            enabled: s.enabled !== false,
            payload: s.payload || {},
          })),
        });
        console.log(`CMS: hero motion + still cards for ${slug}`);
      }
    }
  } catch (e: any) {
    console.warn(`CMS hero motion asset update: ${e?.message || e}`);
  }

  return result;
}

if (require.main === module) {
  seedCms()
    .then((r) => {
      console.log('CMS seed complete', r);
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
