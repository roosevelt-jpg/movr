# AWS Deployment Guide — mymovr.io

Push Movr from GitHub to AWS with production hostnames:

| Hostname | Service |
|----------|---------|
| `https://mymovr.io` | Customer / landing web (`frontend/web`) |
| `https://www.mymovr.io` | Redirect → apex |
| `https://admin.mymovr.io` | Admin console (`frontend/admin`) |
| `https://api.mymovr.io` | Backend API (`backend`) |
| `https://stake.mymovr.io` | Optional staking static site |

Stack: **Node/Express API · Vite React (web + admin) · Postgres · Redis · Socket.io · Flutterwave**

---

## 1. Recommended AWS architecture

```
GitHub (main)
    │
    ├─► GitHub Actions
    │       ├─ build & push API image → Amazon ECR
    │       ├─ build web/admin → upload → S3
    │       └─ invalidate CloudFront
    │
Route 53 (mymovr.io)
    │
    ├─ mymovr.io / www     → CloudFront → S3 (web dist)
    ├─ admin.mymovr.io     → CloudFront → S3 (admin dist)
    └─ api.mymovr.io       → ALB → ECS Fargate (API tasks)
                                    │
                                    ├─ RDS PostgreSQL 15 (+ PostGIS)
                                    ├─ ElastiCache Redis 7
                                    ├─ S3 (uploads / media)
                                    └─ Secrets Manager / SSM Parameter Store
```

**Why this layout**
- Static frontends are cheap and fast on **S3 + CloudFront**
- API needs long-lived processes + WebSockets → **ECS Fargate + ALB** (not Lambda alone)
- Managed **RDS** + **ElastiCache** instead of self-hosting Postgres/Redis on EC2

---

## 2. Prerequisites

1. AWS account with billing enabled  
2. Domain **mymovr.io** in **Route 53** (or DNS pointed to Route 53 NS)  
3. GitHub repo: `https://github.com/roosevelt-jpg/movr.git`  
4. Local tools: AWS CLI v2, Docker, pnpm, Node 18+  
5. Configure CLI:

```bash
aws configure
# or: aws configure sso
```

Pick a region close to your users, e.g. `eu-west-1` or `af-south-1` (Cape Town) if available for your account.

---

## 3. One-time AWS foundation

### 3.1 VPC (use default or create)

- Public subnets (ALB, NAT)
- Private subnets (ECS tasks, RDS, Redis)
- Security groups:
  - `sg-alb`: inbound 80/443 from internet
  - `sg-ecs`: inbound 3000 from `sg-alb` only
  - `sg-rds`: inbound 5432 from `sg-ecs`
  - `sg-redis`: inbound 6379 from `sg-ecs`

### 3.2 ACM certificates (us-east-1 for CloudFront)

Request a public certificate covering:

```
mymovr.io
*.mymovr.io
```

Validate via DNS (Route 53 CNAME records ACM provides).

> CloudFront requires the cert in **us-east-1**. ALB cert can be in the same region as the ALB.

### 3.3 RDS PostgreSQL

1. Create **RDS PostgreSQL 15** (Multi-AZ for production)
2. Enable extension support; after first connect run:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

3. Store connection string in Secrets Manager, e.g. secret name `movr/prod/database`:

```
postgresql://movr:PASSWORD@movr-prod.xxxx.rds.amazonaws.com:5432/movr_db
```

### 3.4 ElastiCache Redis

1. Create Redis 7 cluster (private subnets)
2. Note primary endpoint: `movr-prod.xxxxx.cache.amazonaws.com:6379`
3. Store in Secrets Manager: `movr/prod/redis`

### 3.5 S3 buckets

| Bucket | Purpose |
|--------|---------|
| `mymovr-web-prod` | `frontend/web` build (`dist/`) |
| `mymovr-admin-prod` | `frontend/admin` build (`dist/`) |
| `mymovr-uploads-prod` | User uploads / media |

Enable Block Public Access on uploads; serve via CloudFront OAC or signed URLs.  
For web/admin: private buckets + CloudFront Origin Access Control (OAC).

### 3.6 ECR repository

```bash
aws ecr create-repository --repository-name movr-api --region YOUR_REGION
```

---

## 4. Production environment variables

Create secret `movr/prod/app` (JSON) or SSM parameters. Minimum:

```bash
NODE_ENV=production
APP_PORT=3000
APP_URL=https://api.mymovr.io
PUBLIC_WEB_URL=https://mymovr.io
ADMIN_URL=https://admin.mymovr.io
CORS_ORIGIN=https://mymovr.io,https://www.mymovr.io,https://admin.mymovr.io,https://stake.mymovr.io

JWT_SECRET=<long-random>
INTEGRATIONS_ENCRYPTION_KEY=<long-random>

DB_HOST=<rds-endpoint>
DB_PORT=5432
DB_USER=movr
DB_PASSWORD=<secret>
DB_NAME=movr_db
# or DATABASE_URL=postgresql://...

REDIS_HOST=<elasticache-endpoint>
REDIS_PORT=6379

FLUTTERWAVE_PUBLIC_KEY=...
FLUTTERWAVE_SECRET_KEY=...
FLUTTERWAVE_SECRET_HASH=...

ALLOW_DEMO_TOPUPS=false
EXPOSE_OTP=false
```

