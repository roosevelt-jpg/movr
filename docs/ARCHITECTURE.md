# MOVR Architecture

Monolith today, microservice-ready by domain (Phase 21).

## Service boundaries (`backend/src/services`)

| Future extractable service | Current modules |
|---|---|
| **Auth / identity** | `auth.middleware`, identity-verification, ghana-card / DVLA verifiers, kyc-attestation |
| **Rides / matching** | ride-booking, matching-engine, pricing-engine, masked-communication, driver-performance |
| **Marketplace** | marketplace, feature-flags |
| **Payments / wallet** | payment (+ paystack/flutterwave), subscription, settlement, wallet-transfer |
| **Token / blockchain** | kyc-attestation chain; token/staking **ON HOLD** (5B/7/8/9) |
| **Notifications / inbox** | inbox, rewards-engine (side effects), channel bots |
| **Localization** | localization (countries, FX, city pricing) |
| **Voice / channels** | voice-intent, whatsapp/telegram/sms/ussd/ivr webhooks |
| **Trust & safety** | trip-recording (local + async upload; feature-flagged `trip_recording` / `TRIP_RECORDING_ENABLED`; trust_and_safety ACL; SOS auto-flag). Legacy `video-recording.service` is a Phase 28 facade only. |
| **Ops / channels** | channel-session, ivr-booking, cms, inbox, sos-emergency |

## Observability

- Winston structured request logs (`requestId`, `userId`, `service`, `durationMs`)
- Sentry via `SENTRY_DSN` / `VITE_SENTRY_DSN` on backend + web/admin entrypoints
- Health: `GET /health`, `/health/db`, `/health/redis`
- Matching load test: `backend/scripts/load-test-matching.ts`

## Frontends

| App | Role |
|---|---|
| `frontend/web` | Rider + merchant portal |
| `frontend/admin` | Ops, finance, integrations, vehicle/pricing engine, identity link, channel funnel |
| `frontend/public-website` | Marketing + trip share |
| `mobile/customer` | Super-app, voice booking, send money |
| `mobile/driver` | Performance, delivery, subscription, ID onboarding, trip recording |
| `design-system` | Tokens, RN components, `formatCurrency` / `formatLocalTime` |
