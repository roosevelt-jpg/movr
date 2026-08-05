# Build Progress — movr-cursor-build-prompts

## Status: **Playbook complete** (Phases 0D–28, including previously held 5B / 7 / 8 / 9)

| Batch | Status |
|---|---|
| 0D–5A, 6, 10–28 | Done (prior sessions) |
| 5B DVT · 7 Staking · 8 Claims · 9 Staking webapp | Done |

## Feature flags (keep off until legal / privacy review)
- `TOKEN_SYSTEM_ENABLED=false`
- `STAKING_SYSTEM_ENABLED=false`
- `CLAIM_CUSTODIAL_ENABLED=false`
- `TRIP_RECORDING_ENABLED=false`

## Hygiene
- Migrations `001`→`031` under `backend/migrations/` (030 Africa currencies; **031 CMS pages/sections**)
- Backend boots on `:3000` with root `.env` loaded (`DB_USER=movr`); `/health` + `/api/v1/public/staking/stats` OK
- Public localize: `GET /api/v1/public/countries`, `/resolve`, `/city-pricing`
- **CMS:** `GET /api/v1/public/cms/pages/:slug` · Admin **Site content** (`/admin/cms`) · seed `pnpm --filter @movr/backend run db:seed-cms`
- Marketing pages (home, merchants, download, help, terms, privacy, onboarding, footer) are CMS-driven — no hardcoded copy
- Pricing displays in the user's local African currency (web/admin + city_pricing)
- Deploy DVT / Merkle contracts on Polygon Amoy when ready (`backend/blockchain`)
- Token & trip-recording launches need separate compliance review