Also configure (as needed): Paystack, Stripe, Twilio, SendGrid, Firebase, Google Maps, S3 credentials / IAM role.

**Frontend build-time env**

```bash
# frontend/web & frontend/admin
VITE_API_URL=https://api.mymovr.io/api/v1
# or REACT_APP_API_URL=https://api.mymovr.io/api/v1
```

---

## 5. Build & push the API (ECS)

### 5.1 Fix Docker context (monorepo)

From repo root (recommended Dockerfile at `backend/Dockerfile` — build with backend as context):

```bash
cd backend
aws ecr get-login-password --region YOUR_REGION \
  | docker login --username AWS --password-stdin ACCOUNT_ID.dkr.ecr.YOUR_REGION.amazonaws.com

docker build -t movr-api .
docker tag movr-api:latest ACCOUNT_ID.dkr.ecr.YOUR_REGION.amazonaws.com/movr-api:latest
docker push ACCOUNT_ID.dkr.ecr.YOUR_REGION.amazonaws.com/movr-api:latest
```

> If `npm ci` fails in Docker (repo uses **pnpm**), update the Dockerfile to install with `corepack enable && pnpm install --frozen-lockfile` and copy `pnpm-lock.yaml` / workspace files, **or** build a root multi-stage image. Prefer aligning Dockerfile with pnpm before first production push.

### 5.2 ECS cluster + service

1. Create ECS cluster `movr-prod` (Fargate)
2. Task definition:
   - Image: ECR `movr-api:latest`
   - CPU/Mem: start `0.5 vCPU / 1 GB` (scale up for load)
   - Port `3000`
   - Env from Secrets Manager
   - Task role: S3 read/write uploads, Secrets read
3. Service behind **Application Load Balancer**:
   - HTTPS listener 443 → target group → tasks
   - Health check: `GET /health` (or `/api/v1/health` if that is your probe)
4. DNS: Route 53 `api.mymovr.io` → ALB alias
5. Sticky sessions / WebSocket: enable ALB stickiness or ensure Socket.io works through ALB (idle timeout ≥ 60s)

### 5.3 Run migrations

One-off ECS task or bastion:

```bash
pnpm --filter @movr/backend run db:migrate
pnpm --filter @movr/backend run db:seed-cms
pnpm --filter @movr/backend run db:seed-ops   # creates admin@mymovr.io
```

Never expose bastion publicly long-term.

---

## 6. Deploy web + admin (S3 + CloudFront)

### 6.1 Build locally (or in CI)

```bash
# From repo root
pnpm install

# Web
cd frontend/web
VITE_API_URL=https://api.mymovr.io/api/v1 pnpm build
# → dist/

# Admin
cd ../admin
VITE_API_URL=https://api.mymovr.io/api/v1 pnpm build
# → dist/  (base path /admin/)
```

### 6.2 Sync to S3

```bash
aws s3 sync frontend/web/dist/ s3://mymovr-web-prod/ --delete
aws s3 sync frontend/admin/dist/ s3://mymovr-admin-prod/ --delete
```

### 6.3 CloudFront distributions

**Web (`mymovr.io`)**
- Origin: `mymovr-web-prod` + OAC
- Alternate domain: `mymovr.io`, `www.mymovr.io`
- Viewer cert: ACM `*.mymovr.io`
- Default root object: `index.html`
- Error pages: 403/404 → `/index.html` (SPA)
- HTTPS only, HTTP→HTTPS redirect

**Admin (`admin.mymovr.io`)**
- Origin: `mymovr-admin-prod`
- Same SPA error routing
- Note: admin Vite `base: '/admin/'` — either host at CloudFront path `/admin/*` **or** rebuild with `base: '/'` for subdomain root. Prefer subdomain root with `base: '/'` for cleaner AWS hosting.

### 6.4 Route 53

| Record | Type | Target |
|--------|------|--------|
| `mymovr.io` | A/AAAA Alias | Web CloudFront |
| `www.mymovr.io` | A/AAAA Alias | Web CloudFront (or redirect) |
| `admin.mymovr.io` | A/AAAA Alias | Admin CloudFront |
| `api.mymovr.io` | A/AAAA Alias | ALB |

---

## 7. CI/CD — auto-deploy on every push to `main`

The workflow is already in the repo:

