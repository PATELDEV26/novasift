CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key VARCHAR(24) UNIQUE NOT NULL,  -- format: NOVA-XXXX-XXXX-XXXX-XXXX
  customer_email VARCHAR(255) NOT NULL,
  customer_name VARCHAR(255),
  plan_type VARCHAR(20) NOT NULL CHECK (plan_type IN ('monthly', 'lifetime')),
  razorpay_payment_id VARCHAR(255),
  razorpay_subscription_id VARCHAR(255),
  machine_id VARCHAR(255) DEFAULT NULL,
  activation_count INTEGER DEFAULT 0,
  max_activations INTEGER DEFAULT 2,
  is_revoked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NULL  -- NULL for lifetime, set for monthly
);

CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100),
  razorpay_event_id VARCHAR(255) UNIQUE,  -- prevents duplicate processing
  payload JSONB,
  processed_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'success'
);
