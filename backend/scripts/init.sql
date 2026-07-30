-- MOVR baseline schema (docker-compose init)
-- Core tables required before numbered migrations.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(32) UNIQUE,
  email VARCHAR(255) UNIQUE,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  password TEXT,
  avatar_url TEXT,
  user_type VARCHAR(32) NOT NULL DEFAULT 'customer',
  country VARCHAR(8) DEFAULT 'GH',
  city VARCHAR(100),
  language VARCHAR(8) DEFAULT 'en',
  is_active BOOLEAN DEFAULT TRUE,
  is_verified BOOLEAN DEFAULT FALSE,
  phone_verified_at TIMESTAMPTZ,
  email_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vehicle_type VARCHAR(50) DEFAULT 'standard',
  is_online BOOLEAN DEFAULT FALSE,
  rating NUMERIC(3,2) DEFAULT 5.0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_name VARCHAR(255),
  category VARCHAR(100),
  status VARCHAR(32) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES users(id),
  driver_id UUID REFERENCES users(id),
  pickup_lat DOUBLE PRECISION,
  pickup_lng DOUBLE PRECISION,
  dropoff_lat DOUBLE PRECISION,
  dropoff_lng DOUBLE PRECISION,
  pickup_address TEXT,
  dropoff_address TEXT,
  ride_type VARCHAR(50) DEFAULT 'standard',
  status VARCHAR(32) DEFAULT 'requested',
  estimated_fare NUMERIC(12,2),
  actual_fare NUMERIC(12,2),
  distance_km NUMERIC(10,2),
  estimated_duration_minutes INTEGER,
  rating NUMERIC(3,2),
  earnings NUMERIC(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  amount NUMERIC(12,2) NOT NULL,
  currency VARCHAR(8) DEFAULT 'GHS',
  method VARCHAR(50),
  gateway VARCHAR(50),
  status VARCHAR(32) DEFAULT 'pending',
  reference_id VARCHAR(128) UNIQUE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  balance_fiat NUMERIC(14,2) DEFAULT 0,
  balance_points NUMERIC(14,2) DEFAULT 0,
  balance_tokens NUMERIC(14,8) DEFAULT 0,
  currency VARCHAR(8) DEFAULT 'GHS',
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID REFERENCES wallets(id),
  from_user_id UUID REFERENCES users(id),
  to_user_id UUID REFERENCES users(id),
  amount NUMERIC(14,2) NOT NULL,
  type VARCHAR(50) NOT NULL,
  transaction_id VARCHAR(128),
  reference VARCHAR(128),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES merchants(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  rating NUMERIC(3,2) DEFAULT 5.0,
  is_active BOOLEAN DEFAULT TRUE,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plans (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  features JSONB DEFAULT '[]'::jsonb,
  amount NUMERIC(12,2) NOT NULL,
  currency VARCHAR(8) DEFAULT 'GHS'
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES users(id),
  plan_id VARCHAR(64) REFERENCES plans(id),
  status VARCHAR(32) DEFAULT 'active',
  amount NUMERIC(12,2),
  currency VARCHAR(8) DEFAULT 'GHS',
  next_billing_date TIMESTAMPTZ,
  auto_renew BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES users(id),
  amount NUMERIC(12,2) NOT NULL,
  currency VARCHAR(8) DEFAULT 'GHS',
  status VARCHAR(32) DEFAULT 'pending',
  reference_id VARCHAR(128),
  bank_account JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO plans (id, name, features, amount, currency)
VALUES ('basic_driver', 'Basic Driver', '["rides"]'::jsonb, 99, 'GHS')
ON CONFLICT (id) DO NOTHING;