**[`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml)**

On every push to `main` (and on manual **Run workflow**), it:

1. Builds the API Docker image → pushes to **ECR** → forces an **ECS** rolling deploy  
2. Builds `frontend/web` → syncs to **S3** → invalidates **CloudFront**  
3. Builds `frontend/admin` → syncs to **S3** → invalidates **CloudFront**

### GitHub Secrets (Settings → Secrets and variables → Actions)

| Secret | Purpose |
|--------|---------|
| `AWS_ACCESS_KEY_ID` | IAM user/key with ECR, ECS, S3, CloudFront rights |
| `AWS_SECRET_ACCESS_KEY` | Matching secret |
| `CF_WEB_DISTRIBUTION_ID` | CloudFront distribution for `mymovr.io` |
| `CF_ADMIN_DISTRIBUTION_ID` | CloudFront distribution for `admin.mymovr.io` |

### Optional GitHub Variables (defaults shown)

| Variable | Default |
|----------|---------|
| `AWS_REGION` | `eu-west-1` |
| `ECR_REPOSITORY` | `movr-api` |
| `ECS_CLUSTER` | `movr-prod` |
| `ECS_SERVICE` | `movr-api` |
| `S3_WEB_BUCKET` | `mymovr-web-prod` |
| `S3_ADMIN_BUCKET` | `mymovr-admin-prod` |
| `VITE_API_URL` / `REACT_APP_API_URL` | `https://api.mymovr.io/api/v1` |

IAM policy for the deploy user should allow at least: `ecr:*` (scoped to repo), `ecs:UpdateService`, `s3:PutObject`/`DeleteObject`/`ListBucket` on the two buckets, `cloudfront:CreateInvalidation`.

After secrets are set and AWS resources from §3–6 exist:

```bash
git push origin main
```

Watch progress under **GitHub → Actions → Deploy to AWS**.

---

## 8. Provider webhooks & DNS checklist

Point provider dashboards to:

| Provider | URL |
|----------|-----|
| Flutterwave | `https://api.mymovr.io/webhooks/flutterwave` |
| Paystack | `https://api.mymovr.io/webhooks/paystack` |
| Stripe | `https://api.mymovr.io/webhooks/stripe` |
| Payment return | `https://mymovr.io/payments/callback` |

Flutterwave / Maps / Firebase authorized domains: add `mymovr.io`, `www.mymovr.io`, `admin.mymovr.io`.

---

## 9. First production deploy sequence

1. Create VPC, RDS, Redis, S3, ECR, ACM, Route 53  
2. Put secrets in Secrets Manager  
3. Build & push API image → create ECS service + ALB  
4. Run migrations + CMS/admin seed  
5. Build & sync web + admin → CloudFront  
6. Set DNS records  
7. Configure Flutterwave/Paystack webhooks  
8. Smoke test:

```text
https://api.mymovr.io/health
https://mymovr.io
https://admin.mymovr.io/admin/login
```

9. Add GitHub Actions for push-to-deploy  

Local smoke helper (repo):

```bash
node scripts/deployment-ready-smoke.js
```

---

## 10. Simpler AWS alternatives (if you want less ops)

| Piece | Simpler option |
|-------|----------------|
| API | **AWS App Runner** from ECR (auto HTTPS) |
| API | **Elastic Beanstalk** (Docker platform) |
| Web/Admin | **Amplify Hosting** connected to GitHub |
| DB | RDS still recommended |
| Redis | ElastiCache or Redis Cloud |

Full ECS + CloudFront is the most flexible for Socket.io + scale.

---

## 11. Related docs in this repo

| File | Contents |
|------|----------|
| [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) | General build / multi-platform notes |
| [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) | Staking subdomain checklist |
| [DEPLOYMENT_READY.md](./DEPLOYMENT_READY.md) | Pre-flight readiness |
| [.env.example](./.env.example) | Env var reference for `mymovr.io` |
| [docker-compose.yml](./docker-compose.yml) | Local Postgres + Redis only |
| [backend/Dockerfile](./backend/Dockerfile) | API container starting point |
| [PLAY_STORE.md](./PLAY_STORE.md) | Store URLs on mymovr.io |

---

## 12. Cost & security notes

- Start small (1–2 Fargate tasks, db.t4g.micro/small); scale after traffic  
- Turn on RDS automated backups + deletion protection  
- Force HTTPS everywhere; HSTS via CloudFront  
- Never commit `.env` — use Secrets Manager  
- Restrict ECS security group to ALB only  
- Rotate `JWT_SECRET` / Flutterwave hash if they were used in demos  

---

## 13. After go-live

```bash
git push origin main   # triggers CI once workflow exists
```

Manual hotfix:

```bash
# API
docker build/push + aws ecs update-service --force-new-deployment

# Web
pnpm --filter @movr/web build && aws s3 sync ... && cloudfront invalidate
```

CI/CD workflow: [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml). API image: [`backend/Dockerfile`](./backend/Dockerfile) (pnpm).
