/**
 * Play Store + compliance CMS pages — editable in Admin → Site content.
 * Defaults are production-shaped; legal counsel should review before launch.
 */
export const PLAYSTORE_CMS_PAGES: Array<{
  slug: string;
  title: string;
  status: 'published' | 'draft';
  meta?: Record<string, unknown>;
  sections: Array<{ type: string; payload: Record<string, unknown> }>;
}> = [
  {
    slug: 'terms',
    title: 'Terms of Service',
    status: 'published',
    meta: { playstorePack: 1, category: 'legal' },
    sections: [
      {
        type: 'legal',
        payload: {
          heading: 'Terms of Service',
          updatedLabel: 'Last updated August 2026 · mymovr.io',
          clauses: [
            {
              title: '1. Agreement',
              body: 'By creating a Movr account or using mymovr.io, the Movr customer app, driver app, or related channels (WhatsApp, SMS, USSD, voice), you agree to these Terms. If you do not agree, do not use Movr.',
            },
            {
              title: '2. The Movr platform',
              body: 'Movr provides software that connects riders, drivers, merchants, and delivery partners. Movr is not a transportation carrier or employer of independent drivers unless required by local law. Service providers are responsible for the services they deliver.',
            },
            {
              title: '3. Eligibility & accounts',
              body: 'You must be old enough to form a binding contract in your country (generally 18+) to use paid features. Drivers and merchants may need additional identity and vehicle verification. You are responsible for keeping login credentials secure.',
            },
            {
              title: '4. Rides, share pools & channels',
              body: 'Fare estimates are indicative until a trip is completed. Share pools may wait for additional riders before assigning one vehicle and splitting fares. Bookings via voice, WhatsApp, or other channels use the same platform rules as in-app bookings.',
            },
            {
              title: '5. Payments, wallet & ride credit',
              body: 'Payments may be processed by partners such as Paystack, Flutterwave, or Stripe. Mobile money and card top-ups credit your Movr wallet or mobility credit. Family circle members may spend within limits set by the circle owner. Refunds follow our Refund Policy.',
            },
            {
              title: '6. Driver subscription & earnings',
              body: 'Where offered, drivers keep 100% of trip fares subject to a platform subscription and applicable taxes. Income floor guarantees, if enrolled, follow the terms shown at enrollment.',
            },
            {
              title: '7. Acceptable use & safety',
              body: 'You must not harass others, commit fraud, circumvent identity or safety checks, scrape the service, or use Movr for illegal activity. We may suspend accounts that violate these Terms or create safety risk.',
            },
            {
              title: '8. Location & communications',
              body: 'Trip matching requires location while you request or take a trip. We may send transactional SMS, push, WhatsApp, or email about your bookings, security, and account.',
            },
            {
              title: '9. Disclaimers & liability',
              body: 'THE SERVICE IS PROVIDED “AS IS”. To the fullest extent permitted by law, Movr’s liability is limited to the fees you paid to Movr in the three months before the claim. Some jurisdictions do not allow certain limitations.',
            },
            {
              title: '10. Governing law & contact',
              body: 'These Terms are governed by the laws of the Republic of Ghana, without prejudice to mandatory consumer protections where you live. Contact: support@mymovr.io · Legal: legal@mymovr.io · https://mymovr.io/support',
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
    meta: { playstorePack: 1, category: 'legal' },
    sections: [
      {
        type: 'legal',
        payload: {
          heading: 'Privacy Policy',
          updatedLabel: 'Last updated August 2026 · mymovr.io',
          clauses: [
            {
              title: '1. Who we are',
              body: 'Movr Global Technologies operates the Movr apps and https://mymovr.io (including api.mymovr.io). This policy explains what personal data we process and why. Contact: privacy@mymovr.io.',
            },
            {
              title: '2. Data we collect',
              body: 'Account data (name, phone, email, country); profile and KYC documents when required; precise location during trip request, matching, and active trips; approximate location for city defaults; payment tokens and wallet ledgers (we do not store full card PAN); device identifiers, app version, crash logs; chat/support messages; voice transcripts when you use voice booking; contacts you choose to share for referrals or family circles.',
            },
            {
              title: '3. How we use data',
              body: 'To create and secure accounts; match rides, deliveries, and share pools; process payments and payouts; prevent fraud and abuse; provide customer support; improve product quality; meet legal and regulatory duties; send service messages. Marketing messages require consent where required by law.',
            },
            {
              title: '4. Sharing',
              body: 'We share data with: the other party to your trip or order (e.g. driver name/vehicle, pickup); payment processors (Paystack, Flutterwave, Stripe); SMS/WhatsApp/email providers (e.g. Twilio, SendGrid); maps and places providers; cloud hosting and error monitoring; regulators when legally required. We do not sell personal data.',
            },
            {
              title: '5. Retention',
              body: 'We keep account data while your account is active. Trip and payment records are retained as required for tax, dispute, and safety obligations (typically several years). You may request deletion; see Delete account at https://mymovr.io/delete-account.',
            },
            {
              title: '6. Security',
              body: 'We use encryption in transit, access controls, and credential vaulting for third-party API keys. No method of transmission is 100% secure.',
            },
            {
              title: '7. Your rights',
              body: 'Depending on your country, you may request access, correction, deletion, portability, or restriction of processing. Email privacy@mymovr.io. You may also lodge a complaint with your local data protection authority.',
            },
            {
              title: '8. Children',
              body: 'Movr is not directed at children under 13 (or the higher age required in your country). We do not knowingly collect data from children for accounts.',
            },
            {
              title: '9. International transfers',
              body: 'Data may be processed in Ghana and other countries where our providers operate, with appropriate safeguards.',
            },
            {
              title: '10. Changes',
              body: 'We will update this page and revise the “Last updated” label when material changes occur. Continued use after changes means you accept the updated policy where permitted by law.',
            },
          ],
        },
      },
    ],
  },
  {
    slug: 'cookies',
    title: 'Cookie Policy',
    status: 'published',
    meta: { playstorePack: 1, category: 'legal' },
    sections: [
      {
        type: 'legal',
        payload: {
          heading: 'Cookie Policy',
          updatedLabel: 'Last updated August 2026',
          clauses: [
            {
              title: '1. What we use',
              body: 'The Movr website uses essential cookies and local storage for login sessions, security, language/currency preferences, and load balancing. We may use analytics cookies to understand traffic if enabled in Admin settings.',
            },
            {
              title: '2. Mobile apps',
              body: 'Native apps use device storage and OS identifiers similarly to cookies (session tokens, preference flags, push tokens). See the Privacy Policy for details.',
            },
            {
              title: '3. Your choices',
              body: 'You can block non-essential cookies in your browser. Essential cookies are required for signed-in features to work. Contact privacy@mymovr.io for questions.',
            },
          ],
        },
      },
    ],
  },
  {
    slug: 'delete-account',
    title: 'Delete your Movr account',
    status: 'published',
    meta: { playstorePack: 1, category: 'legal', googlePlayRequired: true },
    sections: [
      {
        type: 'rich_text',
        payload: {
          heading: 'Delete your Movr account',
          paragraphs: [
            'Google Play and App Store policies require a clear way to request account deletion. Use the form below or email support@mymovr.io from your registered address with subject “Account deletion”.',
            'When we verify your request we will delete or anonymize personal account data, subject to records we must keep for trips, payments, disputes, fraud prevention, and law (usually retained in limited form).',
            'Driver and merchant accounts may need extra verification before closure. Wallet balances should be withdrawn before deletion where possible.',
          ],
        },
      },
      {
        type: 'form',
        payload: {
          heading: 'Account deletion request',
          formKey: 'delete_account',
          submitLabel: 'Submit deletion request',
          successMessage:
            'Request received. We will confirm by email or SMS within 30 days (usually sooner).',
          fields: [
            { name: 'full_name', label: 'Full name', type: 'text', required: true },
            { name: 'email', label: 'Account email', type: 'email', required: true },
            { name: 'phone', label: 'Account phone', type: 'tel', required: true },
            {
              name: 'user_type',
              label: 'Account type (customer / driver / merchant)',
              type: 'text',
              required: true,
            },
            {
              name: 'reason',
              label: 'Optional reason',
              type: 'textarea',
              required: false,
            },
          ],
        },
      },
    ],
  },
  {
    slug: 'data-safety',
    title: 'Google Play Data safety',
    status: 'published',
    meta: { playstorePack: 1, category: 'store', googlePlayRequired: true },
    sections: [
      {
        type: 'rich_text',
        payload: {
          heading: 'Data safety summary (Google Play)',
          paragraphs: [
            'Use this page when filling the Play Console Data safety form. Edit any line in Admin → Site content → data-safety before submission.',
          ],
        },
      },
      {
        type: 'legal',
        payload: {
          heading: 'Declarations',
          updatedLabel: 'Aligned with Movr Privacy Policy · August 2026',
          clauses: [
            {
              title: 'Data collected',
              body: 'Personal info: name, email, phone, user IDs. Location: approximate and precise (while using ride features). Financial info: purchase history, payment info via processors (tokenized). Photos/videos: if you upload profile or support media. App activity: in-app search, interactions. Device IDs & crash logs. Messages: in-app chat / support / voice booking transcripts.',
            },
            {
              title: 'Data shared',
              body: 'Shared with other users of the service as needed for trips/orders; with payment, messaging, maps, and hosting providers listed in Privacy Policy. Not sold. Not used for undeclared third-party advertising by default.',
            },
            {
              title: 'Security practices',
              body: 'Data encrypted in transit (TLS). Users can request deletion. Committed to follow Play Families / child policies — app is not targeted at children.',
            },
            {
              title: 'Privacy policy URL',
              body: 'https://mymovr.io/privacy',
            },
            {
              title: 'Account deletion URL',
              body: 'https://mymovr.io/delete-account',
            },
          ],
        },
      },
    ],
  },
  {
    slug: 'app-permissions',
    title: 'App permissions',
    status: 'published',
    meta: { playstorePack: 2, category: 'store' },
    sections: [
      {
        type: 'legal',
        payload: {
          heading: 'Why Movr asks for permissions',
          updatedLabel: 'Customer & driver Android / iOS',
          clauses: [
            {
              title: 'Location (precise)',
              body: 'Required to show nearby drivers, set pickup points, share trip progress, and complete deliveries. The driver app uses a foreground notification to share location only while the driver is online or on a trip. We do not request Android background location when the app is fully closed.',
            },
            {
              title: 'Notifications',
              body: 'Trip status, driver arrival, chat messages, security alerts, and payment receipts.',
            },
            {
              title: 'Camera / photos',
              body: 'Optional profile photo, merchant product images, KYC document capture, and support attachments.',
            },
            {
              title: 'Microphone',
              body: 'Optional voice booking and in-app support. Not recorded without you starting a voice action.',
            },
            {
              title: 'Phone (call)',
              body: 'Optional masked calling between rider and driver via our telephony partner.',
            },
          ],
        },
      },
    ],
  },
  {
    slug: 'play-store-listing',
    title: 'Play Store listing copy',
    status: 'published',
    meta: { playstorePack: 1, category: 'store' },
    sections: [
      {
        type: 'rich_text',
        payload: {
          heading: 'Google Play listing (edit freely)',
          paragraphs: [
            'Short description (80 chars max): Move. Shop. Deliver. Rides & local commerce across Africa.',
            'Full description: Movr is the African super-app for rides (including okada & shared), local shopping, parcels, and rentals. Pay with mobile money or card, keep ride credit in your wallet, and book by app, WhatsApp, or voice. Drivers keep 100% of fares with a simple subscription. Family circles let you fund rides for loved ones. Download Movr and move your city forward.',
            'App name: Movr',
            'Package name: io.movr.app',
            'Category: Maps & Navigation / Travel',
            'Tags: ride hailing, mobile money, delivery, Africa',
            'Support URL: https://mymovr.io/support',
            'Privacy: https://mymovr.io/privacy',
            'Delete account: https://mymovr.io/delete-account',
          ],
        },
      },
      {
        type: 'rich_text',
        payload: {
          heading: 'Driver app listing',
          paragraphs: [
            'App name: Movr Driver',
            'Suggested package: io.movr.driver',
            'Short description: Drive with Movr — keep 100% of fares, destination mode, income floor.',
            'Full description: Go online, accept offers, navigate trips, track earnings, set destination preferences, and enroll in income floor guarantees. Withdraw via mobile money. 0% take-rate on fares with a transparent subscription.',
          ],
        },
      },
    ],
  },
  {
    slug: 'refund-policy',
    title: 'Refund Policy',
    status: 'published',
    meta: { playstorePack: 1, category: 'legal' },
    sections: [
      {
        type: 'legal',
        payload: {
          heading: 'Refund Policy',
          updatedLabel: 'Last updated August 2026',
          clauses: [
            {
              title: '1. Wallet top-ups',
              body: 'Successful MoMo/card top-ups credit your wallet or mobility credit. Failed gateway charges are not captured. If you were charged without credit, contact support@mymovr.io with the payment reference within 14 days.',
            },
            {
              title: '2. Cancelled rides',
              body: 'If a trip never starts and payment was pre-authorized, we reverse or release the hold. Cancellation fees may apply when disclosed in-app before confirm.',
            },
            {
              title: '3. Marketplace & rentals',
              body: 'Merchant refund rules apply to shop orders. Rental refunds follow the booking terms shown at checkout.',
            },
            {
              title: '4. How to request',
              body: 'Use in-app Support, https://mymovr.io/support, or email support@mymovr.io. Approved refunds return to the original method or wallet within 1–7 business days depending on the provider.',
            },
          ],
        },
      },
    ],
  },
  {
    slug: 'community-guidelines',
    title: 'Community Guidelines',
    status: 'published',
    meta: { playstorePack: 1, category: 'legal' },
    sections: [
      {
        type: 'legal',
        payload: {
          heading: 'Community Guidelines',
          updatedLabel: 'Last updated August 2026',
          clauses: [
            {
              title: 'Respect',
              body: 'Treat riders, drivers, and merchants with respect. No harassment, hate speech, or threats.',
            },
            {
              title: 'Safety',
              body: 'Follow traffic laws. No weapons, illegal goods, or impaired driving. Use SOS and share-trip tools when needed.',
            },
            {
              title: 'Honesty',
              body: 'Accurate pickup pins, fair ratings, and truthful support reports keep the network healthy.',
            },
            {
              title: 'Enforcement',
              body: 'Violations may lead to warnings, suspension, or permanent bans. Serious safety issues may be reported to authorities.',
            },
          ],
        },
      },
    ],
  },
  {
    slug: 'child-safety',
    title: 'Child safety standards',
    status: 'published',
    meta: { playstorePack: 1, category: 'legal', googlePlayRequired: true },
    sections: [
      {
        type: 'legal',
        payload: {
          heading: 'Child safety & CSAE standards',
          updatedLabel: 'Google Play compliance · August 2026',
          clauses: [
            {
              title: 'Standards',
              body: 'Movr prohibits child sexual abuse and exploitation (CSAE). We do not allow sexual content involving minors, grooming, or related material on any Movr surface including chat and media uploads.',
            },
            {
              title: 'Reporting',
              body: 'Report concerns to safety@mymovr.io or in-app Safety Centre. We review reports promptly and may preserve data for law enforcement.',
            },
            {
              title: 'Age',
              body: 'Accounts are for adults (18+) unless a feature explicitly states otherwise with parental controls. The apps are not designed for children under 13.',
            },
          ],
        },
      },
    ],
  },
  {
    slug: 'driver-terms',
    title: 'Driver Terms',
    status: 'published',
    meta: { playstorePack: 1, category: 'legal' },
    sections: [
      {
        type: 'legal',
        payload: {
          heading: 'Driver Terms',
          updatedLabel: 'Last updated August 2026',
          clauses: [
            {
              title: '1. Independent contractor',
              body: 'Unless local law says otherwise, you provide transportation services as an independent partner. You supply a legal vehicle, license, and insurance as required in your city.',
            },
            {
              title: '2. Earnings',
              body: 'Trip fares are yours subject to your Movr driver subscription and taxes. Destination mode and income floor guarantees follow in-app enrollment terms.',
            },
            {
              title: '3. Quality',
              body: 'Accept offers you can complete, navigate safely, and treat riders with respect. Repeated cancellations or safety incidents may limit access to offers.',
            },
          ],
        },
      },
    ],
  },
  {
    slug: 'support',
    title: 'Contact & support',
    status: 'published',
    meta: { playstorePack: 1, category: 'support' },
    sections: [
      {
        type: 'rich_text',
        payload: {
          heading: 'Contact Movr',
          paragraphs: [
            'Help centre: https://mymovr.io/help',
            'In-app: Support chat / Movr AI',
            'Email: support@mymovr.io',
            'Privacy: privacy@mymovr.io · Safety: safety@mymovr.io · Legal: legal@mymovr.io',
            'Web: https://mymovr.io · Admin ops: https://admin.mymovr.io',
          ],
        },
      },
      {
        type: 'form',
        payload: {
          heading: 'Send a message',
          formKey: 'contact_support',
          submitLabel: 'Send',
          successMessage: 'Thanks — our team will reply to your email.',
          fields: [
            { name: 'name', label: 'Name', type: 'text', required: true },
            { name: 'email', label: 'Email', type: 'email', required: true },
            { name: 'topic', label: 'Topic', type: 'text', required: true },
            { name: 'message', label: 'Message', type: 'textarea', required: true },
          ],
        },
      },
    ],
  },
  {
    slug: 'contact',
    title: 'Contact',
    status: 'published',
    meta: { playstorePack: 1, category: 'support' },
    sections: [
      {
        type: 'rich_text',
        payload: {
          heading: 'Contact',
          paragraphs: [
            'Prefer the full support page: https://mymovr.io/support',
            'Business & partnerships: partnerships@mymovr.io',
            'Press: press@mymovr.io',
          ],
        },
      },
      {
        type: 'form',
        payload: {
          heading: 'Contact form',
          formKey: 'contact',
          submitLabel: 'Send message',
          successMessage: 'Message received.',
          fields: [
            { name: 'name', label: 'Name', type: 'text', required: true },
            { name: 'email', label: 'Email', type: 'email', required: true },
            { name: 'message', label: 'Message', type: 'textarea', required: true },
          ],
        },
      },
    ],
  },
];

export const PLAYSTORE_CMS_SLUGS = PLAYSTORE_CMS_PAGES.map((p) => p.slug);
