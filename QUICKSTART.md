# MOVR Platform - Quick Start Guide

Get the MOVR platform running in 5 minutes!

## Prerequisites
- Node.js 18+
- pnpm 10+
- Docker & Docker Compose (for PostgreSQL + Redis)

## 1. Install Dependencies

```bash
pnpm install
```

This installs all dependencies for backend, web app, and admin dashboard.

## 2. Start Database & Cache (Optional - for future phases)

```bash
docker-compose up -d
```

This starts:
- PostgreSQL on port 5432
- Redis on port 6379
- Adminer (DB UI) on port 8080
- Redis Commander on port 8081

## 3. Start the Backend (Port 3000)

```bash
pnpm dev:backend
```

You'll see:
```
╔═══════════════════════════════════════╗
║   MOVR Platform Backend Running       ║
╠═══════════════════════════════════════╣
║ Port: 3000
║ Environment: development
║ API: http://localhost:3000
║ Health: http://localhost:3000/health
╚═══════════════════════════════════════╝
```

## 4. Test Backend (in another terminal)

```bash
# Health check
curl http://localhost:3000/health

# Sign up
curl -X POST http://localhost:3000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@movr.io",
    "phone": "+2348012345678",
    "name": "Demo User",
    "userType": "customer",
    "password": "demo123"
  }'
```

## 5. Start Frontend Web App (Port 5173)

```bash
pnpm dev:web
```

The web app will open at `http://localhost:5173`

## 6. Start Admin Dashboard (Port 3002)

```bash
pnpm dev:admin
```

Admin dashboard will be at `http://localhost:3002`

## 7. Start All Services (All Ports)

```bash
pnpm dev
```

This starts all three services in parallel:
- Backend on http://localhost:3000
- Web app on http://localhost:5173
- Admin on http://localhost:3002

## Available API Endpoints

### Authentication
- `POST /api/v1/auth/signup` - Create account
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/verify` - Verify phone/email
- `POST /api/v1/auth/refresh` - Refresh token

### Rides
- `POST /api/v1/rides/request` - Request a ride
- `GET /api/v1/rides/:id` - Get ride details
- `GET /api/v1/rides` - User's ride history
- `PUT /api/v1/rides/:id/cancel` - Cancel ride

### Marketplace
- `GET /api/v1/marketplace/stores` - List stores
- `GET /api/v1/marketplace/products` - List products
- `POST /api/v1/marketplace/orders` - Create order
- `GET /api/v1/marketplace/orders` - User's orders

### Wallet
- `GET /api/v1/wallet/balance` - Get balance
- `POST /api/v1/wallet/topup` - Top-up wallet
- `GET /api/v1/wallet/transactions` - Transaction history

### Admin
- `GET /api/v1/admin/users` - List users
- `GET /api/v1/admin/rides` - List all rides
- `GET /api/v1/admin/analytics` - Analytics data

### Health
- `GET /health` - Health check
- `GET /` - API info

## Example: Create an Account & Request a Ride

```bash
# 1. Sign up
RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "rider@movr.io",
    "phone": "+2348012345678",
    "name": "Test Rider",
    "userType": "customer",
    "password": "test123"
  }')

# Extract token from response
TOKEN=$(echo $RESPONSE | jq -r '.data.token')

# 2. Request a ride
curl -X POST http://localhost:3000/api/v1/rides/request \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pickupLat": 6.5244,
    "pickupLng": 3.3792,
    "dropoffLat": 6.6293,
    "dropoffLng": 3.3519,
    "rideType": "standard"
  }'
```

## File Structure

```
movr-platform/
├── backend/                 # Express API
│   ├── src/index.ts        # Main server
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── web/                # React web app
│   │   ├── src/
│   │   ├── package.json
│   │   └── vite.config.ts
│   └── admin/              # React admin dashboard
│       ├── src/
│       ├── package.json
│       └── vite.config.ts
├── docker-compose.yml      # DB services
├── pnpm-workspace.yaml     # Workspace config
├── package.json            # Root config
├── .env.local             # Environment variables
├── README.md              # Full documentation
└── QUICKSTART.md          # This file
```

## Scripts

```bash
# Development
pnpm dev              # Start all services
pnpm dev:backend      # Start backend only
pnpm dev:web          # Start web app only
pnpm dev:admin        # Start admin dashboard only

# Building
pnpm build            # Build all services
pnpm build:backend    # Build backend only
pnpm build:web        # Build web app only
pnpm build:admin      # Build admin dashboard only

# Database
pnpm db:migrate       # Run migrations
pnpm db:seed         # Seed data

# Code quality
pnpm lint            # Lint all code
pnpm test            # Run tests
```

## Troubleshooting

### Port already in use
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Kill process on port 5173
lsof -ti:5173 | xargs kill -9

# Kill process on port 3002
lsof -ti:3002 | xargs kill -9
```

### Dependencies not installed
```bash
# Clean and reinstall
rm -rf node_modules
pnpm install
```

### Backend not starting
```bash
# Check if Node/pnpm are correct version
node --version  # Should be 18+
pnpm --version  # Should be 10+

# Try running with NODE_ENV
NODE_ENV=development pnpm dev:backend
```

### Frontend not compiling
```bash
# Clear Vite cache
rm -rf frontend/web/.vite
pnpm dev:web

# Or for admin
rm -rf frontend/admin/.vite
pnpm dev:admin
```

## Next Steps

1. **Explore the API**: Test various endpoints using curl or Postman
2. **Review Code**: Check `backend/src/index.ts` to understand the implementation
3. **Build Features**: Add new routes and services
4. **Frontend Development**: Build UI components in React
5. **Connect Frontend to Backend**: Update API endpoints in web app

## Documentation

- [Full README](README.md) - Complete project documentation
- [Implementation Plan](v0_plans/clear-spec.md) - Detailed build phases
- [API Reference](docs/API.md) - API endpoint documentation

## Support

For issues:
1. Check the troubleshooting section above
2. Review error logs in `error.log` and `combined.log`
3. Check environment variables in `.env.local`

Happy coding! 🚀
