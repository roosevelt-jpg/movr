# MOVR Platform - African Super-App

MOVR is a comprehensive platform combining ride-hailing, e-commerce, delivery, rentals, digital wallet, and blockchain rewards into a unified ecosystem.

## Project Structure

```
movr-platform/
├── backend/                    # Node.js/Express API
│   ├── src/
│   │   ├── index.ts           # Express app + Socket.io
│   │   ├── routes/            # API endpoints (11 modules)
│   │   ├── services/          # Business logic services
│   │   ├── middleware/        # Auth, logging
│   │   └── config/            # Database, Redis config
│   └── package.json
├── frontend/
│   ├── web/                   # Customer web app (React + Vite)
│   │   ├── src/
│   │   │   ├── pages/        # Page components
│   │   │   ├── components/   # Reusable components
│   │   │   ├── services/     # API client
│   │   │   ├── store/        # Zustand state
│   │   │   ├── hooks/        # Custom React hooks
│   │   │   └── App.tsx
│   │   └── package.json
│   ├── admin/                 # Admin dashboard (React + Vite)
│   │   ├── src/
│   │   │   ├── pages/
│   │   │   ├── components/
│   │   │   └── App.tsx
│   │   └── package.json
│   └── public-website/        # Marketing website
└── docker-compose.yml         # PostgreSQL + Redis

```

## Tech Stack

### Backend
- **Framework**: Express.js + Socket.io
- **Language**: TypeScript
- **Database**: PostgreSQL 15 + PostGIS
- **Cache**: Redis 7
- **Auth**: JWT + Passport.js
- **Payments**: Stripe, Flutterwave
- **Monitoring**: Winston, Sentry

### Frontend
- **Framework**: React 18 + Vite
- **State**: Zustand + React Query
- **Styling**: Tailwind CSS
- **Forms**: React Hook Form + Zod
- **Maps**: Leaflet, React Leaflet
- **Real-time**: Socket.io-client

## Getting Started

### Prerequisites
- Node.js 18+ (LTS)
- pnpm 10+
- PostgreSQL 15
- Redis 7
- Docker & Docker Compose (optional)

### Installation

1. **Install dependencies**:
```bash
pnpm install
```

This installs dependencies for:
- Backend (`backend/`)
- Web app (`frontend/web/`)
- Admin dashboard (`frontend/admin/`)

### Environment Setup

Copy `.env.local` to each service and update with your credentials:

```bash
# Backend
cp .env.local backend/.env.local

# Frontend Web
cp .env.local frontend/web/.env.local

# Admin Dashboard
cp .env.local frontend/admin/.env.local
```

### Database Setup (Using Docker)

```bash
# Start PostgreSQL + Redis
docker-compose up -d

# Create database schema (if needed)
docker-compose exec postgres psql -U movr -d movr_db -f /docker-entrypoint-initdb.d/init.sql

# Access admin UIs
# Adminer (PostgreSQL): http://localhost:8080
# Redis Commander: http://localhost:8081
```

### Running the Applications

#### Development Mode

Run all services in parallel:
```bash
pnpm dev
```

Or run individually:

**Backend** (port 3000):
```bash
pnpm dev:backend
```

**Web App** (port 5173):
```bash
pnpm dev:web
```

**Admin Dashboard** (port 3002):
```bash
pnpm dev:admin
```

#### Production Build

```bash
# Build all
pnpm build

# Build specific service
pnpm build:backend
pnpm build:web
pnpm build:admin
```

### API Endpoints

**Base URL**: `http://localhost:3000/api/v1`

#### Authentication
- `POST /auth/signup` - Create account
- `POST /auth/login` - Login
- `POST /auth/verify` - Verify phone/email
- `POST /auth/refresh` - Refresh token

#### Rides
- `POST /rides/request` - Request a ride
- `GET /rides/:id` - Get ride details
- `PUT /rides/:id/cancel` - Cancel ride
- `GET /rides/history` - User's ride history

#### Marketplace
- `GET /marketplace/stores` - List stores
- `GET /marketplace/products` - List products
- `POST /marketplace/orders` - Create order
- `GET /marketplace/orders` - User's orders

#### Wallet
- `GET /wallet/balance` - Get wallet balance
- `POST /wallet/topup` - Top up wallet
- `GET /wallet/transactions` - Transaction history

#### Payments
- `POST /payments/charge` - Charge payment
- `POST /payments/refund` - Process refund
- `GET /payments/history` - Payment history

### Real-time Events (Socket.io)

**Connect**:
```javascript
import { io } from 'socket.io-client';
const socket = io('http://localhost:3000');
```

**Events**:
- `location:update` - Driver location update
- `ride:status` - Ride status change
- `chat:message` - Chat message
- `notification:*` - Various notifications

## Project Features

### Phase 1: Backend Foundation ✅
- Express app setup
- Database connection
- Authentication system
- Socket.io integration
- Basic routes

### Phase 2: Core API Routes (In Progress)
- Rides API
- Marketplace API
- Payments API
- Wallet API
- Driver API
- Admin API

### Phase 3: Real-time Services (Coming)
- Driver matching engine
- Location tracking
- Chat system
- Push notifications
- Emergency alerts

### Phase 4: React Web App (Coming)
- Auth pages
- Dashboard
- Ride booking
- Marketplace
- Wallet management
- User profile

### Phase 5: Admin Dashboard (Coming)
- User management
- Analytics
- Ride monitoring
- Dispute resolution
- Report generation

## Security

- JWT authentication with refresh tokens
- Password hashing with bcryptjs
- CORS protection
- Rate limiting on sensitive endpoints
- Input validation with Joi/Zod
- SQL injection prevention with parameterized queries
- Environment variable configuration

## Monitoring

- Winston logging (file + console)
- Sentry error tracking
- Request/response timing
- Database query logging

## Development Workflow

1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes and test
3. Commit: `git commit -m "feat: description"`
4. Push: `git push origin feature/your-feature`
5. Create pull request

## Database Migrations

Apply migrations:
```bash
pnpm db:migrate
```

Seed development data:
```bash
pnpm db:seed
```

## Testing

Run tests:
```bash
pnpm test
```

Watch mode:
```bash
pnpm test:watch
```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for production deployment guide.

## API Documentation

Full API documentation available at:
- Local: `http://localhost:3000/api/docs`
- Production: `https://api.movr.io/docs`

## Support

For issues and questions:
- GitHub Issues: [repository/issues](https://github.com/repository/issues)
- Email: support@movr.io
- Documentation: https://docs.movr.io

## License

MIT License - See LICENSE file for details

## Contributors

- v0 AI
- MOVR Development Team
