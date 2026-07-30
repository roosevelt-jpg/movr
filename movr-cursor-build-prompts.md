# MOVR Build Playbook — Full Cursor Prompts

This maps every row of your **Gap Analysis (CabMe Baseline)** to a concrete, copy-pasteable Cursor prompt, sequenced against your existing repo (`movr-platform/`: Node/TS + Go backend, React web + admin, React Native customer/driver apps, PostgreSQL+PostGIS, Redis, Paystack + Flutterwave [dual provider — see Phase 0A], Web3.js/Hardhat).

**How to use this:**
1. Open the repo in Cursor with the whole `movr-platform/` folder as your workspace (so Cursor has full context of existing files/conventions).
2. Work through the prompts **in order** — later phases assume earlier ones exist (e.g. the token system needs the wallet, staking needs the token).
3. Paste one prompt at a time into Cursor's Composer/Agent mode (not chat-only) so it can create/edit files directly. After each prompt, review the diff before accepting.
4. Where a prompt says "reference `<file>`," attach that file in Cursor's context (`@filename`) so it edits/extends rather than duplicates.
5. **On UI/UX:** Phases 1–26 are functional specs — they tell Cursor what a screen does and what data it needs, not its exact visual design. **Phase 0B** is the actual design system (colors, type, spacing, component library) extracted from your brand guidelines, plus per-screen layout direction for your highest-traffic screens. Build Phase 0B first; every later phase's UI work should reference it rather than let Cursor improvise styling per screen.
6. **Coverage note:** every phase in this doc is cross-checked directly against `MOVR_Requirements_Gap_Analysis__CabMe_Baseline_.pdf` (Phases 1–21), `Movr_Brand_Guidelines_v1_1.pdf` (Phase 0B, and Phase 27 for the deck's "cross-border" payments line), and the actual `movr-platform` codebase (confirming what already exists vs. what's genuinely missing, e.g. MoMo payments already worked via Flutterwave and continue to via either provider post-Phase 0A; the fare/vehicle-type system did not). Physical brand collateral (vehicle wraps, storefront signage) and brand-approval workflows from the guidelines are intentionally excluded — they're print/ops processes, not software.
7. **On repo cleanliness:** this doc was written incrementally, which is why migration numbers are inconsistent in the phase text below (`000A`, `005A`, a missing `001`, etc.). **Phase 0D fixes this** — a renumbering table and structural contract to apply first, before Phase 0A, so the codebase Cursor produces is clean from the start rather than needing a cleanup pass bolted on at the end.

---

## Phase 0 — Orientation Prompt (run this first, once)

```
You are working in an existing production-leaning monorepo called movr-platform.
Structure:
- backend/src (Node.js + TypeScript, Express, services in backend/src/services, routes in backend/src/routes, middleware in backend/src/middleware, Postgres via database.service.ts, Redis via redis.service.ts)
- frontend/web (React + TypeScript, Tailwind, pages in src/pages)
- frontend/admin (React + TypeScript admin dashboard)
- frontend/public-website (marketing site)
- mobile/customer and mobile/driver (React Native + Expo, screens in src/screens/app)
- docker-compose.yml, Makefile for local dev

Before writing any code, read: backend/src/index.ts, backend/src/services/database.service.ts,
backend/src/routes/rides.routes.ts, backend/src/middleware/auth.middleware.ts,
frontend/web/src/App.tsx, frontend/web/src/services/api.ts, mobile/customer/src/screens/app/HomeScreen.tsx.

Match existing naming conventions, file layout, error handling style, and auth middleware patterns
exactly. Do not introduce a new framework, ORM, or state library — extend what's already there
(Express + raw/typed SQL via database.service.ts, Redux Toolkit/Zustand on frontend, Socket.io for
realtime). Confirm you understand this structure before we start Phase 1.
```

---

## Phase 0D — Repository Structure, Naming Conventions & Migration Renumbering

**Why this phase exists and comes first:** the prompts in this doc were written incrementally as
gaps got identified, which is why migration files are numbered inconsistently —
`000A_payment_provider_config.sql`, `000B_integrations_hub.sql`, then jumps straight to `002`
with no `001`, and `005_delivery_control.sql` collides with `005A_kyc_attestation.sql`. If Cursor
builds each phase literally as written, you'll end up with that same messy numbering baked into
production. This phase fixes it once, up front, and gives Cursor a structural contract to follow
for everything else in this doc — so six months from now a new developer can open the repo and
understand it in an afternoon, not a week.

```
Before starting Phase 0A, establish the repository's structural conventions and correct the
migration numbering so every subsequent phase in this build produces a clean, consistently
organized codebase.

1. MIGRATION RENUMBERING — apply this exact mapping. Wherever a later phase in this document
   references a migration by its old number/name, use the corresponding new one instead. Rename
   the actual files to match (or create them with the new name to begin with, if the phase
   hasn't been built yet), and keep this table as a comment header in
   backend/migrations/000_MIGRATION_INDEX.md for future reference:

   | Old filename                          | New filename                         | Phase |
   |----------------------------------------|---------------------------------------|-------|
   | 000A_payment_provider_config.sql        | 001_payment_provider_config.sql       | 0A    |
   | 000B_integrations_hub.sql               | 002_integrations_hub.sql              | 0C    |
   | 002_super_app_shell.sql                 | 003_super_app_shell.sql               | 1     |
   | 003_marketplace.sql                     | 004_marketplace.sql                   | 2     |
   | 004_merchant_portal.sql                 | 005_merchant_portal.sql               | 3     |
   | 005_delivery_control.sql                | 006_delivery_control.sql              | 4     |
   | 005A_kyc_attestation.sql                | 007_kyc_attestation.sql               | 5A    |
   | 006_token_system.sql *(on hold)*        | 008_token_system.sql                  | 5B    |
   | 007_points.sql                          | 009_points.sql                        | 6     |
   | 008_staking.sql *(on hold)*              | 010_staking.sql                       | 7     |
   | 009_claims.sql *(on hold)*                | 011_claims.sql                        | 8     |
   | 010_referrals.sql                       | 012_referrals.sql                     | 10    |
   | 011_delivery_enhancements.sql           | 013_delivery_enhancements.sql         | 11    |
   | 012_driver_performance.sql              | 014_driver_performance.sql            | 13    |
   | 013_subscription_extensions.sql         | 015_subscription_extensions.sql       | 14    |
   | 014_rental_expansion.sql                | 016_rental_expansion.sql              | 15    |
   | 015_rewards_engine.sql                  | 017_rewards_engine.sql                | 16    |
   | 016_ops_console.sql                     | 018_ops_console.sql                   | 17    |
   | 017_financial_engine.sql                | 019_financial_engine.sql              | 18    |
   | 018_inbox.sql                           | 020_inbox.sql                         | 19    |
   | 019_multi_country.sql                   | 021_multi_country.sql                 | 20    |
   | 020_perf_indexes.sql                    | 022_perf_indexes.sql                  | 21    |
   | 021_alt_channels.sql                    | 023_alt_channels.sql                  | 22    |
   | 022_vehicle_types_pricing.sql           | 024_vehicle_types_pricing.sql         | 24    |
   | 023_dynamic_pricing.sql                 | 025_dynamic_pricing.sql               | 25    |
   | 024_national_id_linking.sql             | 026_national_id_linking.sql           | 26    |
   | 025_cross_border_transfers.sql          | 027_cross_border_transfers.sql        | 27    |
   | 026_trip_recording.sql                  | 028_trip_recording.sql                | 28    |

   Use strict 3-digit zero-padded sequential numbers, no letters, ever — if a future phase needs
   to insert a migration between two existing ones, it still goes at the end of the sequence
   with the next available number; migrations are ordered by execution order, not by which gap
   analysis row they came from.

2. TARGET REPOSITORY STRUCTURE — the final shape every phase should converge toward:

   ```
   movr-platform/
   ├── backend/
   │   ├── src/
   │   │   ├── routes/              # thin HTTP layer only — one file per resource,
   │   │   │                        #   kebab-case, always suffixed .routes.ts
   │   │   ├── services/            # all business logic lives here, one file per
   │   │   │                        #   domain, kebab-case, always suffixed .service.ts
   │   │   ├── middleware/          # auth, rate-limiting, validation
   │   │   ├── interfaces/          # shared TypeScript interfaces/types, no logic
   │   │   ├── utils/               # pure helper functions only — no side effects,
   │   │   │                        #   no DB/network calls living here
   │   │   ├── jobs/                # scheduled/cron jobs (settlement, retention
   │   │   │                        #   cleanup, metrics recalculation), one file each
   │   │   └── index.ts             # composition root — route registration only,
   │   │                            #   no business logic
   │   ├── migrations/               # 001_xxx.sql ... NNN_xxx.sql, strictly sequential,
   │   │   └── 000_MIGRATION_INDEX.md  #   plus the index/history file above
   │   ├── blockchain/               # Hardhat project — contracts/, scripts/, test/
   │   │   ├── contracts/            #   KYCRegistry.sol now; DriveToken.sol,
   │   │   │                        #   MerkleDistributor.sol etc. stay here once
   │   │   │                        #   Phase 5B/8 come off hold — never mix with
   │   │   │                        #   backend/src
   │   │   └── scripts/
   │   └── scripts/                  # one-off ops scripts (load tests, backfills) —
   │                                  #   never business logic, never imported by src/
   │
   ├── frontend/
   │   ├── web/                      # customer-facing web app (Phase 1's web parity)
   │   │   └── src/
   │   │       ├── pages/
   │   │       │   ├── app/          # rider-facing pages
   │   │       │   └── merchant/     # merchant portal — lives HERE, inside frontend/web,
   │   │       │                    #   not a separate app (per Phase 3), since it shares
   │   │       │                    #   the design system and much of the component library
   │   │       ├── components/       # shared across app/ and merchant/ pages
   │   │       └── services/         # API client, one file per backend resource
   │   ├── admin/                    # internal ops console — its own app, own density
   │   │                            #   variant of the design system (Phase 0B)
   │   ├── public-website/           # marketing site — homepage, driver/merchant
   │   │                            #   landing pages, help/terms/download pages
   │   └── staking-webapp/           # standalone, only relevant once Phase 9 comes
   │                                  #   off hold — separate deployment target, not
   │                                  #   bundled with public-website
   │
   ├── mobile/
   │   ├── customer/
   │   │   └── src/screens/app/      # one screen per file, PascalCase, suffixed Screen.tsx
   │   ├── driver/
   │   │   └── src/screens/app/      # same convention
   │   └── (both import design-system/ as a shared workspace package — see below,
   │        never duplicate a component between customer/ and driver/)
   │
   ├── design-system/                # Phase 0B's output — the single source of truth
   │   ├── tokens.json               #   colors, gradient, type scale, spacing, radius
   │   ├── theme.ts                  #   same tokens as plain JS objects, for React Native
   │   ├── components/               #   shared RN component library (Button, Input,
   │   │                            #   Card, Tab, StatusPill, etc.)
   │   ├── assets/logo/               #   the actual brand logo files — never redrawn as text
   │   ├── CONTENT_GUIDE.md          #   tone-of-voice rules from Phase 0B
   │   └── README.md
   │
   ├── docs/
   │   ├── ARCHITECTURE.md            # service boundaries (Phase 21), updated as
   │   │                            #   new domains are added, not just written once
   │   ├── DEPLOYMENT_CHECKLIST.md
   │   └── SECURITY_FEATURES_GUIDE.md
   │
   ├── docker-compose.yml
   ├── Makefile
   └── README.md                      # top-level: what this repo is, how to run it
                                       #   locally, link to docs/ARCHITECTURE.md
   ```

3. NAMING CONVENTIONS — apply consistently across every phase from here on:
   - Backend files: kebab-case, purpose-suffixed (`ride-booking.service.ts`,
     `merchant.routes.ts`, `paystack.service.ts`) — never abbreviate inconsistently
     (`mgmt` vs `management` vs `manager` — pick one pattern and hold it across the whole repo;
     this doc uses full words, e.g. `driver-performance.service.ts` not `driver-perf.service.ts`).
   - Mobile/web components: PascalCase, purpose-suffixed by type
     (`VoiceBookingScreen.tsx`, `MerchantDashboardPage.tsx`, `StatusPill.tsx` for a shared
     component with no suffix requirement since it's generic).
   - Database tables/columns: snake_case, plural table names (`wallet_transactions`, not
     `WalletTransaction` or `wallet_transaction`).
   - Environment variables: SCREAMING_SNAKE_CASE, prefixed by service where ambiguity is
     possible (`PAYSTACK_SECRET_KEY`, `FLUTTERWAVE_SECRET_KEY`, not two vars both called
     `SECRET_KEY`).
   - One export per file for services/components as a default rule — a file with 400 lines and
     six unrelated exported functions is a sign a phase's service needs splitting, not a normal
     outcome; if a phase's prompt above produces that, split it along the same domain
     boundaries used elsewhere in this doc rather than leaving it merged.

4. END-OF-BUILD HYGIENE PASS — after all phases you intend to build are complete, run this as
   its own dedicated Cursor session, not folded into the last feature phase:
   - No orphaned files: every migration has a corresponding rollback consideration noted (even
     if rollback isn't automated), every service has at least one route or job that calls it,
     no commented-out code blocks left in from earlier iterations.
   - No `console.log` left in backend/src outside the structured logger from Phase 21 — grep for
     it as a final check.
   - One design-system source of truth confirmed: grep frontend/web, frontend/admin,
     mobile/customer, mobile/driver for raw hex codes (`#[0-9A-Fa-f]{6}`) outside
     design-system/tokens.json and theme.ts — anything found is a phase that bypassed the
     design system and needs fixing.
   - Consistent formatting: one Prettier/ESLint config at the repo root, applied via a single
     `npm run lint` / `npm run format` across every workspace, not per-folder configs that drift.
   - docs/ARCHITECTURE.md actually reflects the final service list — regenerate the service
     boundary list from the real backend/src/services/ directory rather than trusting a doc
     written mid-build.
   - Update this doc's own execution-order section (or replace it with a CHANGELOG) so the next
     developer reading the repo isn't left holding a 33-phase prompt log as their only map —
     docs/ARCHITECTURE.md should be the durable reference once the build is done, this file's
     job is finished at that point.
