# Deployment readiness — mymovr.io production cutover

Use this after migrations and env are applied. Canonical hosts:

| Surface | URL |
|---|---|
| Web | https://mymovr.io |
| API | https://api.mymovr.io |
| Admin | https://admin.mymovr.io |

## Must-have production env

- `NODE_ENV=production`
- `PUBLIC_WEB_URL=https://mymovr.io`
- `CORS_ORIGIN` includes apex, www, admin, stake
- `VITE_API_URL=https://api.mymovr.io/api/v1` (web build)
- `PAYSTACK_SECRET_KEY` and/or `FLUTTERWAVE_SECRET_KEY` (or Integrations Hub credentials)
- `ALLOW_DEMO_TOPUPS` unset or false — **demo MoMo/card never runs in production**
- `JWT_SECRET` / `INTEGRATIONS_ENCRYPTION_KEY` not default placeholders

## Migrations

Apply through `105_share_pool_dispatch.sql` (share pool wait + fare split columns).

```bash
pnpm --filter backend migrate   # or your usual migrate command
node scripts/deployment-ready-smoke.js
```

## Product behaviour (now production-shaped)

| Area | Behaviour |
|---|---|
| MoMo / card top-up | Live gateway checkout only in production; missing keys fail loudly |
| Share | Pool waits for riders / timeout → **one driver** + equal fare split |
| Family circles | Member trip can debit **owner** mobility credit within `daily_limit` |
| Driver web | `/driver`, `/driver/destination`, `/driver/guarantee` (offers stay mobile) |
| Voice / WhatsApp | `/voice`, `/voice/whatsapp` confirm → same active-ride track path |

## Manual QA matrix (minimum)

- [ ] Customer web: book now + share + mobility credit
- [ ] Customer mobile: same
- [ ] Top-up MoMo with live keys (sandbox then live)
- [ ] Family: owner funds credit, member books with pay-with-credit
- [ ] Share: 2 riders same corridor → one `driver_id` on `share_pools`
- [ ] Voice confirm → `/ride/active/:id`
- [ ] Driver web destination + guarantee enroll
- [ ] Driver mobile: accept offer + complete trip

## Smoke script

```bash
API_URL=https://api.mymovr.io/api/v1 node scripts/deployment-ready-smoke.js
```

Local:

```bash
node scripts/deployment-ready-smoke.js
```
