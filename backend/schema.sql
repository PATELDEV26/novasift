CREATE TABLE IF NOT EXISTS licenses (
  key TEXT PRIMARY KEY,
  customer_email TEXT NOT NULL,
  plan_type TEXT NOT NULL CHECK(plan_type IN ('monthly', 'lifetime')),
  machine_id TEXT,
  activation_count INTEGER NOT NULL DEFAULT 0,
  max_activations INTEGER NOT NULL DEFAULT 2,
  is_revoked INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME
);