```

---

## Phase 0A — Dual Payment Provider Support: Paystack + Flutterwave

**Why this is its own phase:** every later phase in this doc references `payment.service.ts`.
Rather than committing to one provider, run both behind a single interface with the active
provider controlled by configuration — global default, with an optional per-country override.
This also directly solves the coverage gap flagged below: Paystack only covers 5 markets, so
countries outside that list can automatically fall back to Flutterwave without any code change,
just a config row.

**Why per-country matters here (verified, not assumed):** Paystack is live in five markets —
**Nigeria, Ghana, South Africa, Kenya, Côte d'Ivoire** (Egypt and Rwanda are in early access/beta
as of mid-2026). Flutterwave's reach is broader/pan-African. So this isn't just "pick whichever
one is configured" as a single global switch — the more useful version is: default provider is
whichever you configure, but any country can be pinned to a specific provider, so you can run
Paystack in Ghana/Nigeria for its native mobile-money and preauthorization support while
Flutterwave covers a market Paystack doesn't reach yet — without touching code either way.

```
Implement both Paystack and Flutterwave as interchangeable payment providers behind one interface
in backend/src/services/payment.service.ts, with the active provider resolved at runtime from
configuration rather than hardcoded to either.

1. Define a PaymentProvider interface (backend/src/services/payment-provider.interface.ts):
   initializePayment(amount, currency, email, metadata), verifyPayment(reference),
   initializeTransfer(recipientDetails, amount, currency) / bulkTransfer(items[]),
   initializePreauthorization(amount, currency, email) / capturePreauthorization(reference,
   amount) / releasePreauthorization(reference), handleWebhook(payload, signature).

