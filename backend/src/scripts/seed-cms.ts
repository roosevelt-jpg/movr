/**
 * Seed Movr CMS pages from the homepage / marketing mockups.
 * Run: pnpm --filter @movr/backend run db:seed-cms
 */
import path from 'path';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { DatabaseService } from '../services/database.service';
import { CmsService } from '../services/cms.service';

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
          links: [
            { label: 'Ride', href: '/#ride' },
            { label: 'Shop', href: '/#shop' },
            { label: 'Deliver', href: '/#deliver' },
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
          social: [
            { key: 'share', href: '/download', label: 'Share' },
            { key: 'mail', href: '/contact', label: 'Email' },
            { key: 'community', href: '/about', label: 'Community' },
          ],
          columns: [
            {
              title: 'SERVICES',
              links: [
                { label: 'Ride', href: '/#ride' },
                { label: 'Shop', href: '/#shop' },
                { label: 'Deliver', href: '/#deliver' },
                { label: 'Rentals', href: '/#rentals' },
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
                { label: 'Contact us', href: '/contact' },
                { label: 'Safety', href: '/help' },
                { label: 'Terms of Service', href: '/terms' },
                { label: 'Privacy Policy', href: '/privacy' },
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
            { label: 'Cookies', href: '/privacy' },
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
          choices: [
            {
              emoji: '🚗',
              title: 'I need a ride',
              body: 'Cars, bikes, and tricycles on demand — tracked live.',
              cta: 'Book a ride',
              href: '/login',
            },
            {
              emoji: '🏪',
              title: 'I run a business',
              body: 'Sell in-app, deliver with Movr, get paid fast.',
              cta: 'Open a storefront',
              href: '/merchants',
            },
          ],
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
              href: '/login',
            },
            {
              iconKey: 'heart',
              eyebrow: 'Commerce',
              title: 'Shop',
              body: 'Buy from local stores with delivery to your door.',
              cta: 'Browse stores',
              href: '/marketplace',
            },
            {
              iconKey: 'package',
              eyebrow: 'Logistics',
              title: 'Deliver',
              body: 'Parcels and orders tracked from pickup to drop-off.',
              cta: 'Send a parcel',
              href: '/login',
            },
            {
              iconKey: 'key',
              eyebrow: 'Mobility',
              title: 'Rentals',
              body: 'Self-drive or chauffeured vehicles when you need them.',
              cta: 'Explore rentals',
              href: '/#rentals',
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
            },
            {
              quote:
                'I keep everything I earn. The subscription pays for itself in two days.',
              name: 'Enoch',
              role: 'Driver · Accra',
            },
            {
              quote:
                'Orders come straight to my phone. Delivery is handled — I just focus on the shop.',
              name: 'Boutique 22',
              role: 'Merchant · Osu',
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
        type: 'choice_hero',
        payload: {
          eyebrow: 'Movr for merchants',
          headline: 'Sell faster with an\nin-app storefront.',
          subhead:
            'Order management, live delivery tracking, and instant payouts — all from one dashboard.',
          choices: [
            {
              emoji: '🛍️',
              title: 'Create your storefront',
              body: 'List products, set hours, and go live in minutes.',
              cta: 'Start onboarding',
              href: '/merchant/onboarding',
            },
            {
              emoji: '📦',
              title: 'I already sell',
              body: 'Connect delivery and get paid to bank or mobile money.',
              cta: 'Merchant login',
              href: '/merchant/login',
            },
          ],
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
          choices: [
            {
              emoji: '🔑',
              title: 'Become a driver',
              body: 'Verify your identity and start earning on your schedule.',
              cta: 'Apply now',
              href: '/register?role=driver',
            },
            {
              emoji: '📱',
              title: 'I already drive',
              body: 'Log in to accept trips and track your earnings.',
              cta: 'Driver login',
              href: '/login',
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
  {
    slug: 'terms',
    title: 'Terms of Service',
    status: 'published',
    sections: [
      {
        type: 'legal',
        payload: {
          heading: 'Terms of Service',
          updatedLabel: 'Last updated July 2026',
          clauses: [
            {
              title: '1. Introduction',
              body: 'These terms govern your use of the Movr platform across ride, shop, deliver, and rental services.',
            },
            {
              title: '2. Eligibility',
              body: 'You must be verified to use certain features including payments and driving.',
            },
            {
              title: '3. Payments',
              body: 'Transactions are processed through our payment partners in accordance with local regulations.',
            },
            {
              title: '4. Conduct',
              body: 'You agree not to misuse the platform, harass other users, or attempt to circumvent safety or identity checks.',
            },
            {
              title: '5. Liability',
              body: 'Movr provides the marketplace and matching services; service providers remain responsible for their services.',
            },
          ],
        },
      },
    ],
  },
  {
    slug: 'privacy',
    title: 'Privacy Policy',
    status: 'published',
    sections: [
      {
        type: 'legal',
        payload: {
          heading: 'Privacy Policy',
          updatedLabel: 'Last updated July 2026',
          clauses: [
            {
              title: '1. Data we collect',
              body: 'Account details, location during trips, payment tokens, and device information needed to operate the service.',
            },
            {
              title: '2. How we use data',
              body: 'To match rides and deliveries, prevent fraud, improve the product, and meet legal obligations.',
            },
            {
              title: '3. Sharing',
              body: 'We share data with drivers, merchants, and payment partners only as needed to fulfill your request.',
            },
            {
              title: '4. Your rights',
              body: 'You may request access, correction, or deletion of personal data subject to local law.',
            },
          ],
        },
      },
    ],
  },
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
              body: 'Redeem rewards or convert points when DVT launches.',
              iconKey: 'points',
            },
          ],
          cta: { label: 'Get started', href: '/register' },
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
    if (existing && !overwrite) {
      continue;
    }
    await service.upsertPage({
      slug: page.slug,
      title: page.title,
      status: page.status,
      sections: page.sections.map((s, i) => ({
        type: s.type,
        sortOrder: i,
        enabled: true,
        payload: s.payload,
      })),
    });
    if (existing) updated += 1;
    else created += 1;
    console.log(`CMS seeded: ${page.slug}`);
  }

  if (ownPool) await ownPool.end();
  return { created, updated, total: CMS_SEED.length };
}

/** Insert any missing default pages without overwriting admin edits. */
export async function ensureCmsDefaults(db?: DatabaseService) {
  return seedCms(db, { overwrite: false });
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
