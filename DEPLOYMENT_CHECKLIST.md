# Deployment checklist — staking webapp (Phase 9)

## stake.mymovr.io (or equivalent subdomain)

Deploy `frontend/staking-webapp` as a **separate static site** (Vercel / Netlify / Cloudflare Pages).
Do **not** fold it into the main `docker-compose.yml` app stack.

### Build

```bash
cd frontend/staking-webapp
pnpm install
pnpm build
```

### Env (build-time)

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Backend API base, e.g. `https://api.mymovr.io/api/v1` |
| `VITE_STAKING_POOL_ADDRESS` | Non-custodial StakingPool contract (when deployed) |
| `VITE_DVT_TOKEN_ADDRESS` | DriveToken address |
| `VITE_DVT_MERKLE_DISTRIBUTOR_ADDRESS` | MerkleDistributor for claim |
| `VITE_CLAIM_PAGE_URL` | Optional deep-link to claim UI |

### DNS

Point `stake.mymovr.io` → static host. CORS on the API must allow this origin for `GET /api/v1/public/staking/stats`.

### Notes

- In-app custodial staking (drivers/merchants) remains in the main web/mobile apps.
- `TOKEN_SYSTEM_ENABLED` / `STAKING_SYSTEM_ENABLED` / `CLAIM_CUSTODIAL_ENABLED` / `TRIP_RECORDING_ENABLED` are `true` (see `.env.example`). On-chain mint/stake still need contract addresses + RPC configured.