2. Create two implementations of that interface:
   - backend/src/services/paystack.service.ts using Paystack's actual API surface: Initialize
     Transaction (POST /transaction/initialize) + Verify Transaction (GET
     /transaction/verify/:reference); Transfers (POST /transfer) and Bulk Transfers (POST
     /transfer/bulk, max 100 per batch — chunk larger runs); Preauthorization (POST
     /transaction/initialize_preauthorization to hold, POST /transaction/capture_preauthorization
     to capture, or let it auto-release via expire_action — Paystack supports real holds
     natively, no custom logic needed); webhook handler verifying the x-paystack-signature header
     (HMAC SHA512) before processing any event.
   - backend/src/services/flutterwave.service.ts — this is your existing implementation
     (payment.service.ts's current Flutterwave code); refactor it to implement the same
     PaymentProvider interface rather than being called directly, but keep its actual API calls
     as they are today (they already work).

3. Provider resolution logic in payment.service.ts's getProvider(countryCode?: string):
   - migration 000A_payment_provider_config.sql: payment_provider_config(id, scope
     ENUM('global','country'), country_code (nullable, only set when scope='country'),
     provider ENUM('paystack','flutterwave'), is_active).
   - Resolution order: if a country-scoped, active config row exists for the given country, use
     that provider; otherwise fall back to the global-scope active row; if neither exists, fail
     loudly (never silently default to one provider without an explicit config row — that hides
     a misconfiguration instead of surfacing it).
   - Every call site (ride payment, subscription billing, driver/merchant payouts, Phase 15's
     rental deposits, Phase 27's cross-border transfers) calls payment.service.ts's methods,
     which internally resolve the provider and delegate — call sites never import
     paystack.service.ts or flutterwave.service.ts directly.

4. Admin control: add GET/PATCH /admin/payment-providers so the active provider (global and
   per-country) can be changed from frontend/admin without a redeploy — a simple
   PaymentProvidersPage.tsx listing current config with a provider dropdown per row (global +
   one row per active country from Phase 20's countries table), through the Phase 17 audit_log
   pattern for any change.

5. .env.example: keep both FLUTTERWAVE_PUBLIC_KEY/FLUTTERWAVE_SECRET_KEY and
   PAYSTACK_PUBLIC_KEY/PAYSTACK_SECRET_KEY — both providers need live credentials configured
   since either can be activated at runtime. Update currency handling to validate against
   whichever provider is actually resolved for a given transaction's country — Paystack settles
   NGN/GHS/ZAR/KES/USD, Flutterwave supports a broader currency set; don't let Phase 20's
   city_pricing default to a currency the resolved provider can't settle.

6. Webhook routing: two separate webhook endpoints (POST /webhooks/paystack, POST
   /webhooks/flutterwave, keep the existing Flutterwave one), each verifying its own provider's
   signature scheme, both writing to the same transactions/payouts tables in the same shape
   regardless of which provider triggered them — downstream code (Phase 18's settlement engine,
   Phase 3's merchant earnings) should never need to know which provider processed a given
   transaction.

7. Test both providers independently before touching production keys: a full ride payment, a
   subscription charge, a single payout, a bulk payout batch, and a preauthorization hold +
   capture — run this full checklist once with the config pointed at Paystack and once pointed
   at Flutterwave, on each provider's sandbox/test keys.
```

---

## Phase 0C — Integrations Hub (Centralized 3rd-Party API Configuration)

**Why this is its own phase:** as this doc stands, every third-party service gets configured as
raw `.env` entries scattered across whichever phase introduces it — Paystack/Flutterwave keys
(Phase 0A), Twilio for SMS/WhatsApp/IVR (Phase 22), Telegram bot token (Phase 22), Google Maps/
Mapbox (used throughout), OpenAI for Whisper transcription and voice-intent parsing (Phase 23),
OpenWeatherMap (Phase 25), Africa's Talking for USSD (Phase 22), NIA/DVLA for Ghana Card/license
verification (Phase 26), Sentry (Phase 21), plus whatever cloud storage (S3) and email provider
already exist. There's no single place to see what's configured, what's healthy, or who changed
what. This phase builds that — generalizing the same pattern Phase 0A already established for
payment providers to every other integration.

```
Build a centralized Integrations Hub in frontend/admin covering every third-party service the
platform depends on, with a consistent add/test/enable-disable pattern rather than each service
having its own bespoke config screen (or no screen at all, just .env).

1. Migration 000B_integrations_hub.sql:
   - integrations(id, key ENUM('paystack','flutterwave','twilio','telegram_bot',
     'google_maps','openai','openweathermap','africastalking_ussd','nia_ghana_card',
     'dvla_ghana','aws_s3','sentry', ...), display_name, category ENUM('payments','messaging',
     'maps_location','ai_voice','identity_verification','infrastructure'), status
     ENUM('not_configured','configured','connected','error'), last_checked_at, last_error)
   - integration_credentials(id, integration_id, credential_key (e.g. 'public_key',
     'secret_key', 'bot_token'), encrypted_value, is_secret boolean, updated_by_admin_id,
     updated_at) — secrets are stored encrypted (reuse whatever KMS/encryption approach
     SECURITY_FEATURES_GUIDE.md already establishes for other secrets, e.g. custodial wallet
     keys from Phase 5A/5B) and are NEVER returned in plaintext by any GET endpoint after the
     initial save — only a masked preview (e.g. last 4 characters).
   - integration_config(id, integration_id, config_key, config_value, is_secret false) — for
     non-secret settings that belong alongside credentials (e.g. Paystack/Flutterwave's
     per-country routing config from Phase 0A can either live here or stay in its own table and
     just be surfaced in this hub's UI — don't duplicate that table, link to it).

2. Backend backend/src/services/integrations.service.ts:
   - registerIntegration(key, config): each service module (paystack.service.ts,
     twilio-sms.service.ts, whatsapp-bot.service.ts, telegram-bot.service.ts,
     voice-intent.service.ts's OpenAI client, pricing-engine.service.ts's weather client,
     kyc-attestation and ghana-card-verification services, etc.) reads its credentials through
     this service instead of `process.env` directly — getCredential(integrationKey,
     credentialKey) decrypts on read, in-memory only, never logged.
   - testConnection(integrationKey): a lightweight per-integration health check (e.g. Paystack:
     a low-cost read-only API call; Twilio: fetch account info; OpenAI: a minimal completions
     call; Google Maps: a geocode of a known address; NIA: whatever their status/ping endpoint
     is) — updates the integration's status and last_checked_at. Not every provider has a cheap
     health-check endpoint; where none exists, fall back to "configured" status (credentials
     present, unverified) rather than forcing a real API call that costs money just to show a
     green checkmark.
   - All credential writes go through the Phase 17 audit_log pattern (admin_id, which
     integration, which field changed — never log the actual secret value, just that it changed).

3. Routes backend/src/routes/admin-integrations.routes.ts: GET /admin/integrations (list all,
   with status/category), GET /admin/integrations/:key (detail, credentials masked), PUT
   /admin/integrations/:key/credentials (save, admin-only, requires re-auth/password
   confirmation for secret fields given the sensitivity), POST /admin/integrations/:key/test
   (run the health check), PATCH /admin/integrations/:key/enable | /disable.

4. Frontend/admin: IntegrationsHubPage.tsx — a grid or list grouped by category (Payments,
   Messaging, Maps & Location, AI & Voice, Identity Verification, Infrastructure), each card
   showing the service name, a status badge (not configured / configured / connected / error),
   last-checked timestamp, and a "Configure" action opening IntegrationDetailPanel.tsx with
   masked credential fields (only unmask on explicit re-entry, never round-trip a stored secret
   back to the browser), a "Test connection" button, and an enable/disable toggle. This becomes
   the one screen that answers "is everything actually wired up" without grepping .env files or
   checking a dozen different feature-specific pages.

5. Migrate every existing single-purpose config screen into this pattern rather than leaving
   them stranded: Phase 0A's payment-provider config becomes the Payments category's detail
   view (reusing, not duplicating, its per-country routing table); anything else already built
   with its own ad hoc credential fields gets consolidated here too.

6. Startup validation: on backend boot, check which integrations are marked required-for-launch
   (a simple is_required flag) and log a clear warning (not a crash) for any required integration
   still in 'not_configured' status — so a misconfigured deployment is loud in the logs, not a
   silent runtime failure the first time a WhatsApp booking or a Paystack payment is attempted.
```

---

## Phase 0B — Design System & UI/UX Specification (build this before any screen work)

**Why this phase exists:** none of the prompts above specify visual design — they specify
function ("add a mic button," "show a confirmation card"). Without a shared design system,
Cursor will make its own default styling choices per screen, and across 20+ phases those
defaults drift and end up inconsistent. This phase extracts real tokens from
`Movr_Brand_Guidelines_v1_1.pdf` (already in your repo) and turns them into an enforceable system
for web, mobile, and admin — so every later phase's UI work references this instead of
improvising.

**Design tokens (extracted directly from the brand guidelines PDF):**

| Token | Value |
|---|---|
| Jet Black | `#000000` |
| Pure White | `#FFFFFF` |
| Electric Violet | `#6A00FF` |
| Motion Blue | `#0055FF` |
| Movr Green *(added post-guidelines-v1.1, sampled directly from the app-icon asset)* | `#3F7048` |
| Primary gradient *(updated: 3-stop, was 2-stop violet→blue)* | `linear-gradient(135deg, #3F7048 0%, #6A00FF 50%, #0055FF 100%)` — CTAs, dividers, hero bands only, same "accents and CTAs only" restraint as before, just a third color added |
| Primary typeface | Poppins — Bold/SemiBold for headlines, Regular for body |
| Secondary typeface | Montserrat — Medium/Light, supporting text |
| Logo safe area | 0.5× cap-height on all sides |
| Logo minimum size | 24px height (digital) |

The guideline doesn't specify a spacing/radius/shadow scale or a full semantic color set (success/
error/warning/disabled/surface-elevated, etc.) — those don't exist yet and need to be defined
consistently, filling gaps in a way that stays true to the high-contrast black/white/violet-blue
identity rather than introducing unrelated colors.

```
Build a shared design system from Movr_Brand_Guidelines_v1_1.pdf (already in the repo root) and
apply it consistently across frontend/web, frontend/admin, and mobile/customer + mobile/driver.

1. Create a single source-of-truth token file: design-system/tokens.json at the repo root, with:
   - colors: jetBlack #000000, pureWhite #FFFFFF, electricViolet #6A00FF, motionBlue #0055FF,
     movrGreen #3F7048 (added post-v1.1 guidelines, sampled directly from the app-icon asset —
     this is a brand/gradient color, keep it distinct from the semantic `success` color below;
     they're both green but serve different purposes and should not be merged into one token),
     plus a filled-in semantic set that stays within this palette's spirit — surface (near-black,
     e.g. #0A0A0A for cards on a black background, matching the reference app UI mockup on page
     11 of the brand guidelines), surfaceElevated (slightly lighter, e.g. #1A1A1A), success
     (a brighter, more vivid green than movrGreen so status badges stay visually distinct from
     the brand gradient — e.g. #00D97A), error (e.g. #FF3B5C), warning (e.g. #FFB800),
     textPrimary (#FFFFFF), textSecondary (a muted white, e.g. #A0A0A0), border (e.g. #2A2A2A).
   - gradient: primary "135deg, #3F7048 0%, #6A00FF 50%, #0055FF 100%" — a 3-stop gradient
     (updated from the original 2-stop violet→blue in guidelines v1.1) — reserved for CTAs,
     active-state indicators (like the tab underline in the reference mockup), and hero/promo
     bands only, never for body backgrounds or large surfaces. Check contrast when white text
     sits on this gradient, particularly over the green stop, which is darker/more muted than
     the violet and blue stops — if a specific button's text fails contrast there, it's fine to
     nudge that button's text weight up rather than changing the gradient itself.
   - typography: fontFamily.primary "Poppins", fontFamily.secondary "Montserrat", with a type
     scale (e.g. display 32/40, h1 24/32, h2 20/28, body 16/24, caption 13/18, all using Poppins
     SemiBold for headlines and Poppins/Montserrat Regular for body, per the guideline).
   - spacing scale: 4/8/12/16/24/32/48/64 (standard 4px-based scale, since none is specified).
   - radius scale: sm 8, md 12, lg 20, pill 999 (matching the heavily rounded pill buttons and
     rounded input fields visible in the reference app UI mockup).
   - elevation/shadow: since the app is dark-themed, prefer subtle border/glow elevation over
     drop shadows (e.g. a faint violet-tinted glow on active/focused elements) rather than
     standard light-mode shadows, which read poorly on black.

2. Web (frontend/web and frontend/admin): extend the existing Tailwind config
   (tailwind.config.js — check current setup first) to import these tokens as theme.extend
   values (colors, fontFamily, borderRadius, spacing) so every future Tailwind class
   (bg-jet-black, text-electric-violet, rounded-pill, etc.) maps to the token file — do not hardcode
   hex values in components going forward. Import Poppins and Montserrat via Google Fonts or
   self-hosted files, whichever the existing project's font-loading pattern favors (check
   frontend/web's current index.html/App.tsx for how fonts are currently loaded, if at all).

3. Mobile (mobile/customer and mobile/driver): since Tailwind classes don't carry over 1:1 to
   React Native, create design-system/theme.ts exporting the same tokens as plain JS objects
   (colors, spacing, radii, typography styles), and a shared design-system/components/ folder
   with base components used across both apps: Button (primary = gradient pill, secondary =
   outlined white-on-black, ghost = text-only), Input (rounded, dark-surface, per the reference
   mockup's Pickup/Enter destination fields), Card, Badge, Tab (with the gradient/blue underline
   active-state seen in the reference mockup), StatusPill (for order/ride status), EmptyState,
   LoadingSpinner. Both mobile/customer and mobile/driver should import from this shared folder,
   not maintain separate copies — set up mobile as a small monorepo workspace (or a local package
   via npm/yarn workspaces) if it isn't one already, so design-system/ is a real shared dependency
   rather than duplicated files.

4. Admin panel (frontend/admin): reuse the same token file and color palette (brand consistency
   matters even internally) but define a distinct *density* variant — smaller type scale,
   tighter spacing values, more visible borders/gridlines, and a light-on-dark or optionally
   light-mode table-dense layout, since admin/ops work prioritizes data density and scanability
   over the marketing polish of the consumer apps. Do not just reuse the consumer app's spacious
   card-based layout for data tables — build dedicated DataTable, FilterBar, and DetailPanel
   components suited to reviewing many rows quickly (relevant for Phase 17's ops console, Phase
   18's finance dashboards, Phase 26's identity-link review, and Phase 25's pricing-factor panels).

5. Document all of this in design-system/README.md with usage examples, and add a lint rule or
   simple CI check (e.g. a script grepping for raw hex codes in component files outside the
   token file) to catch future hardcoded colors that bypass the system.

6. Logo asset handling: copy the actual provided logo files (the vector/PNG Movr wordmark
   assets already in the repo/uploads — white-on-black primary, white-on-gradient secondary)
   into design-system/assets/logo/ and reference them as image assets (<img>/<Image> components)
   everywhere the wordmark appears. Do not let Cursor recreate "Movr" as styled text anywhere in
   the product — the guideline's "never alter the wordmark" rule means the logo is always the
   actual asset file, respecting the documented safe area and 24px minimum digital height, never
   a font-rendered approximation that could drift from the real mark.

7. Content/tone-of-voice guide: add design-system/CONTENT_GUIDE.md codifying the brand's voice
   rules so copy stays consistent across every surface (app UI strings, push/inbox notifications,
   WhatsApp/Telegram/SMS booking messages from Phase 22, admin panel) — not just the marketing
   site:
   - Energetic, youth-driven, pragmatic. Direct copy. Zero fluff — short sentences, no filler
     adjectives, active voice ("Confirm pickup," not "Please confirm your pickup location").
   - Drivers-first narrative: any driver-facing copy touching earnings/subscriptions should
     reflect "100% earnings via subscriptions" — never phrase anything as a commission or
     platform cut, since that would misstate the actual model.
   - Merchant narrative: "Sell faster with in-app storefronts and instant delivery" — merchant
     copy leads with speed and directness, not generic SaaS language.
   - Trust narrative: any copy near pricing, safety, or verification features should surface
     the concrete fact plainly (e.g. "Fare shown before you book," "ID verified," "Live trip
     sharing") rather than vague reassurance language ("we care about your safety").
   List a few before/after copy examples for each rule so Cursor has concrete calibration, not
   just adjectives, when writing UI strings across later phases.

8. Note on physical brand collateral: the brand guidelines also cover vehicle wraps, delivery-bag
   branding, and storefront signage (pages 8–10 of the PDF) and a brand-governance/approval
   process for partner use of the logo. These are print production and brand-ops workflows, not
   software — out of scope for Cursor/this build. Flagging explicitly so it's a known exclusion,
   not an oversight.
```

**Screen-level UI/UX direction for your highest-traffic screens** (use these as the layout brief
Cursor should follow when building each phase's screens — reference the relevant component from
the shared library above rather than one-off styling):

- **Customer home / ride booking (Phase 1):** matches your existing reference mockup exactly —
  full-bleed dark map, Ride/Shop/Deliver/Parcel/Rental tabs with the gradient underline as the
  active-state indicator, pickup/destination as two stacked rounded dark input rows, single
  full-width gradient pill CTA anchoring the bottom. Shortcuts (Home/Work/Recent/Favorites, also
  Phase 1) sit as a horizontally scrollable row of small rounded chips directly above the map,
  not competing with it for attention.
- **Vehicle-type / fare selector (Phase 24):** a bottom sheet or expandable panel (not a full
  screen navigation) listing each vehicle type as a horizontal card: icon, name, capacity,
  price, ETA — sorted by price ascending, cheapest visually first but not over-emphasized with
  color (reserve the violet-blue gradient strictly for the final CTA, not for "cheapest" badges,
  to avoid visual noise — use a simple text label like "Best value" instead).
- **Merchant portal (Phase 3):** a conventional dashboard layout (sidebar nav + main content),
  not the consumer app's map-first layout — merchants need Orders/Products/Earnings/Settings as
  persistent nav items, with an orders-inbox-style main view (list + detail pane) as the default
  landing screen, similar information density to the admin panel's DataTable component but with
  the consumer app's warmer surface colors rather than the admin's denser variant.
- **Admin ops console (Phase 17) and pricing/identity-link review (Phases 25, 26):** dense
  table-first layouts using the admin density variant from step 4 above — live map as one tab
  among several, not the default view (unlike the customer app, where the map IS the product).
- **Voice booking (Phase 23):** minimal, near-empty screen while listening (large mic icon,
  live transcript text growing below it, gradient pulse animation on the mic while active — a
  subtle scale/glow animation, not a spinner, to feel conversational rather than "loading"), then
  transitions to the same vehicle-type selector component from Phase 24 for the confirmation step
  — do not build a separate confirmation UI, reuse the one component.
- **Inbox (Phase 19), Wallet/Token screens (Phases 1, 6):** list-based screens using the shared
  Card and StatusPill components, category filter tabs using the same Tab component (gradient
  underline) as the home screen's Ride/Shop/Deliver tabs, for visual consistency across the app
  rather than each screen inventing its own filter-tab style.
- **Public marketing pages — merchant/driver landing hero banners:** styled after the physical
  Shop Partner storefront signage from the brand guidelines (black background, white wordmark,
  gradient bar beneath it, warm ambient glow suggesting an illuminated storefront interior) —
  animated, not static, using CSS only (no video/GIF asset, keeps page weight low):
  - The violet-to-blue gradient bar shimmers via a `background-size: 200% 100%` gradient with
    `background-position` animated 0% → 200% on a ~3s linear infinite loop, giving a moving
    highlight sweep rather than a static bar.
  - Two soft warm-toned radial-gradient blobs (`rgba(224,196,126,...)`, blurred, positioned
    behind the headline) pulse opacity and scale slowly (~5–6s ease-in-out infinite, offset
    timing between the two so they don't pulse in sync) to evoke glowing shop-interior lighting
    without being distracting.
  - Keep both animations GPU-friendly (`opacity`/`transform`/`background-position` only, no
    layout-triggering properties) and respect `prefers-reduced-motion: reduce` by disabling both
    animations for users who've set that preference — add a media query that sets
    `animation: none` on both elements in that case.
  - This treatment is for hero/marketing banners only (merchant landing, driver landing,
    homepage) — do not apply animated gradients or glow effects inside the actual product UI
    (app screens, admin panels), where Phase 0B's "no gradients on large surfaces" rule still
    applies; this is a marketing-page exception, not a system-wide change.

---

## Phase 1 — Super-App Shell (Gap #1)

**Goal:** Single app with Ride / Shop / Parcel / Rental, unified home, shortcuts, one wallet+rewards.

```
Refactor mobile/customer into a true super-app shell:
1. Create mobile/customer/src/screens/app/SuperAppHomeScreen.tsx as the new landing screen after
   login, replacing HomeScreen.tsx as the default route but keeping HomeScreen.tsx logic reusable
   as the "Ride" tab content.
2. Add a persistent bottom tab or segmented control with four modules: Ride, Shop, Parcel, Rental.
   Each tab lazy-loads its own screen stack (create placeholder screens ShopHomeScreen.tsx,
   ParcelHomeScreen.tsx, RentalHomeScreen.tsx in the same folder if they don't exist).
3. Add a "Shortcuts" row above the map/module area with four tappable cards: Home, Work,
   Recent Trips, Favorites. Wire Home/Work to a new savedAddresses table (see Phase migration
   below) and Recent Trips to the existing rides history endpoint.
4. Create a single WalletContext (mobile/customer/src/context/WalletContext.tsx) that exposes
   balance, rewardsBalance (points, to later become DVT), and transaction history, backed by one
   GET /api/wallet endpoint (create backend/src/routes/wallet.routes.ts if not present, reading
   from a new `wallets` and `wallet_transactions` table). Every module (Ride/Shop/Parcel/Rental)
   must read from this single context — no per-module wallets.
5. Add a Postgres migration backend/migrations/002_super_app_shell.sql creating tables:
   saved_addresses(id, user_id, label, address, lat, lng), wallets(id, user_id, balance,
   points_balance, currency), wallet_transactions(id, wallet_id, type, amount, reference, created_at).
6. Update frontend/web/src/pages/app/DashboardPage.tsx to mirror the same four-module + shortcuts
   layout for web parity.
Keep styling consistent with the existing dark theme (see Movr_Brand_Guidelines_v1_1.pdf assets
already bundled) — black background, white/purple-blue gradient accents.
```

---

## Phase 2 — Shop / Marketplace (Gap #2)

```
Build the Shop marketplace module end-to-end.

Backend:
1. Add migration 003_marketplace.sql: stores(id, merchant_id, name, category, rating, hours_json,
   lat, lng, status), products(id, store_id, name, description, price, currency, image_url,
   in_stock), product_variants(id, product_id, name, price_delta, sku), carts(id, user_id,
   store_id, status), cart_items(id, cart_id, product_id, variant_id, quantity), orders(id,
   user_id, store_id, subtotal, delivery_fee, total, fulfillment_type ENUM('pickup','delivery'),
   status), coupons(id, store_id, code, discount_type, discount_value, expires_at).
2. Create backend/src/routes/stores.routes.ts: GET /stores (filter by category, geo-radius via
   PostGIS ST_DWithin against lat/lng, matching the pattern already used for driver matching in
   matching-engine.service.ts), GET /stores/:id, GET /stores/:id/products.
3. Create backend/src/routes/cart.routes.ts: POST /cart, POST /cart/items, PATCH /cart/items/:id,
   DELETE /cart/items/:id, POST /cart/checkout (creates order, applies coupon if valid, calls
   payment.service.ts's PaymentProvider interface from Phase 0A — resolves to whichever
   provider is configured for the order's country — using the same flow already used for ride
   payments).
4. Create backend/src/routes/orders.routes.ts: GET /orders, GET /orders/:id, PATCH /orders/:id/status.
5. Register all new routers in backend/src/index.ts next to the existing rides router, protected
   by the existing auth.middleware.ts.

Mobile (mobile/customer/src/screens/app/):
6. ShopHomeScreen.tsx — store categories grid + list of stores with rating/hours, geo-sorted.
7. StoreProfileScreen.tsx — store header (rating, hours, category), product grid.
8. ProductDetailScreen.tsx — variant picker, quantity, add to cart.
9. CartScreen.tsx — line items, coupon code field, pickup-vs-delivery toggle, checkout button
   calling POST /cart/checkout and then the existing payment flow used in ride checkout.
10. OrderTrackingScreen.tsx — order status timeline.

Reuse the existing api.ts axios client pattern (see frontend/web/src/services/api.ts) for a
matching mobile/customer/src/services/api.ts if one doesn't already exist.
```

---

## Phase 3 — Merchant App / Portal (Gap #3)

```
Build a standalone merchant portal so merchants no longer need the admin panel.

1. In frontend/web, create a new route group /merchant (frontend/web/src/pages/merchant/) with
   its own auth: MerchantLoginPage.tsx, MerchantOnboardingPage.tsx (business name, category,
   documents upload — reuse the KYC upload pattern from identity-verification.service.ts on the
   backend, but add a parallel merchant-kyc flow).
2. Backend: create backend/src/routes/merchant.routes.ts with:
   - POST /merchant/auth/register, POST /merchant/auth/login (separate role="merchant" in the JWT
     claims, extend auth.middleware.ts to accept a roles array and add a requireRole('merchant')
     guard)
   - POST /merchant/kyc (documents, business registration number) → status pending/approved/rejected
   - CRUD for /merchant/stores, /merchant/products, /merchant/products/:id/variants
   - GET /merchant/orders (incoming orders with accept/reject), PATCH /merchant/orders/:id/accept,
     PATCH /merchant/orders/:id/reject
   - GET /merchant/earnings (daily/weekly/monthly aggregation from `orders`), POST
     /merchant/payouts/withdraw (call the same settlement logic used for driver payouts if it
     exists in payment.service.ts, otherwise stub the payout provider call clearly marked TODO).
3. Extend identity-verification.service.ts with a mirroring merchant KYC method
   (verifyMerchantDocument) rather than duplicating logic — reuse the document upload/verification
   pipeline already built for drivers.
4. Build MerchantDashboardPage.tsx (orders inbox, accept/reject buttons, earnings summary),
   MerchantStoreEditorPage.tsx (store profile + hours), MerchantProductsPage.tsx (product +
   variant CRUD table), MerchantPayoutsPage.tsx.
5. Add a merchants table and merchant_kyc_documents table via migration 004_merchant_portal.sql.
6. Remove merchant management from the admin app's remit — frontend/admin should keep read-only
   oversight only (list/view merchants, approve/reject KYC), not full CRUD.
7. Merchant-facing analytics (the brand deck promises merchants "payouts and analytics," not
   payouts alone): add GET /merchant/analytics returning sales-over-time (daily/weekly/monthly,
   reusing the same aggregation approach as GET /merchant/earnings above), top-selling products,
   average order value, and repeat-customer rate, all scoped to that merchant's own store(s) only
   — this is a merchant-facing view, distinct from Phase 18's admin-only platform-wide GMV
   dashboard; don't conflate the two. Build MerchantAnalyticsPage.tsx with simple charts (reuse
   whatever charting library gets introduced for the admin finance dashboard in Phase 18 for
   consistency) showing these metrics over a selectable date range.
```

---

## Phase 4 — Merchant Delivery Control (Gap #4)

```
Add merchant choice of courier vs their own delivery, plus tracking.

1. Migration: add delivery_mode ENUM('movr_courier','merchant_own') and courier_id (nullable,
   FK to drivers) to the orders table (backend/migrations/005_delivery_control.sql).
2. Backend: in merchant.routes.ts, add PATCH /merchant/orders/:id/delivery-mode. When
   'movr_courier' is chosen, call the existing matching-engine.service.ts to auto-assign a
   nearby driver (same logic used for ride matching, generalized to accept an order_id instead
   of a ride_id — refactor matching-engine.service.ts to expose a generic
   assignNearestDriver(taskType: 'ride'|'delivery', taskId, pickupLat, pickupLng) if it's
   currently ride-specific).
3. Add GET /merchant/orders/:id/tracking returning the assigned courier's live location by
   reading the same location stream Socket.io already publishes for ride tracking
   (check index.ts for the existing socket namespace and reuse/extend it, e.g. a
   `delivery:{orderId}` room mirroring `ride:{rideId}`).
4. Frontend: add a live map component to MerchantDashboardPage.tsx (or a dedicated
   OrderTrackingWidget.tsx) subscribing to that socket room, reusing whatever map component the
   customer app already uses for ride tracking if one exists in frontend/web, otherwise a
   lightweight Google Maps/Mapbox marker matching mobile's approach.
5. Mobile customer OrderTrackingScreen.tsx (built in Phase 2) should also subscribe to this room
   when delivery_mode is 'movr_courier'.
```

---

## Phase 5A — Blockchain-Based KYC Attestation (Driver & Merchant Verification)

**Recommended approach for a ride-hailing/marketplace app:** a lightweight on-chain
**attestation registry** — the blockchain stores only a verification *status* and a *hash* of
the KYC record, never raw PII. This gives you an immutable, auditable "this driver/merchant
passed KYC on this date, verified by this authority" record (useful for trust, disputes, and
potentially portable identity later), without the privacy/GDPR conflicts of putting actual
documents or personal data on an immutable ledger, and without touching the token/securities
questions in Phase 5B — this is a plain utility contract, not a financial instrument, so it can
proceed independently while the DVT token work stays on hold.

```
Add a blockchain attestation layer on top of the existing KYC pipeline
(identity-verification.service.ts and, for merchants, the parallel flow from Phase 3), without
changing how documents are collected/reviewed today.

1. New Hardhat project backend/blockchain/ (same as would eventually host DVT, but keep this
   contract independent and deployable on its own):
   - contracts/KYCRegistry.sol: a mapping from a subjectId (bytes32, derived from user_id — never
     the raw user_id or PII) to a struct { status: enum(Pending, Verified, Rejected, Revoked),
     recordHash: bytes32, verifiedAt: uint256, verifier: address }.
   - Only addresses with a VERIFIER_ROLE (your backend's signing wallet) can call
     `attest(bytes32 subjectId, bytes32 recordHash, uint8 status)`. Emit an `Attested` event.
   - Support `revoke(bytes32 subjectId)` for when a driver/merchant is later banned or documents
     expire — since you can't delete from chain, model revocation as a status change, never as
     deletion, and keep the mapping keyed by a pseudonymous subjectId (not wallet address, not
     user_id) so nothing on-chain is directly linkable to a real identity without your database.
   - Deploy to a low-cost L2 (Polygon PoS or an Amoy/testnet equivalent for now) — gas cost per
     attestation should be near-zero; note the target chain in a deploy script comment.

2. Backend service backend/src/services/kyc-attestation.service.ts:
   - computeSubjectId(userId): a one-way HMAC/hash (with a server-side secret) of the user's
     internal ID — never derivable from public data.
   - computeRecordHash(kycRecord): hash of the *approved* KYC record's key fields (document type,
     verification method, approval timestamp, verifier admin ID) — not the document images
     themselves.
   - publishAttestation(userId, status): calls KYCRegistry.attest via ethers/Web3.js, using the
     backend's verifier wallet, and stores the resulting tx hash locally.
   - Hook this into the existing approval step in identity-verification.service.ts (and the
     merchant KYC approval from Phase 3) — when a human reviewer approves/rejects/revokes, call
     publishAttestation() as the final step, not as a replacement for the human review.

3. Migration 005A_kyc_attestation.sql: kyc_attestations(id, user_id, subject_id, record_hash,
   status, tx_hash, chain, verified_at, revoked_at).
   Add GET /kyc/attestation/:userId (internal/admin use — checks the on-chain record and returns
   whether it matches the local DB record, i.e. a tamper-check) and a public, non-PII
   GET /kyc/attestation/verify/:subjectId endpoint that just returns status + tx hash, so a
   driver/merchant could in principle prove their verified status to a third party without
   exposing any personal data.

4. Frontend: add a "Verified" badge with a link to the block-explorer tx on driver profile
   (mobile/driver) and merchant profile (Phase 3's merchant portal) once
   kyc_attestations.status = 'Verified' — this is a trust signal for riders/customers, not a
   replacement for your existing KYC approval UI.

Important constraints to respect:
- Never write raw documents, names, ID numbers, or any PII on-chain — only hashes and status
  enums keyed by a pseudonymous subjectId.
- Model bans/expirations as an on-chain "Revoked" status, never as an attempt to delete on-chain
  data (blockchains are immutable — plan for revocation, not erasure, to stay compatible with
  data-protection rules like GDPR/local equivalents).
- Keep the backend's verifier private key in the same secrets-management approach already used
  for other keys (KMS/.env — see SECURITY_FEATURES_GUIDE.md), never hardcoded.
```

---

## Phase 5B — Token System / DVT (Gap #5) — **ON HOLD, regulatory review pending**

```
Build the DVT utility token system (rewards, staking, governance, merchant payments) as a
real ERC-20-style token with an off-chain ledger mirror for UX speed.

1. Create backend/blockchain/ (new top-level folder) with a Hardhat project:
   - contracts/DriveToken.sol — standard ERC-20 (OpenZeppelin base) named DriveToken, symbol DVT,
     with a fixed max supply, mint restricted to an authorized distributor address (the backend's
     hot wallet), and a `distributeReward(address to, uint256 amount, bytes32 activityRef)` function
     emitting a RewardDistributed event for audit.
   - Allocation per the brand deck: Riders/Drivers/Community pool = 50% combined (split evenly
     unless you specify otherwise), Treasury 20%, remaining categories filling to 100% — encode
     this as constants in the contract or a separate TokenDistribution.sol vesting contract.
   - scripts/deploy.ts for testnet deployment (target Polygon or BNB testnet — pick one and
     say so in a comment, configurable via .env).
2. Backend service backend/src/services/token.service.ts using Web3.js/ethers to:
   - read on-chain DVT balance for a user's custodial wallet address
   - call distributeReward when an activity trigger fires (ride completed, order completed,
     referral confirmed — see Phase "Rewards Trigger Engine" below)
   - maintain an off-chain `token_balances` cache table updated on every on-chain event via an
     event listener/indexer (poll or websocket subscription to the contract), so the app can show
     "pending vs on-chain confirmed" balance without waiting on block confirmations for every read.
3. Migration 006_token_system.sql: custodial_wallets(id, user_id, address, encrypted_private_key
   — encrypt with the same approach used for other secrets in .env/KMS, never store plaintext),
   token_balances(user_id, pending_amount, onchain_amount, last_synced_block),
   token_activity_log(id, user_id, activity_type, dvt_amount, tx_hash, status).
4. Routes backend/src/routes/token.routes.ts: GET /token/balance, GET /token/history,
   POST /token/redeem (burns/transfers DVT for a discount or reward — define the exchange rate
   in a config table, not hardcoded).
5. Frontend/mobile: WalletContext (Phase 1) gains a `dvtBalance` and `dvtHistory` field pulling
   from these endpoints. Add a TokenScreen.tsx (mobile) / TokenPage.tsx (web) showing balance,
   history list, and a redeem flow.

Flag clearly in your response: real token deployment has securities/regulatory implications
(depending on jurisdiction) — this prompt only builds the technical mechanism; legal review of
the token model is out of scope for Cursor and should happen separately.
```

---

## Phase 6 — Pre-Launch Points (Gap #6)

```
Add a points system that runs before DVT/TGE and later converts to DVT at a defined ratio.

1. Migration 007_points.sql: points_ledger(id, user_id, activity_type, points_earned,
   description, created_at), points_conversion_config(activity_type, points_per_action,
   effective_from).
2. Backend backend/src/routes/points.routes.ts: GET /points/balance, GET /points/history
   (grouped by activity_type), GET /points/estimated-dvt (balance * current conversion_rate
   from a config value you can update pre-TGE).
3. Hook points_ledger inserts into the same activity triggers you'll build in the Rewards
   Trigger Engine phase (ride completed, order completed, referral, staking) — for now, add the
   insert calls directly at the end of the ride-completion handler in rides.routes.ts and the
   order-completion handler from Phase 2 as a stopgap, then refactor into the trigger engine later.
4. Frontend/mobile PointsScreen.tsx: total points, breakdown by activity (bar list: Rides,
   Orders, Referrals, Staking), and a banner showing "Estimated DVT at TGE: X" pulling from
   /points/estimated-dvt.
```

---

## Phase 7 — Staking System (Gap #7) — **ON HOLD, regulatory review pending**

```
Build driver staking, merchant staking, and public pre-launch staking.

1. Migration 008_staking.sql: staking_pools(id, name, target_role ENUM('driver','merchant',
   'public'), apy_or_benefit_desc, min_amount, lock_period_days),
   stakes(id, user_id, pool_id, amount, status ENUM('active','unstaking','withdrawn'),
   staked_at, unlock_at).
2. Backend backend/src/routes/staking.routes.ts: GET /staking/pools, POST /staking/stake,
   POST /staking/unstake, GET /staking/my-stakes.
3. Business logic in a new backend/src/services/staking.service.ts:
   - Driver staking: higher stake tier → priority in matching-engine.service.ts (add a
     `priorityWeight` factor read from the driver's active stake tier into the existing
     matching score calculation) and → fee discount applied in payment.service.ts's driver
     commission calculation.
   - Merchant staking: higher stake tier → lower platform fee (read in the order settlement
     calculation from Phase 2/3) and → boosted placement in GET /stores (add an ORDER BY that
     factors in stake tier alongside distance/rating).
   - Public pre-launch staking: no priority/fee benefit, just an APY-style points accrual into
     points_ledger from Phase 6.
4. Frontend: StakingScreen.tsx (mobile, for drivers/public) and a StakingPage.tsx section inside
   the merchant portal (Phase 3) — show pool list, amount input, stake/unstake actions, and
   current active stakes with unlock countdown.
```

---

## Phase 8 — Blockchain Claim Flow (Gap #8) — **ON HOLD, regulatory review pending**

```
Add the in-app "Claim DVT" flow with WebView/DApp support and Merkle airdrop.

1. Backend: extend token.service.ts (Phase 5) with generateMerkleTree(snapshotList) and
   verifyMerkleProof(address, amount, proof) using a standard Merkle library (e.g. merkletreejs).
   Add contracts/MerkleDistributor.sol (OpenZeppelin-style) holding the TGE allocation, with a
   `claim(uint256 index, address account, uint256 amount, bytes32[] proof)` function.
2. Migration 009_claims.sql: airdrop_snapshots(id, generated_at, merkle_root),
   airdrop_allocations(id, snapshot_id, user_id, address, amount, index, claimed boolean).
3. Routes: GET /token/claim/eligibility (returns amount + proof for the current user from the
   latest snapshot), POST /token/claim/mark-claimed (called after the on-chain tx confirms, to
   update airdrop_allocations.claimed).
4. Mobile/web: ClaimScreen.tsx — shows claimable amount, a "Claim" button that either (a) opens
   an embedded WebView pointed at a lightweight DApp claim page (build this as a static page in
   frontend/public-website/src/pages/Claim.tsx using ethers + wallet connect, since it needs a
   real wallet signature) or (b) if the user has a custodial wallet (Phase 5), submits the claim
   server-side using the backend's signing key and just shows a confirmation — support both paths
   behind a feature flag so you can choose per user segment.
```

---

## Phase 9 — External Staking Website (Gap #9) — **ON HOLD, regulatory review pending**

```
Build a standalone public staking web app, separate from the main product, so the mobile app
only needs to show points (no wallet-connect complexity in-app).

1. New workspace frontend/staking-webapp/ (Vite + React + TypeScript + wagmi/viem for wallet
   connect + RainbowKit or ConnectKit for the connect-button UI).
2. Pages: Landing (token info, matching the brand deck: tokenomics donut chart, "Move. Shop.
   Deliver." messaging, dark theme with the purple-to-blue gradient from
   Movr_Brand_Guidelines_v1_1.pdf), Connect Wallet, Stake (calls the same StakingPool contracts
   from Phase 7, connected to mainnet/testnet directly via the user's own wallet — this is public,
   non-custodial staking, distinct from the in-app custodial staking for drivers/merchants),
   My Stakes / Unstake, Claim (reuses the Merkle claim contract from Phase 8).
3. Backend: expose a public read-only GET /public/staking/stats endpoint (total staked, pool
   APYs, participant count) for this site to consume without auth.
4. Deploy target: a subdomain, e.g. stake.movr.io — add a deployment section to
   DEPLOYMENT_CHECKLIST.md describing this as a separate static deployment (Vercel/Netlify)
   distinct from the main app infra in docker-compose.yml.
```

---

## Phase 10 — Referral System (Gap #10)

```
Upgrade referrals from a fixed flat amount to progress-based tracking with points/DVT rewards.

1. Migration 010_referrals.sql: referral_codes(id, user_id, code, created_at),
   referrals(id, referrer_id, referee_id, status ENUM('signed_up','first_ride_completed',
   'qualified'), milestone_json, created_at, qualified_at).
2. Backend backend/src/routes/referrals.routes.ts: GET /referrals/my-code, POST
   /referrals/apply (on signup, referee enters a code), GET /referrals/progress (list of
   referred users with their current milestone stage), and an internal function
   advanceReferralMilestone(refereeId, event) called from the ride-completion and
   order-completion handlers to move a referral from signed_up → first_ride_completed → qualified.
3. On reaching 'qualified', insert a points_ledger row (Phase 6) and/or call token.service.ts's
   distributeReward (Phase 5) — make the reward type and amount configurable in a
   referral_reward_config table rather than hardcoded.
4. Frontend/mobile ReferralScreen.tsx: shareable code/link (use Share API), a progress list
   showing each referred friend's current milestone with a progress bar, and total rewards earned.
```

---

## Phase 11 — Delivery Enhancements (Gap #11)

```
Add Standard/Express delivery tiers, delivery photo upload, and receiver signature + OTP.

1. Migration 011_delivery_enhancements.sql: add speed_tier ENUM('standard','express') and
   proof_of_delivery_url and receiver_signature_url columns to the orders table (and to a
   `deliveries` table if parcels are tracked separately from marketplace orders — check if
   rides.routes.ts or a parcel-specific table already exists; if not, create
   deliveries(id, sender_id, pickup_address, dropoff_address, speed_tier, otp_code, status,
   courier_id) for the standalone Parcel module from Phase 1).
2. Backend: extend pricing logic (wherever delivery_fee is currently calculated — likely
   payment.service.ts or a pricing helper) to add an express multiplier read from config.
   Add POST /deliveries/:id/proof (multipart upload to S3, same pattern as document uploads in
   identity-verification.service.ts) storing proof_of_delivery_url and receiver_signature_url.
   Add POST /deliveries/:id/verify-otp to confirm drop-off (mirroring however pickup OTP already
   works in the existing driver flow — check ActiveRideScreen.tsx / DocumentVerificationScreen.tsx
   patterns in mobile/driver for the existing OTP UI and reuse that component).
3. Mobile/driver: extend ActiveRideScreen.tsx (or create ActiveDeliveryScreen.tsx if deliveries
   are a distinct flow) with: a camera capture step for proof-of-delivery photo, a signature pad
   (use a lightweight React Native signature-canvas library) for receiver signature, and an OTP
   entry step before marking delivered.
4. Mobile/customer ParcelHomeScreen.tsx (from Phase 1): add a speed tier selector
   (Standard vs Express) with price difference shown before booking.
```

---

## Phase 12 — Ride Experience Enhancements (Gap #12)

```
Add masked chat/call, live trip sharing, post-ride tipping, and rider-side SOS.

1. Backend: create backend/src/services/masked-communication.service.ts using a telephony
   provider (Twilio Proxy or similar) to generate temporary masked numbers per active ride,
   and a Socket.io-backed chat channel `ride-chat:{rideId}` for in-app text (persist messages in
   a new ride_messages table for support/dispute purposes).
2. Add GET /rides/:id/share-link generating a signed, expiring public URL (no auth required)
   that renders a read-only live map — build the public page in
   frontend/public-website/src/pages/TripShare.tsx subscribing to the same
   `ride:{rideId}` Socket.io room already used for tracking.
3. Extend rides.routes.ts: on ride completion, allow POST /rides/:id/tip (amount, processed via
   payment.service.ts, credited 100% to the driver per your driver-first model) — add a tip
   prompt screen after ride completion in mobile/customer.
4. Rider-side SOS: the existing sos-emergency.service.ts is currently triggered at admin level
   only per the gap analysis — add a rider-facing POST /sos/trigger endpoint and a prominent SOS
   button in the active-ride UI (mobile customer), reusing sos-emergency.service.ts's existing
   alert-dispatch logic rather than duplicating it, but adding a `triggeredBy: 'rider'|'driver'`
   field so admin can distinguish the source.

   Extend the SOS flow with three things that are realistically buildable (do NOT attempt live
   API dispatch to police or DVLA — no public dispatch API exists for either in Ghana, or in
   most markets; this needs a real institutional MOU with Ghana Police Service, which is a
   business relationship, not something to build here):
   a) One-tap quick-dial: an "Call Police" button that opens the phone's native dialer
      pre-filled with the national emergency number (configurable per country via
      countries.emergency_number from Phase 20, since this varies by market) — a plain
      tel: link/Linking.openURL call, not an API integration.
   b) Auto-populated incident snapshot: on SOS trigger, pull the driver's verified vehicle
      record (plate number, make/model, vehicle license status) from the identity_documents /
      kyc_attestations tables established in Phase 26, plus current trip details and live
      location, and attach it to the sos_incidents row (extend sos-emergency.service.ts's
      schema if this data isn't already captured) — so if the rider or admin does contact
      police by phone, the verified vehicle/driver details are already on screen to read out
      or share, not something anyone has to look up mid-emergency.
   c) Exportable incident report: GET /admin/sos-incidents/:id/report generating a PDF/structured
      export (trip details, verified driver/vehicle identity, location history, timestamps) for
      handoff to law enforcement on formal request — this is how ride-hailing platforms actually
      cooperate with police in practice (data on request under legal process), not live dispatch
      integration.
5. Mobile/driver: add masked-call and chat UI to ActiveRideScreen.tsx to match.
```

---

## Phase 13 — Driver Performance & Gamification (Gap #13)

```
Add acceptance rate, cancellation rate, on-time metrics, and tier eligibility (Lite/Pro/Premium).

1. Migration 012_driver_performance.sql: driver_metrics(driver_id, acceptance_rate,
   cancellation_rate, on_time_rate, rides_completed, current_tier ENUM('lite','pro','premium'),
   period_start, period_end), tier_thresholds(tier, min_acceptance_rate, max_cancellation_rate,
   min_on_time_rate, min_rides).
2. Backend backend/src/services/driver-performance.service.ts: a recalculateMetrics(driverId)
   job (triggered on each ride's terminal state — accepted/cancelled/completed/late — from
   rides.routes.ts) that updates rolling-window metrics and re-evaluates tier against
   tier_thresholds. Run this as a scheduled job too (cron via node-cron or existing job runner)
   for periodic recalculation, not just event-driven.
3. Tier benefits should hook into staking (Phase 7) and subscriptions (Phase 14) — e.g. Premium
   tier gets a subscription discount and priority matching weight, mirroring how stake tier
   already affects matching-engine.service.ts.
4. Routes: GET /driver/performance (own metrics + tier + progress to next tier).
5. Mobile/driver: replace/extend the current earnings-only dashboard
   (mobile/driver/src/screens/app/DashboardScreen.tsx) with a Performance tab showing the four
   metrics as progress rings, current tier badge, and "what you need for the next tier" copy.
```

---

## Phase 14 — Subscription Logic Extensions (Gap #14)

```
Extend the existing basic subscription plans to support token-based payment, staking discounts,
and performance-linked benefits.

1. Migration 013_subscription_extensions.sql: add payment_method ENUM('fiat','dvt') and
   discount_applied_pct and discount_reason to whatever subscriptions table already exists
   (check payment.service.ts / existing schema first — extend, don't recreate).
2. Backend: in the subscription renewal/charge logic, add branching: if payment_method='dvt',
   call token.service.ts to burn/transfer the DVT-equivalent amount instead of charging
   the PaymentProvider interface from Phase 0A (resolves to whichever provider is active for
   that driver's country); compute discount_applied_pct as the sum of (a) staking tier discount
   (Phase 7)
   and (b) performance tier discount (Phase 13), capped at a configurable max total discount.
3. Routes: extend the existing subscription endpoints to accept a payment_method field and
   return the computed discounted price before confirming.
4. Mobile/driver: update the subscription screen to show "Pay with Wallet (fiat)" vs "Pay with
   DVT", the applicable discount breakdown (from staking + performance), and final price.
```

---

## Phase 15 — Rental / Fleet Expansion (Gap #15)

```
Extend rentals beyond chauffeur-only to support self-drive, with a phased rollout flag.

1. Migration 014_rental_expansion.sql: add rental_type ENUM('chauffeur','self_drive') to the
   existing rentals table (check current schema first), plus
   self_drive_requirements(rental_id, license_upload_url, deposit_amount, deposit_status),
   rental_pricing(id, vehicle_type_id, rental_type, rate_unit ENUM('hourly','daily'), rate_amount,
   currency_code, min_duration, max_duration) — the brand deck specifies both hourly and daily
   pricing for rentals, which the current schema doesn't distinguish; add this now rather than
   bolting it on later, and a feature_flags table (key, enabled, rollout_pct) to support
   phase-based rollout (e.g. enable self_drive only for a % of users/cities initially).
2. Backend: extend the rental booking endpoint to (a) let the renter choose hourly vs daily
   pricing at booking time, computing total cost from rental_pricing and the selected duration,
   and (b) branch on rental_type — self_drive requires license verification (reuse
   identity-verification.service.ts's document-check pipeline) and a refundable deposit hold
   (payment.service.ts — check if it supports holds/pre-auths; if not, add a
   the PaymentProvider interface's preauthorization methods from Phase 0A — if the resolved
   provider for that country is Paystack, this uses its native Preauthorization API (initialize,
   capture, or auto-release on expiry) directly; if Flutterwave is resolved instead, use its
   existing hold/capture equivalent.
3. Add a simple feature-flag check helper backend/src/services/feature-flags.service.ts read by
   the rental routes to gate self_drive per user/city during rollout.
4. Mobile/customer RentalHomeScreen.tsx (from Phase 1): add a Chauffeur vs Self-Drive toggle
   (only show Self-Drive if the feature flag is on for that user), an Hourly vs Daily rate
   toggle showing the computed price for the selected duration, and for self-drive, a license
   upload + deposit step before confirming.
5. Admin: extend the vehicle-type pricing management from Phase 24 to cover rental rates too, so
   hourly/daily rental pricing is admin-editable per vehicle type and region the same way ride
   fares are, not hardcoded.
```

---

## Phase 16 — Rewards Trigger Engine (Gap #16)

```
Refactor the scattered reward inserts from Phases 6/10/13 into one central trigger engine so
rewards on ride/order/delivery/referral are automatic and consistent.

1. Create backend/src/services/rewards-engine.service.ts exposing a single
   emitActivityEvent(userId, eventType, metadata) function, where eventType is one of
   'ride_completed' | 'order_completed' | 'delivery_completed' | 'referral_qualified' |
   'stake_created' | etc.
2. Internally, this service reads a rewards_rules table (migration 015_rewards_engine.sql:
   rewards_rules(event_type, points_amount, dvt_amount, active)) and, for each matching active
   rule, writes to points_ledger (Phase 6) and optionally calls token.service.ts.distributeReward
   (Phase 5) — this replaces the direct points_ledger inserts you added ad hoc in Phases 6/10.
3. Go back and refactor: rides.routes.ts ride-completion handler, Phase 2's order-completion
   handler, Phase 11's delivery-completion handler, and Phase 10's referral qualification —
   replace their direct reward-writing code with a single call to
   rewardsEngine.emitActivityEvent(...).
4. Add an admin-only GET/PATCH /admin/rewards-rules so reward amounts can be tuned without a
   deploy — surface this in frontend/admin as a simple rules table editor.
```

---

## Phase 17 — Operations Console / Advanced Admin (Gap #17)

```
Upgrade frontend/admin from standard tools to an advanced ops console.

1. Add AdminLiveMapPage.tsx: a unified live map subscribing to the ride tracking, delivery
   tracking (Phase 4), and rental location Socket.io rooms simultaneously, with filter toggles
   for Rides / Parcels / Shops / Rentals and color-coded markers.
2. Backend: add POST /admin/rides/:id/force-cancel, POST /admin/rides/:id/adjust-fare
   (with a required reason field, logged), POST /admin/orders/:id/force-cancel — all behind
   a requireRole('admin') guard (extend auth.middleware.ts's role check from Phase 3).
3. Add an ops_notes table (migration 016_ops_console.sql: ops_notes(id, entity_type, entity_id,
   author_admin_id, note, created_at)) and a GET/POST /admin/notes endpoint, surfaced as a
   collapsible notes panel on ride/order/user detail views in frontend/admin
   (extend frontend/admin/src/pages/Dashboard.tsx and add per-entity detail pages if they
   don't exist yet).
4. Every force-cancel / fare-adjustment / status-override action must write to a shared
   audit_log table (check if one exists already given SECURITY_FEATURES_GUIDE.md mentions audit
   logging — extend it, don't duplicate) capturing admin_id, action, entity, before/after, reason.
```

---

## Phase 18 — Financial & Settlement Engine (Gap #18)

```
Replace "basic reports only" with a real settlement/finance engine.

1. Migration 017_financial_engine.sql: gmv_daily_rollup(date, country, service_type, gmv_amount,
   currency), payout_batches(id, status, total_amount, initiated_by, created_at, completed_at),
   payout_batch_items(batch_id, merchant_id or driver_id, amount, status, tx_reference).
2. Backend backend/src/services/settlement.service.ts:
   - a scheduled job (nightly) that rolls up GMV by service (ride/shop/parcel/rental) and country
     into gmv_daily_rollup from the orders/rides tables.
   - createPayoutBatch(recipientType, periodStart, periodEnd) that aggregates all pending
     merchant/driver earnings and creates a payout_batches + payout_batch_items set, then calls
     the PaymentProvider interface's bulkTransfer method from Phase 0A — when resolved to
     Paystack, batches are capped at 100 transfers per file, so chunk larger payout runs
     accordingly; Flutterwave's batch limits differ, handle both inside the respective
     implementation, not at the call site.
   - reconciliation export: GET /admin/finance/reconciliation?format=csv streaming a CSV of all
     transactions vs settled amounts for a period, for finance-team download.
3. Routes: GET /admin/finance/gmv (filterable by service_type, country, date range), GET/POST
   /admin/finance/payout-batches, GET /admin/finance/payout-batches/:id.
4. Frontend/admin: FinanceDashboardPage.tsx with GMV charts by service/country (use a charting
   lib consistent with whatever Dashboard.tsx already uses, or add Recharts if none is present),
   a payout batch review/approve screen, and a reconciliation export button.
```

---

## Phase 19 — In-App Inbox (Gap #19)

```
Add a central inbox for system messages, replacing push-only notifications.

1. Migration 018_inbox.sql: inbox_messages(id, user_id, category ENUM('system','promo',
   'order_update','ride_update','rewards','security'), title, body, read boolean,
   deep_link, created_at).
2. Backend: create backend/src/services/inbox.service.ts with a sendInboxMessage(userId,
   category, title, body, deepLink) helper, and hook it into every place that currently only
   sends a push notification (search for existing push/notification calls across
   rides.routes.ts, sos-emergency.service.ts, the merchant/order flows, and rewards-engine.service.ts
   from Phase 16 — add a matching inbox write next to each push call, not instead of it).
3. Routes: GET /inbox (paginated, filterable by category), PATCH /inbox/:id/read,
   PATCH /inbox/mark-all-read.
4. Mobile: InboxScreen.tsx (shared component usable by both customer and driver apps) with
   category filter tabs and unread-count badge on the app's home tab bar icon.
```

---

## Phase 20 — Multi-Country Readiness (Gap #20)

```
Fix the current default-USD/limited-country-logic problem with proper localization.

1. Migration 019_multi_country.sql: countries(code, name, currency_code, dial_code,
   otp_format_regex, is_active), city_pricing(id, city, country_code, base_fare, per_km_rate,
   per_min_rate, currency_code, timezone).
2. Backend: create backend/src/services/localization.service.ts:
   - detectCountry(phoneNumber or geoIp) to set the correct dial code/OTP format at signup
     (fix the "country-aware OTP" gap) — apply this in whatever auth signup flow currently issues
     OTPs.
   - getCityPricing(lat, lng) resolving to the nearest matching city_pricing row instead of a
     hardcoded USD default — wire this into the ride fare calculation and delivery fee calculation
     wherever they currently hardcode a currency/rate.
   - convert(amount, fromCurrency, toCurrency) using a cached FX rate table refreshed daily from
     an FX API, for any cross-currency display.
3. All monetary display across frontend/web, frontend/admin, mobile/customer, mobile/driver must
   read currency_code from the relevant city/country context, not assume USD — do a repo-wide
   search for hardcoded "$" or "USD" and replace with a formatCurrency(amount, currencyCode) helper.
4. Add timezone-aware timestamp formatting (use the timezone from city_pricing/countries) for
   all trip/order timestamps shown to users, via a shared formatLocalTime helper.
```

---

## Phase 21 — Non-Functional Requirements (Gap #21)

```
Harden performance, observability, and architecture without changing product behavior.

1. Matching speed target (2–3s): profile matching-engine.service.ts under load (write a k6 or
   autocannon load test script in backend/scripts/load-test-matching.ts) and optimize the
   PostGIS nearest-driver query (ensure a GIST index exists on driver location columns — add via
   migration 020_perf_indexes.sql if missing) and add Redis caching (redis.service.ts) for
   frequently re-queried nearby-driver sets with a short TTL.
2. Structured logging: replace any ad hoc console.log across backend/src with the existing
   Winston logger pattern (check if one is already configured; if not, add
   backend/src/utils/logger.ts) with consistent structured fields (requestId, userId, service,
   durationMs) on every request via middleware.
3. Error tracking: confirm Sentry is wired in both backend/src/index.ts and all frontend/mobile
   entry points (check current .env.example for a SENTRY_DSN var — if unused anywhere, add the
   Sentry SDK init to each app's entrypoint).
4. Microservice-ready architecture: document, in ARCHITECTURE.md, clear service boundaries for
   a future split (auth, rides/matching, marketplace, payments/wallet, token/blockchain,
   notifications/inbox) even while running as a monolith today — and ensure each domain's code
   already lives in its own backend/src/services/*.service.ts file (per the pattern already used)
   so a future extraction is a lift-and-shift, not a rewrite.
5. Add health check endpoints (GET /health, GET /health/db, GET /health/redis) if not already
   present, for load balancer / k8s readiness probes referenced in docker-compose.yml.
```

---

## Phase 22 — Offline & Low-Connectivity Booking Channels (WhatsApp, Telegram, SMS/USSD, IVR)

**Why this matters for your markets:** riders without a data connection, low-end phones, or app
literacy should still be able to book a ride — including entirely by voice, whether that's a
voice note on WhatsApp/Telegram or an actual phone call with zero app or data required. This
reuses your existing ride-creation and matching logic, and Phase 23's voice-transcription
pipeline — the channels are just alternate front doors into the same backend, not a parallel
booking system.

```
Add four alternate booking channels that all funnel into the existing ride-creation flow in
rides.routes.ts and matching-engine.service.ts — do not duplicate fare calculation, matching, or
driver-assignment logic; every channel below must call the same internal service functions the
mobile app uses.

1. Refactor first: extract the core "create a ride request" logic currently inline in
   rides.routes.ts's POST /rides handler into a channel-agnostic function,
   e.g. backend/src/services/ride-booking.service.ts's createRideRequest(userId, pickup,
   destination, rideType, sourceChannel: 'app'|'whatsapp'|'telegram'|'sms'|'ivr'). The existing
   POST /rides route becomes a thin wrapper calling this with sourceChannel='app'. Add
   source_channel to the rides table (migration 021_alt_channels.sql).

2. WhatsApp Business API channel:
   - backend/src/services/whatsapp-bot.service.ts using Twilio's WhatsApp Business API (or Meta's
     Cloud API directly — pick Twilio to stay consistent with the SMS provider you already use)
     webhook handler backend/src/routes/whatsapp-webhook.routes.ts (POST /webhooks/whatsapp).
   - Conversation flow: identify user by phone number (match against existing users table; if
     unregistered, guide through a minimal WhatsApp-only registration collecting name + confirming
     phone), then a simple guided flow: "Where are you? (share location or type address)" →
     "Where to?" → show fare estimate + ride type options as WhatsApp quick-reply buttons →
     confirm → call ride-booking.service.ts's createRideRequest.
   - Send status updates back over WhatsApp (driver assigned, driver en route, arrived, trip
     started, completed with fare) by hooking into the same events that currently push
     notifications/inbox messages (Phase 19) — add a WhatsApp send alongside those, gated by
     whether this ride's source_channel or the user's stored channel preference is 'whatsapp'.
   - Support location sharing via WhatsApp's native location-pin message type as the pickup input.
   - **Voice notes:** WhatsApp messages can be audio (`type: "audio"` in the webhook payload,
     specifically a voice-note recording). When a user sends a voice note instead of typing,
     download the audio via Twilio's/Meta's media URL and pass it to the same
     `voice-intent.service.ts` transcription + intent-extraction pipeline built in Phase 23 —
     do not build a second transcription path. Reply with the same structured confirmation
     (pickup, destination, ride-type options sorted by price) as WhatsApp quick-reply buttons, so
     a rider can send one voice note ("I'm going from Osu to the airport") instead of typing
     through the guided flow step by step.

3. Telegram channel:
   - backend/src/services/telegram-bot.service.ts using the Telegram Bot API (node-telegram-bot-api
     or grammY), webhook at POST /webhooks/telegram.
   - Same conversational flow as WhatsApp, using Telegram's native location-sharing and inline
     keyboard buttons for ride-type/confirm selection. Link Telegram chat_id to the user account
     the same way as the WhatsApp phone-number linking (a shared user_channel_links table:
     user_id, channel, external_id).
   - **Voice notes:** Telegram's Bot API delivers voice messages as a `voice` field (OGG/Opus
     format) on the update object. Download via `getFile`, convert if needed, and route through
     the same `voice-intent.service.ts` pipeline from Phase 23 — one shared transcription/intent
     service backing in-app mic input, WhatsApp voice notes, and Telegram voice messages, not
     three separate implementations.

4. SMS/USSD channel (for zero-data-connection phones):
   - backend/src/services/sms-booking.service.ts using your existing Twilio SMS setup.
   - **Note on voice for this channel:** SMS is text-only by protocol — there's no such thing as
     a "voice note over SMS." A booking-by-voice option that works on any phone with zero data
     (not even the app or WhatsApp/Telegram) means a phone call, not a text message — see the IVR
     addition at the end of this phase for that.
   - Two paths, since SMS is one-way-friendly but USSD is menu-driven and works on any phone
     without even SMS charges in many African markets:
     a) SMS keyword flow: user texts a short code (e.g. "RIDE <pickup>, <destination>") to a
        dedicated number; parse loosely (support common formats, fall back to "reply with pickup
        and destination separated by a comma" on parse failure), reply with a fare estimate and
        "Reply YES to confirm", then create the ride on confirmation.
     b) USSD flow (bigger lift, higher value): integrate a USSD gateway (e.g. Africa's Talking,
        which already covers Ghana/most African telcos) — build a session-based menu:
        1) Book a ride → 2) enter pickup (saved addresses from Phase 1 show as numbered options)
        → 3) enter destination → 4) confirm fare → ride created. Add
        backend/src/routes/ussd-webhook.routes.ts (POST /webhooks/ussd) handling the gateway's
        session protocol (each request is stateless with a session ID — store conversation state
        in Redis via redis.service.ts, keyed by session ID, short TTL).
   - Status updates for SMS/USSD users go out as plain SMS (driver assigned + name + plate,
     arrived, fare on completion) since there's no rich UI to push to.

5. IVR voice booking (the actual zero-data, zero-app, zero-typing voice channel): a rider calls
   a dedicated number on any phone — no internet, no app, not even SMS — and speaks their trip.
   - backend/src/services/ivr-booking.service.ts using Twilio Voice (consistent with the Twilio
     SMS/WhatsApp setup already in use) or Africa's Talking Voice API.
   - Call flow: answer → short prompt ("Tell us where you're going after the beep") → record →
     send the recording through the same voice-intent.service.ts pipeline from Phase 23 →
     synthesize a spoken confirmation back to the caller via text-to-speech ("From Osu to the
     airport, Economy, 45 cedis, press 1 to confirm or say yes") → capture DTMF digit-press or a
     spoken "yes" as confirmation → call the same createRideRequest with sourceChannel='ivr'.
   - This is the highest-latency, lowest-bandwidth channel by design — keep the call flow to the
     minimum number of steps, and always offer a DTMF fallback (press 1) alongside spoken
     confirmation, since voice recognition accuracy over a phone line is lower than over
     WhatsApp/Telegram's cleaner audio codecs.

6. All channels must respect the same fare, matching-speed, and driver-tier logic already built
   — no separate/simplified matching algorithm for "SMS users." Add a lightweight rate-limit
   per phone number (via redis.service.ts) on each webhook to prevent abuse, since these channels
   have no app-level auth/session, only phone-number verification.

7. Add an admin view (frontend/admin) listing rides by source_channel so you can monitor adoption
   and failure rates per channel (e.g. how many WhatsApp conversations start but don't reach
   confirmation) — surface this as a simple funnel chart alongside the Phase 18 finance dashboard.

Note: WhatsApp Business API and Telegram bots require phone-number/business verification with
Meta and a bot token from Telegram respectively — these are account setup steps outside Cursor's
scope, but the webhook code above is what plugs into them once you have the credentials.
```

---

---

## Phase 23 — Voice-Based Ride Booking ("Speak to Order")

**Goal:** rider taps a mic button, says something like "I'm going from Osu to the airport," and
the app extracts pickup/destination, geocodes both, fetches fare estimates across all ride
types, auto-highlights the cheapest option, and lets the rider confirm with one tap or a spoken
"yes" — reusing the exact same fare/matching pipeline as manual booking, not a separate path.

```
Add a voice-ordering flow to mobile/customer, built entirely on top of the channel-agnostic
ride-booking service from Phase 22 (backend/src/services/ride-booking.service.ts) — do not
create a second fare-calculation or matching path for voice.

1. Mobile UI (mobile/customer/src/screens/app/):
   - Add a mic button to SuperAppHomeScreen.tsx's Ride tab (from Phase 1), opening
     VoiceBookingScreen.tsx.
   - Use on-device speech-to-text (expo-speech-recognition or react-native-voice) to capture
     the utterance locally where possible; for accuracy on accents/background noise, fall back to
     sending the recorded audio to the backend for transcription rather than relying purely on
     on-device STT if confidence is low.
   - Show a live transcript as the person speaks, plus a "Tap to speak again" retry if parsing
     fails.

2. Backend transcription + parsing:
   - backend/src/routes/voice-booking.routes.ts: POST /voice/parse-intent accepting either raw
     text (if STT ran on-device) or an audio file (if it needs server-side transcription — use
     OpenAI's Whisper API, consistent with the OpenAI usage already planned for recommendations
     per PROJECT_STRUCTURE.md).
   - backend/src/services/voice-intent.service.ts: extractTripIntent(utterance) — use a single
     structured-output call to an LLM (OpenAI API, same provider already in your stack) with a
     strict prompt asking only for JSON: { origin: string|null, destination: string|null,
     rideTypePreference: string|null, confidence: number }. Do not attempt hand-written regex
     parsing as the primary method — natural speech varies too much ("going to," "heading from,"
     "pick me up at," relative terms like "the airport," "home," "work"); resolve relative terms
     like "home"/"work" against the user's saved_addresses from Phase 1 before geocoding.
   - Geocode origin/destination via your existing Google Maps/Mapbox integration (check
     matching-engine.service.ts or wherever addresses currently get geocoded for manual entry —
     reuse that exact geocoding call, don't add a second one).
   - If origin is missing/ambiguous, default to the user's current GPS location and say so back
     to them ("Using your current location as pickup") rather than asking a clarifying question
     when it's not truly needed — but if destination is missing or confidence is below a
     threshold, return a clarification prompt instead of guessing.

3. Multi-option fare comparison:
   - Extend (or reuse, if already generic) matching-engine.service.ts's calculateFare to run
     once per available ride type (Economy/Comfort/Premium/etc.) for the parsed origin/
     destination, returning an array sorted ascending by price, each with estimated ETA and
     driver-availability count nearby.
   - POST /voice/parse-intent's response includes this sorted list, with the cheapest option
     flagged isRecommended: true.

4. Confirmation step (required — do not auto-book without this):
   - VoiceBookingScreen.tsx shows a confirmation card: "Pickup: {origin} → Destination:
     {destination} — {rideType}, {price}, ~{eta} away" with the cheapest option pre-selected and
     other options swipeable/tappable to switch, plus a "Book" button.
   - Support a spoken confirmation too ("yes," "book it," "confirm") captured by the same STT
     and matched via voice-intent.service.ts's confirmIntent(utterance) — but always show the
     visual confirmation card regardless of whether confirmation is spoken or tapped, so the
     rider can catch a misheard address before it books.
   - On confirm, call the same createRideRequest(userId, pickup, destination, rideType,
     sourceChannel='voice') from Phase 22 — no separate booking code path.

5. Add source_channel='voice' handling to the admin funnel view from Phase 22 so you can track
   voice-booking adoption and where parsing fails (log low-confidence/ambiguous parses to a
   voice_parse_failures table for later tuning of the prompt/geocoding).

6. Accessibility note: this flow is also valuable for low-literacy users and drivers with visual
   strain — consider adding text-to-speech read-back of the confirmation card (not just visual)
   using the same TTS capability many phones expose natively, so the flow works fully hands-free.
```

---

## Phase 24 — Admin-Configurable Vehicle Types & Pricing

**Current state (checked directly in code):** `matching-engine.service.ts`'s `calculateFare`
has only three generic tiers — `standard`, `express`, `premium` — with base fare, per-km rate,
and per-minute rate **hardcoded as plain objects in the file**. There is no Motorcycle,
Tricycle, Sedan, SUV, Van, or Luxury distinction, and no admin UI to change any number — today
that requires editing this file and redeploying. This phase replaces that with a real,
admin-managed system.

```
Replace the hardcoded baseFare/perKmRate/perMinuteRate objects in
matching-engine.service.ts's calculateFare with a database-driven vehicle-type and pricing
system manageable from frontend/admin, with no redeploy needed to change a price.

1. Migration 022_vehicle_types_pricing.sql:
   - vehicle_types(id, name, code, category ENUM('motorcycle','tricycle','sedan','suv','van',
     'luxury','bus'), passenger_capacity, icon_url, is_active, sort_order)
   - vehicle_type_pricing(id, vehicle_type_id, city_id or country_code (reuse the
     countries/city_pricing tables from Phase 20 if built, otherwise a simple region_code for
     now), base_fare, per_km_rate, per_minute_rate, minimum_fare, currency_code, cancellation_fee,
     effective_from)
   - Seed sensible defaults for Motorcycle, Tricycle, Sedan (Standard), SUV, Van, Luxury based on
     roughly the existing standard/express/premium numbers as a starting point, so nothing breaks
     on migration — Motorcycle/Tricycle should default lower than Sedan, Luxury/Van higher.
   - Add vehicle_type_id (FK) to the existing drivers/vehicles table (check current schema for
     wherever a driver's vehicle is recorded — likely referenced in
     identity-verification.service.ts's document verification; extend it, don't duplicate) so a
     driver's actual registered vehicle determines which vehicle_type they can accept rides for.

2. Refactor calculateFare(distanceKm, durationMinutes, vehicleTypeId, regionId) to look up
   vehicle_type_pricing for that vehicle type + region from the database (cache in Redis via
   redis.service.ts with a short TTL since pricing rarely changes, to avoid a DB hit on every
   fare estimate), apply minimum_fare as a floor, and keep the existing surge multiplier logic
   layered on top unchanged.

3. Backend admin routes backend/src/routes/admin-vehicle-pricing.routes.ts:
   - GET/POST/PATCH /admin/vehicle-types (create new types like Tricycle/Van without a code
     change, toggle is_active to hide a type from riders without deleting history)
   - GET/PATCH /admin/vehicle-types/:id/pricing (per-region pricing rows, with effective_from so
     price changes can be scheduled rather than instant, and old rows kept for historical fare
     auditing/reconciliation — never overwrite a pricing row that's already been used in a
     completed ride's fare calculation)
   - All writes here go through the same audit_log pattern from Phase 17 (admin_id, before/after,
     reason).

4. Frontend/admin: VehicleTypesPage.tsx — table of vehicle types with add/edit/deactivate, and a
   PricingPage.tsx per vehicle type showing a region-by-region pricing table (base fare, per-km,
   per-minute, minimum fare, currency) with inline editing and a clear "Save & schedule" flow
   (effective immediately vs a future effective_from date/time).

5. Mobile customer: the ride-type selector (wherever rideType is currently chosen — check
   HomeScreen.tsx / SuperAppHomeScreen.tsx from Phase 1) must now pull from GET
   /vehicle-types?region=... instead of a hardcoded list of three, rendering each with its icon,
   name, capacity, and live fare estimate. The voice-booking multi-option comparison from Phase
   23 and the fare estimate shown in Phase 22's WhatsApp/SMS flows must all read from this same
   endpoint too — there should be exactly one source of vehicle types and pricing across every
   channel (app, voice, WhatsApp, Telegram, SMS/USSD), not one hardcoded copy per channel.

6. Driver-side: mobile/driver's ride-request screen should only show ride requests matching the
   driver's own registered vehicle_type_id (a Sedan driver shouldn't be offered a Motorcycle
   request) — enforce this filter in matching-engine.service.ts's driver-matching query, not just
   client-side.
```

---

## Phase 25 — Dynamic / Contextual Pricing Engine (Time, Traffic, Day, Weather, Zone)

**Current state (checked directly in code):** `getSurgeMultiplier()` only compares
active-rides-to-available-drivers **globally** (one ratio for the entire platform, not per
city/zone) and returns a flat 1.0x–2.0x multiplier. There is no time-of-day, weekday/weekend,
traffic, weather, or per-location factor anywhere in the pricing path. This phase replaces the
single global ratio with a proper multi-factor, per-zone pricing engine — each factor
independently tunable by admin, so you can turn any one of them off/down without touching code.

```
Replace getSurgeMultiplier()'s single global demand ratio with a zone-aware, multi-factor
pricing engine, layered on top of the vehicle-type base pricing from Phase 24 — do not change
how base_fare/per_km_rate/per_minute_rate work, this only adds a multiplier stack on top.

1. Migration 023_dynamic_pricing.sql:
   - pricing_zones(id, name, region_id, boundary_geojson or center_lat/center_lng + radius_km —
     match whatever geo approach PostGIS already uses elsewhere in the codebase for consistency)
   - pricing_factors(id, factor_type ENUM('demand','time_of_day','day_of_week','weather',
     'traffic','event'), is_active, weight_or_config_json) — one row per factor so each can be
     toggled independently
   - zone_demand_snapshots(zone_id, active_rides, available_drivers, recorded_at) — per-zone,
     not global, replacing the single global counters currently read from Redis
   - pricing_multiplier_log(ride_id, zone_id, demand_multiplier, time_multiplier, day_multiplier,
     weather_multiplier, traffic_multiplier, event_multiplier, final_multiplier, calculated_at) —
     log every component so a rider/driver dispute over a fare can be explained factor-by-factor,
     not just "surge was 1.8x."

2. Backend backend/src/services/pricing-engine.service.ts replacing getSurgeMultiplier():
   - resolveZone(lat, lng) → pricing_zones lookup (fall back to a default city-wide zone if no
     specific zone matches).
   - getDemandMultiplier(zoneId): same active-rides/available-drivers ratio logic as today, but
     scoped to the zone via zone_demand_snapshots instead of the global Redis counters — update
     the ride-accept/complete hooks in rides.routes.ts to increment/decrement the correct zone's
     counters, not a single global one.
   - getTimeOfDayMultiplier(zoneId, timestamp): configurable multiplier bands (e.g. 1.0x off-peak,
     1.15x morning/evening rush) stored in pricing_factors.weight_or_config_json as a simple
     hour-range table per zone — admin-editable, not hardcoded rush-hour times.
   - getDayOfWeekMultiplier(zoneId, timestamp): e.g. Friday/Saturday night uplift, configurable
     the same way.
   - getWeatherMultiplier(zoneId): call a weather API (e.g. OpenWeatherMap) for the zone's
     lat/lng, cache the result in Redis with a ~15-30 min TTL (weather doesn't need per-request
     calls), and map conditions (rain/storm) to a configurable multiplier — never call the
     weather API synchronously per fare request without this cache, to avoid latency and API
     cost blowup at scale.
   - getTrafficMultiplier(originLat, originLng, destLat, destLng): use the traffic-aware duration
     from your existing Google Maps/Mapbox directions call (check if the current duration
     estimate already requests traffic-aware ETAs — if not, add the traffic parameter to that
     existing call rather than adding a second directions API call) and derive a multiplier from
     how much the traffic-aware duration exceeds the free-flow duration for that route.
   - getEventMultiplier(zoneId, timestamp): a simple admin-entered events table (name, zone,
     start/end, multiplier) for known demand spikes (concerts, holidays) that admin can schedule
     in advance rather than relying on organic demand-ratio detection to catch it late.
   - combineMultipliers(...): default to multiplying all active factors together, but cap the
     combined multiplier at a configurable max_surge_cap per zone (protect against runaway
     compounding, e.g. rain + rush hour + high demand all stacking past what's reasonable) — make
     this cap admin-editable per zone/region, since acceptable surge ceilings vary by market and
     may be subject to local regulation.
   - Every calculateFare call (Phase 24's refactored version) now calls this engine instead of
     the old getSurgeMultiplier, and writes one row to pricing_multiplier_log per fare.

3. Backend admin routes backend/src/routes/admin-pricing-engine.routes.ts:
   - GET/PATCH /admin/pricing-factors (toggle each factor type on/off globally or per zone,
     edit the config for time-of-day bands, day-of-week uplifts, weather multiplier mapping)
   - GET/POST/PATCH /admin/pricing-zones (draw/edit zone boundaries)
   - GET/POST/PATCH /admin/pricing-events (schedule event-based surge windows)
   - GET/PATCH /admin/pricing-zones/:id/max-surge-cap
   - All writes through the Phase 17 audit_log pattern.

4. Frontend/admin: PricingEngineePage.tsx — per-zone panel showing each active factor and its
   current live multiplier value (a simple "current pricing breakdown" readout, e.g.
   "Demand 1.2x × Rush hour 1.15x × Rain 1.1x = 1.5x, capped at 1.5x"), toggles for each factor,
   an events calendar, and a zone map editor (reuse whatever mapping library the Phase 17 ops
   console live map already uses).

5. Rider-facing transparency: in the fare estimate shown across every booking channel (app,
   voice from Phase 23, WhatsApp/Telegram/SMS from Phase 22), surface a one-line reason when
   the multiplier is above 1.0x — e.g. "Fares are higher due to high demand in your area" — by
   reading which factors were active from pricing_multiplier_log, rather than showing a bare
   multiplier number with no explanation. This matters for trust and for any local regulatory
   requirement to disclose surge pricing to consumers.

6. Note on weather/traffic API cost and reliability: both are external dependencies with their
   own uptime/rate-limit behavior — wrap both calls in a try/catch that falls back to
   multiplier=1.0 (i.e. "no adjustment") rather than failing the whole fare calculation if either
   API is down or rate-limited.
```

---

## Phase 26 — West African National ID Verification & Identity Linking (Ghana Card + Regional IDs)

**Current state (checked directly in code):** `identity-verification.service.ts` supports a
generic `national_id | passport | driving_license` type through a generic 3rd-party API
(IDology/Jumio-style) plus AWS Textract OCR, and there's already one Ghana-specific call
(`business-registry.gov.gh`) but only for merchant business registration. There is **no Ghana
Card (NIA) integration, no vehicle-license verification, and each document type is verified in
isolation** — nothing today confirms that a driver's national ID, driving license, vehicle
license, and phone number all belong to the same person. This phase builds that identity graph
and adds proper country-specific ID handling for Ghana and other West African markets.

```
Extend identity-verification.service.ts (do not replace it — this adds new document-type
handlers and a linking layer on top of the existing upload/OCR/face-match pipeline) to support
Ghana Card verification and a cross-verified identity graph tying national ID, driving license,
vehicle license, and phone number together per user.

1. Migration 024_national_id_linking.sql:
   - id_verification_providers(id, country_code, id_type ENUM('ghana_card','nigeria_nin',
     'cote_divoire_oneci','senegal_cni','other'), provider_name, api_base_url, is_active) —
     one row per country's national ID system, since each has a different verifying authority
     (Ghana: NIA / Ghana Card; Nigeria: NIMC / NIN; Côte d'Ivoire: ONECI; Senegal: CNI; etc.) and
     you'll be onboarding these incrementally, not all at once.
   - identity_documents (extend the existing table backing IdentityDocument if one exists, or
     create if the current implementation only stores documents inline — check first) gains:
     national_id_number, national_id_country, driving_license_number,
     driving_license_issuing_authority, vehicle_registration_number, linked_phone_number,
     link_verified boolean, link_verified_at.
   - identity_link_checks(id, user_id, check_type ENUM('id_to_license','id_to_vehicle',
     'id_to_phone'), status ENUM('match','mismatch','unverifiable'), details_json, checked_at) —
     log every cross-check individually so a failed link is diagnosable (which specific pairing
     failed) rather than a single opaque "verification failed."

2. Backend: add ghana-card-verification.service.ts implementing the NIA (National Identification
   Authority) verification API integration — verify(ghanaCardNumber, fullName, dateOfBirth)
   returning a match confidence and the NIA-held biodata for comparison against the uploaded
   document's OCR result. Structure this as one implementation of a shared
   NationalIdVerifier interface so Nigeria's NIN, Côte d'Ivoire's ONECI, and other countries'
   systems can be added later as additional implementations without changing calling code —
   identity-verification.service.ts should call verifyNationalId(countryCode, idNumber, ...)
   and dispatch to the right provider based on id_verification_providers, not hardcode Ghana Card
   as the only path.

3. Add driving-license-verification.service.ts calling Ghana's DVLA (Driver and Vehicle Licensing
   Authority) verification endpoint if one is available for third-party integration (confirm
   current API access — if DVLA doesn't expose a public verification API yet, fall back to OCR +
   manual review flag rather than blocking the flow, and note this as a known gap until DVLA
   access is secured). Same pattern for vehicle registration/roadworthiness verification.

4. Identity-linking logic in identity-verification.service.ts:
   - linkIdentityDocuments(userId): after national ID, driving license, and vehicle license are
     each individually verified, cross-check: does the name/DOB on the driving license match the
     national ID's biodata (id_to_license)? Is the vehicle registration's owner name a match or
     an authorized-operator match to the driver (id_to_vehicle — handle the common case where a
     driver operates a vehicle registered to someone else, e.g. a fleet owner, by supporting an
     authorization-letter/vehicle-lease-agreement document type as an alternative to direct
     ownership match)? Does the phone number used for OTP/account signup match a number
     registered to that national ID where the telco/regulator exposes such a check (id_to_phone —
     many West African markets require SIM registration tied to a national ID; only attempt this
     check where a legitimate API for it exists, do not scrape or guess).
   - Write one identity_link_checks row per check. Only mark the driver/merchant as
     fully "Identity-Linked" (a status distinct from basic KYC-approved) when all applicable
     checks pass — this feeds directly into the Phase 5A blockchain attestation's recordHash,
     so the on-chain attestation can optionally reflect "full identity link verified" as a higher
     trust tier than "documents individually verified."

5. Routes: extend the existing KYC endpoints (Phase 3's merchant flow and the driver
   onboarding flow) to collect country of ID issuance first, then render the correct document
   fields for that country (Ghana Card number format vs Nigeria NIN format, etc.) rather than one
   generic "ID number" field — add a country_code parameter to the upload flow that determines
   which field labels/validation patterns (regex per id_type) the frontend shows.

6. Frontend/admin: add an IdentityLinkPage.tsx per driver/merchant showing the four linked
   attributes (National ID, Driving License, Vehicle License, Phone) each with its own
   match/mismatch/unverifiable status from identity_link_checks, so a reviewer can see exactly
   which link failed rather than a pass/fail blob — this replaces a purely manual cross-check
   with a structured one, but keep a manual-override action (with the Phase 17 audit_log
   reason field) for edge cases like fleet-owned vehicles or name changes not yet reflected on
   one document.

7. Mobile: onboarding flow (driver and merchant) gains a "Country of ID" selector before document
   upload, then Ghana Card / driving license / vehicle license capture steps in sequence, each
   showing live OCR-extracted fields for the person to confirm/correct before submission.

Practical note: government verification APIs (NIA, DVLA, telco SIM-registration checks) require
your own institutional access/agreements to call directly — this prompt builds the integration
code and interface, but getting production API credentials from NIA/DVLA/telcos is a business
step outside Cursor's scope, same as the WhatsApp/Telegram credentials in Phase 22. Where an API
isn't available yet, the flow should degrade to OCR + manual review, not block onboarding
entirely, and should be flagged clearly to admin as "pending automated verification."
```

---

## Phase 27 — Cross-Border Wallet Transfers (Payments Pillar Gap)

**Current state:** the brand deck's Payments pillar promises "Blockchain wallet, rewards, and
**cross-border**." The wallet exists (Phase 1), rewards/token exist (on hold — Phase 5B), but
nothing today lets a user send money to another Movr user in a different country, or pay for a
ride/order in a currency other than the one they hold balance in. This closes that gap.

```
Add cross-border, wallet-to-wallet transfers on top of the existing wallet (Phase 1) and
multi-country currency handling (Phase 20) — do not build a new payment rail; this uses the
existing dual-provider setup (Phase 0A) and the same wallets/wallet_transactions tables from
Phase 1. This is exactly the case Phase 0A's per-country provider resolution was built for:
recipients in Paystack's five live markets (Nigeria, Ghana, South Africa, Kenya, Côte d'Ivoire)
resolve to Paystack; recipients elsewhere resolve to Flutterwave automatically via the same
config table, no special-casing needed in the transfer logic itself.

1. Migration 025_cross_border_transfers.sql: wallet_transfers(id, sender_wallet_id,
   recipient_wallet_id, sent_amount, sent_currency, received_amount, received_currency,
   fx_rate_used, fee_amount, status ENUM('pending','completed','failed','reversed'),
   created_at, completed_at).
2. Backend backend/src/services/wallet-transfer.service.ts:
   - sendTransfer(senderUserId, recipientIdentifier, amount, currency): resolve the recipient by
     phone number or a Movr username/handle (add a handle field to users if one doesn't exist),
     convert via localization.service.ts's convert() from Phase 20 using a live-cached FX rate,
     apply a configurable transfer fee (flat or percentage, admin-editable), and move funds
     between wallets atomically (single DB transaction — debit sender, credit recipient, insert
     wallet_transfers row, all-or-nothing).
   - For transfers to a recipient without a Movr account yet, support a claim-link flow (generate
     a claim code, send via SMS using the existing Twilio setup from Phase 22, recipient claims
     by installing the app/registering) rather than requiring pre-existing accounts on both ends.
3. Routes: POST /wallet/transfer, GET /wallet/transfers (history), GET /wallet/transfer/quote
   (shows the recipient amount and fee before confirming — required, don't let the sender confirm
   blind, same principle as the voice-booking confirmation step in Phase 23).
4. Compliance note: cross-border money movement is one of the more regulated areas of fintech —
   transaction limits, AML/KYC thresholds, and reporting requirements vary significantly by
   country and corridor (e.g. Ghana-to-Nigeria vs Ghana-to-UK have very different rules). Gate
   this behind the identity-linking status from Phase 26 (only "Identity-Linked" users can send/
   receive cross-border transfers above a low default threshold) and add a configurable
   per-transaction and per-day limit in admin, defaulting conservatively low until compliance
   review sets real limits — do not launch this with unlimited transfer amounts.
5. Mobile: add a "Send money" flow to the WalletContext/TokenScreen area from Phase 1 — recipient
   lookup, amount + currency entry, live quote display, confirm — plus a transfer history list
   using the same shared Card/StatusPill components from Phase 0B.
```

---

## Phase 28 — In-Trip Camera Recording for Dispute Resolution

**Before the technical design, two things worth flagging directly:**

1. **"Always sent to cloud in real-time" isn't practical as literally stated.** Continuously
   live-streaming video from every active trip, for every driver, simultaneously, is a large and
   ongoing bandwidth/storage cost, and it directly contradicts the low-connectivity design ethos
   the rest of this platform is built around — Phase 22's whole WhatsApp/SMS/USSD/IVR effort
   exists because a meaningful share of your drivers and riders have limited or expensive mobile
   data. Real-time streaming would be the single most data-hungry thing in the entire app for
   exactly the users least able to afford that. The realistic version: **record locally on the
   driver's device, then upload asynchronously** (in the background, preferring Wi-Fi when
   available, chunked/resumable so a dropped connection doesn't lose footage) rather than a live
   stream — the footage still ends up in Movr's cloud storage, just not literally in real time.

2. **This needs a privacy/legal review before it's enabled, not just a technical build.** Video
   (and any audio) of a third party — the rider — being continuously recorded by the driver's
   device and centrally stored by the platform is squarely inside what Ghana's Data Protection
   Act, 2012 (Act 843) governs, and likely triggers similar consent/notice requirements in other
   West African markets you expand into. At minimum this needs: clear rider notice before the
   trip that recording is happening (not silent), a lawful basis for processing that data, a
   defined retention period rather than indefinite storage, and restricted access. Treat this the
   same way the token phases were treated — build the mechanism, but don't flip it on for real
   users until it's been reviewed, since privacy-law exposure here is real and jurisdiction-
   specific.

```
Build in-trip driver-facing camera recording for dispute resolution, designed around local
recording + deferred upload rather than live streaming, with consent, retention limits, and
access control built in from the start rather than bolted on later.

1. Migration 026_trip_recording.sql: trip_recordings(id, ride_id, driver_id, status
   ENUM('recording','uploading','uploaded','failed','deleted'), local_duration_seconds,
   cloud_storage_key, uploaded_at, retention_expires_at, flagged_for_dispute boolean,
   flagged_at, flagged_by_admin_id), recording_consent_log(id, ride_id, rider_notified_at,
   driver_consented_at) — capture consent/notice timestamps as first-class data, not an
   afterthought, since this is what you'd need to show if the recording policy is ever
   challenged.

2. Mobile/driver: add a background recording capability to ActiveRideScreen.tsx (or
   ActiveDeliveryScreen.tsx's ride equivalent) using the device's in-cabin-facing camera —
   start recording automatically when a trip begins (driver consented to this as a condition of
   the platform during onboarding — surface this clearly in driver onboarding from Phase 26,
   not buried in fine print), stop and save locally when the trip ends. Store the local file
   in an app-private, encrypted-at-rest location on the device.

3. Rider-facing notice (required, not optional): before pickup, show a clear, unmissable notice
   in the trip-confirmation flow — "This trip is recorded for safety. Recording is stored
   securely and only reviewed if there's a dispute or safety report." — logged in
   recording_consent_log. Do not make this a buried terms-of-service clause; it needs to be
   seen at the point the person is deciding whether to take the ride.

4. Backend backend/src/services/trip-recording.service.ts:
   - requestUploadUrl(rideId): generates a pre-signed, time-limited cloud storage upload URL
     (S3 or equivalent — reuse whatever storage provider is already configured via the
     Integrations Hub from Phase 0C, don't introduce a second storage provider) for the mobile
     app to upload the local recording to once the trip ends and a suitable connection is
     available (chunked/resumable upload, retry on failure).
   - On upload completion, set retention_expires_at to a short default window (e.g. 72 hours
     from ride completion — configurable by admin, not hardcoded) — after which a scheduled job
     deletes the file from cloud storage and marks the row 'deleted', UNLESS
     flagged_for_dispute is true, in which case retention extends only as long as the dispute
     investigation requires, with an explicit re-review before further extension.
   - flagRecordingForDispute(rideId, adminId, reason): called from Phase 17's ops console when
     a fare dispute, safety report, or SOS incident (Phase 12) references this ride — extending
     retention and restricting access to authorized trust-and-safety admins only.

5. Access control: GET /admin/recordings/:rideId is restricted to a specific admin role
   (trust-and-safety, not general admin access), requires a linked dispute/incident reference
   to view (no browsing recordings without a flagged reason), and every view is written to the
   Phase 17 audit_log with the admin's identity, timestamp, and the incident reference — treat
   this access pattern the same as Phase 26's identity documents: sensitive personal data,
   narrowly scoped access, fully audited.

6. Admin: extend the ops notes panel from Phase 17 with a "View recording" action visible only
   on rides linked to an active dispute/SOS incident, opening a secure, time-limited playback
   view (not a downloadable file by default) rather than exposing raw storage URLs.

7. Explicitly out of scope for this build: any AI-based automated analysis of the recordings
   (e.g. automatic incident detection from video). If that's wanted later, it's a separate,
   larger scope with its own accuracy and bias considerations — this phase only covers
   record-store-retrieve-on-dispute.
```

---

## Suggested Execution Order

Dependencies mean some phases must precede others even though they're numbered to match your
gap analysis rows:

```
Phase 0 (orientation)
 → Phase 0D (repository structure, naming conventions, and migration renumbering — read and
   apply this BEFORE Phase 0A; every migration number referenced in every phase below assumes
   Phase 0D's renumbering table has already been applied)
 → Phase 0A (dual payment provider setup, Paystack + Flutterwave, config-driven — do this
   before ANY phase that touches money: Phase 2's checkout, Phase 3's payouts, Phase 15's
   rental deposits, Phase 18's settlement engine, Phase 27's cross-border transfers all assume
   this is done first)
 → Phase 0C (integrations hub — build this right after Phase 0A, then have every later phase
   that introduces a 3rd-party service — Twilio in Phase 22, OpenAI in Phase 23, weather API in
   Phase 25, NIA/DVLA in Phase 26 — register through it instead of raw .env access, so you don't
   end up back where you started with credentials scattered everywhere)
 → Phase 0B (design system & UI/UX tokens — build this before ANY screen work; every
   subsequent phase's UI should reference this, not improvise its own styling)
 → Phase 1 (super-app shell + single wallet)
 → Phase 2 (marketplace) → Phase 3 (merchant portal) → Phase 4 (merchant delivery control)
 → Phase 5A (blockchain KYC attestation — active)
   ⏸ Phase 5B (DVT token) — ON HOLD
 → Phase 6 (points, pre-TGE)
   ⏸ Phase 7 (staking) — ON HOLD
   ⏸ Phase 8 (claim flow) — ON HOLD
   ⏸ Phase 9 (external staking site) — ON HOLD
 → Phase 10 (referrals) → Phase 11 (delivery enhancements) → Phase 12 (ride experience)
   → Phase 13 (driver gamification) → Phase 14 (subscription extensions)
 → Phase 15 (rental expansion)
 → Phase 16 (rewards trigger engine — refactors 6/10/13's reward writes into one place;
   build its DVT-distribution hook as a feature-flagged stub so re-enabling Phase 5B later
   is a flag flip, not a rewrite)
 → Phase 17 (ops console) → Phase 18 (finance/settlement) → Phase 19 (inbox)
 → Phase 20 (multi-country) → Phase 21 (non-functional hardening, run continuously alongside all phases)
 → Phase 22 (WhatsApp / Telegram / SMS-USSD / IVR booking channels — build the text-based flows
   first, once Phase 1's ride creation and Phase 19's notification hooks are stable; the
   voice-note sub-steps within WhatsApp/Telegram and the IVR channel depend on Phase 23's
   voice-intent.service.ts existing first, so sequence those specific pieces after Phase 23)
 → Phase 23 (in-app voice booking — depends on the same channel-agnostic createRideRequest
   function Phase 22 establishes, plus Phase 1's saved_addresses for resolving "home"/"work";
   build voice-intent.service.ts here first, then wire it into Phase 22's WhatsApp/Telegram
   voice notes and IVR call flow as a shared service, not three separate implementations)
 → Phase 24 (admin-configurable vehicle types & pricing — ideally do this EARLY, right after
   Phase 1, since Phases 22 and 23 both reference "the fare estimate endpoint" and "the vehicle
   type list" as if they already exist properly; building Phase 24 first avoids having to go
   back and rewire those channels afterward)
 → Phase 25 (dynamic/contextual pricing engine — do this right after Phase 24, since it hooks
   directly into Phase 24's refactored calculateFare; also do this before leaning heavily on
   Phase 22/23's fare estimates in production, so the "cheapest option" voice/WhatsApp flows
   already reflect real surge/time/weather pricing rather than the old flat multiplier)
 → Phase 26 (Ghana Card / West African national ID verification & identity linking — do this
   alongside or right after Phase 5A, since it feeds directly into the blockchain attestation's
   recordHash; ideally before you onboard real drivers/merchants at volume, since retrofitting
   identity-linking onto already-approved accounts is more work than building it in from the start)
 → Phase 27 (cross-border wallet transfers — do this after Phase 20's currency handling and
   Phase 26's identity-linking, since it depends on both directly; also treat this as a
   compliance-gated launch, not a "ship and see" feature, given AML/transfer-limit rules vary by
   corridor)
 → Phase 28 (in-trip camera recording — do this after Phase 0C's integrations hub is in place
   for storage credentials, and after Phase 12's SOS/dispute flows exist since recordings hook
   into disputes and incidents; treat the privacy/consent review as a hard gate before enabling
   this for real trips, same as the token phases — this is not a "build and ship" feature)
```

## Notes before you start

- Run each phase's migration and let the backend boot cleanly before moving to the next phase — Cursor works best correcting its own compile/runtime errors in small batches, not across 5 phases at once.
- **On hold:** Phases 5B, 7, 8, and 9 (the DVT token, staking, claim flow, and external staking
  site) are paused pending regulatory review — a distributable rewards token can raise
  securities-law questions depending on jurisdiction. Don't run those prompts yet.
- **Active now:** Phase 5A gives you blockchain-based KYC — an on-chain attestation registry
  (status + hash only, never PII) for driver/merchant verification. It's a plain utility
  contract, not a financial instrument, so it can proceed independently of the token review.
- Phase 6 (points) can run now since it's an internal, non-transferable ledger with no
  on-chain component and nothing redeemable for the paused token yet. Keep it that way (no
  wallet export, no external exchange, no transferability between users) until Phase 5B clears
  review — a freely tradeable points system can itself start to look token-like.
- Phase 16 intentionally comes after 6/10/13 because it *refactors* the ad hoc reward code they
  introduce — don't skip ahead to it first.
- Phase 26 (Ghana Card / regional ID linking) needs real institutional API access from NIA
  (Ghana Card), DVLA (driving license/vehicle), and potentially telcos (SIM-registration checks)
  before it can verify anything live — same category of external dependency as the WhatsApp
  Business/Telegram credentials in Phase 22. Cursor builds the integration code and the
  provider-agnostic interface now; pursue those institutional agreements in parallel so the code
  isn't waiting on nothing to plug into. Where an API isn't available yet, the flow should fall
  back to OCR + manual review rather than block onboarding.
