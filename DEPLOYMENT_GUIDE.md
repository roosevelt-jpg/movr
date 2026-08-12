# MOVR Platform - Deployment Guide

## 🚀 Quick Start (Development)

### Prerequisites
- Node.js 16+ and pnpm installed
- Backend environment variables configured
- PostgreSQL 15 and Redis 7 running

### Running Locally

**Start all services in parallel:**
```bash
cd /vercel/share/v0-project
pnpm dev
```

**Or start individually:**

```bash
# Terminal 1: Backend API
cd backend
pnpm dev
# Runs on http://localhost:3000
# API: http://localhost:3000/api/v1
# Socket.io: ws://localhost:3000

# Terminal 2: Web App
cd frontend/web
pnpm dev
# Runs on http://localhost:5173

# Terminal 3: Admin Dashboard
cd frontend/admin
pnpm dev
# Runs on http://localhost:3002
```

## 📦 Production Build

### Backend Build
```bash
cd backend
pnpm build
pnpm start
# Runs on port 3000
```

### Frontend Web Build
```bash
cd frontend/web
pnpm build
# Outputs to dist/
pnpm preview  # Test production build
```

### Frontend Admin Build
```bash
cd frontend/admin
pnpm build
# Outputs to dist/
```

## 🌐 Deployment Platforms

### Vercel (Recommended for Frontend)

**Web App:**
```bash
cd frontend/web
vercel deploy
```

**Admin Dashboard:**
```bash
cd frontend/admin
vercel deploy
```

**Environment Variables to set in Vercel:**
```
VITE_API_URL=https://api.mymovr.io/api/v1
```

### Railway/Heroku (Backend)

**Dockerfile already included. Deploy with:**
```bash
docker build -t movr-backend .
docker run -p 3000:3000 movr-backend
```

**Or via platform CLI:**
```bash
railway up  # For Railway
# or
heroku deploy  # For Heroku
```

## 🗄️ Database Setup

### PostgreSQL Migrations

```bash
cd backend
pnpm run db:migrate
pnpm run db:seed  # Load sample data
```

### Database Connection

Update `.env.production`:
```
DATABASE_URL=postgresql://user:password@host:5432/movr
REDIS_URL=redis://user:password@host:6379
```

## 🔐 Environment Variables

### Backend `.env`
```
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=your-secret-key
STRIPE_SECRET_KEY=sk_live_...
FLUTTERWAVE_SECRET_KEY=...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

### Frontend `.env`
```
VITE_API_URL=https://api.mymovr.io/api/v1
VITE_SOCKET_URL=wss://api.mymovr.io
```

## 📊 Monitoring

### Health Check
```bash
curl http://localhost:3000/health
```

### Logs
```bash
# Backend
tail -f backend/logs/app.log

# Frontend built with Vite - check browser console
```

## 🔧 Troubleshooting

### Database Connection Issues
- Check PostgreSQL is running: `psql -U postgres`
- Verify DATABASE_URL in .env
- Run migrations: `pnpm run db:migrate`

### Redis Connection Issues
- Check Redis is running: `redis-cli ping`
- Verify REDIS_URL in .env

### CORS Errors
- Ensure backend CORS includes frontend origin
- Check `backend/src/index.ts` corsOptions

### Socket.io Not Connecting
- Verify Socket.io port (default 3000)
- Check WebSocket support in proxy/firewall
- Verify `VITE_SOCKET_URL` matches backend

## 📈 Scaling

### Horizontal Scaling
- Use load balancer (Nginx, AWS ALB)
- Ensure Redis is externalized for session sharing
- Use managed database (AWS RDS, Supabase)

### Caching Strategy
- Enable HTTP caching headers
- Use Redis for session & real-time data
- CDN for static assets (Cloudflare, AWS CloudFront)

## 🚨 Monitoring & Alerts

Recommended Services:
- **Uptime**: UptimeRobot, StatusPage
- **Error Tracking**: Sentry, Rollbar
- **APM**: New Relic, DataDog
- **Logs**: CloudWatch, LogRocket

## 📝 Deployment Checklist

- [ ] Environment variables set correctly
- [ ] Database migrations run
- [ ] Redis connection verified
- [ ] SSL certificate installed
- [ ] CORS configured
- [ ] API rate limiting enabled
- [ ] Logging configured
- [ ] Monitoring alerts set up
- [ ] Backup strategy in place
- [ ] Error tracking enabled

## 🔄 CI/CD Pipeline (GitHub Actions)

Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy MOVR

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Build backend
        run: cd backend && pnpm build
      
      - name: Build web
        run: cd frontend/web && pnpm build
      
      - name: Deploy to Vercel
        run: vercel deploy --prod
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
```

## 📞 Support

For deployment issues:
- Check logs: `pnpm logs`
- Review `.env` configuration
- Verify database and Redis connectivity
- Check firewall and port accessibility

---

**Last Updated:** January 2024  
**Version:** 1.0.0
