# Build Progress — movr-cursor-build-prompts

## Status: **Playbook complete** (Phases 0D–28) — all product flags enabled

| Batch | Status |
|---|---|
| 0D–5A, 6, 10–28 | Done |
| 5B DVT · 7 Staking · 8 Claims · 9 Staking webapp | Done · **enabled** |

## Feature flags (env)
- `TOKEN_SYSTEM_ENABLED=true`
- `STAKING_SYSTEM_ENABLED=true`
- `CLAIM_CUSTODIAL_ENABLED=true`
- `TRIP_RECORDING_ENABLED=true`

## Hygiene
- Migrations `001`→`040` under `backend/migrations/` (see `000_MIGRATION_INDEX.md`)
- Backend boots on `:3000` with root `.env` loaded (`DB_USER=movr`); `/health` OK
- Public localize: `GET /api/v1/public/countries`, `/resolve`, `/city-pricing`
- **CMS:** `GET /api/v1/public/cms/pages/:slug` · Admin **Site content** (`/admin/cms`) · seed `pnpm --filter @movr/backend run db:seed-cms`
- Marketing pages are CMS-driven — no hardcoded copy
- Pricing displays in the user's local African currency
- Direct uploads: `POST /api/v1/uploads` + `POST /api/v1/users/avatar`
- Dual theme across web, admin, merchant, mobile
- **Claims:** Admin **Airdrops** → user `/claim`
- **Trip recording:** rider notice + driver upload + admin Ride ops playback
- DB `feature_flags` all enabled at 100% rollout (migration 040)
- Deploy DVT / Merkle contracts on Polygon Amoy when ready (`backend/blockchain`) — on-chain paths need contract addresses in env
