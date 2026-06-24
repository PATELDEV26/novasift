require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const crypto = require('crypto');
const { Resend } = require('resend');
const { razorpay } = require('./lib/razorpay');
const cors = require('cors');

const app = express();
app.use(cors());
const PORT = process.env.PORT || 3000;

// Initialize PostgreSQL Pool
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Important: We need the raw body for Razorpay signature verification
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));

// -----------------------------------------------------------------------------
// Utility: Generate Unique License Key
// -----------------------------------------------------------------------------
async function generateUniqueLicenseKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const segment = () => Array.from({ length: 4 }, () => 
    chars[Math.floor(Math.random() * chars.length)]).join('');
  
  let key = `NOVA-${segment()}-${segment()}-${segment()}-${segment()}`;
  
  // Verify it doesn't already exist in DB
  let isUnique = false;
  let attempts = 0;
  
  while (!isUnique && attempts < 5) {
    const existing = await db.query('SELECT license_key FROM licenses WHERE license_key = $1', [key]);
    if (existing.rows.length === 0) {
      isUnique = true;
    } else {
      key = `NOVA-${segment()}-${segment()}-${segment()}-${segment()}`;
      attempts++;
    }
  }
  
  if (!isUnique) throw new Error("Could not generate a unique license key.");
  return key;
}

// -----------------------------------------------------------------------------
// Webhook Handlers
// -----------------------------------------------------------------------------
async function handleLifetimePurchase(payment) {
  const email = payment.email;
  const name = payment.contact || email; // fallback to email if contact name not available
  
  // Check if this payment is actually for NovaSift Lifetime (can check notes/description)
  // if (payment.notes?.product !== 'novasift_lifetime') return;

  const licenseKey = await generateUniqueLicenseKey();
  
  await db.query(`
    INSERT INTO licenses 
    (license_key, customer_email, customer_name, plan_type, razorpay_payment_id, max_activations)
    VALUES ($1, $2, $3, 'lifetime', $4, 2)
  `, [licenseKey, email, name, payment.id]);
  
  await sendLicenseEmail({ email, name, licenseKey, plan: 'lifetime' });
}

async function handleMonthlyPayment(subscription, payment) {
  const email = payment.email;
  const subId = subscription.id;
  const name = payment.contact || email;
  
  const existing = await db.query(
    'SELECT * FROM licenses WHERE razorpay_subscription_id = $1',
    [subId]
  );
  
  if (existing.rows.length > 0) {
    // Renewal: Extend expires_at by 33 days
    await db.query(`
      UPDATE licenses 
      SET expires_at = NOW() + INTERVAL '33 days',
          is_revoked = false
      WHERE razorpay_subscription_id = $1
    `, [subId]);
    return;
  }
  
  // New Subscription
  const licenseKey = await generateUniqueLicenseKey();
  
  await db.query(`
    INSERT INTO licenses 
    (license_key, customer_email, customer_name, plan_type, razorpay_payment_id, razorpay_subscription_id, expires_at)
    VALUES ($1, $2, $3, 'monthly', $4, $5, NOW() + INTERVAL '33 days')
  `, [licenseKey, email, name, payment.id, subId]);
  
  await sendLicenseEmail({ email, name, licenseKey, plan: 'monthly' });
}

async function handleCancellation(subscription) {
  await db.query(`
    UPDATE licenses 
    SET razorpay_subscription_id = NULL
    WHERE razorpay_subscription_id = $1
  `, [subscription.id]);
}

async function handleFailedPayment(payment) {
  await sendPaymentFailedEmail(payment.email);
}

// -----------------------------------------------------------------------------
// Email Templates
// -----------------------------------------------------------------------------
async function sendLicenseEmail({ email, name, licenseKey, plan }) {
  try {
    await resend.emails.send({
      from: 'NovaSift <noreply@thesidejob.tech>',
      to: email,
      subject: '🎉 Your NovaSift Pro License Key',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #ffffff; padding: 40px; border-radius: 12px;">
          <h1 style="color: #ffffff; font-size: 24px;">Welcome to NovaSift Pro</h1>
          <p style="color: #a0a0a0;">Hi ${name}, your payment was successful. Here is your license key:</p>
          <div style="background: #1a1a1a; border: 1px solid #333; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
            <code style="font-size: 22px; color: #6366f1; letter-spacing: 3px; font-weight: bold;">
              ${licenseKey}
            </code>
          </div>
          <p style="color: #a0a0a0;">
            <strong style="color: #fff;">How to activate:</strong><br/>
            1. Open NovaSift on your desktop<br/>
            2. Go to Settings → License<br/>
            3. Paste your key and click Activate
          </p>
          <p style="color: #a0a0a0;">
            Plan: <strong style="color: #fff;">${plan === 'lifetime' ? 'Lifetime (never expires)' : 'Pro Monthly'}</strong>
          </p>
          <hr style="border-color: #222; margin: 32px 0;"/>
          <p style="color: #555; font-size: 12px;">
            Save this email. If you need to activate on a new device, visit thesidejob.tech/account or email support@thesidejob.tech
          </p>
        </div>
      `
    });
  } catch (error) {
    console.error('Failed to send license email', error);
  }
}

async function sendPaymentFailedEmail(email) {
  try {
    await resend.emails.send({
      from: 'NovaSift <noreply@thesidejob.tech>',
      to: email,
      subject: 'NovaSift Pro — Payment Failed',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Your payment didn't go through</h2>
          <p>No worries — no charge was made. Please try again at thesidejob.tech/products/novasift</p>
          <p>If the issue persists, contact support@thesidejob.tech</p>
        </div>
      `
    });
  } catch (error) {
    console.error('Failed to send failure email', error);
  }
}

// -----------------------------------------------------------------------------
// Razorpay Webhook Route
// -----------------------------------------------------------------------------
app.post('/api/webhooks/razorpay', async (req, res) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.headers['x-razorpay-signature'];
  const rawBody = req.rawBody;

  if (!signature || !rawBody) {
    return res.status(400).json({ error: 'Missing signature or body' });
  }

  // 1. Verify Signature
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  const isValid = crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(signature)
  );

  if (!isValid) {
    return res.status(400).json({ error: 'Invalid signature' });
  }

  const event = req.body;

  try {
    // 2. Idempotency Check
    const existingLog = await db.query(
      'SELECT id FROM webhook_logs WHERE razorpay_event_id = $1',
      [event.id]
    );

    if (existingLog.rows.length > 0) {
      return res.status(200).json({ status: 'already_processed' });
    }

    // 3. Event Router
    switch (event.event) {
      case 'payment.captured':
        await handleLifetimePurchase(event.payload.payment.entity);
        break;
      
      case 'subscription.charged':
        await handleMonthlyPayment(event.payload.subscription.entity, event.payload.payment.entity);
        break;
      
      case 'subscription.cancelled':
        await handleCancellation(event.payload.subscription.entity);
        break;
      
      case 'payment.failed':
        await handleFailedPayment(event.payload.payment.entity);
        break;
    }

    // Log the event as successfully processed
    await db.query(
      'INSERT INTO webhook_logs (event_type, razorpay_event_id, payload) VALUES ($1, $2, $3)',
      [event.event, event.id, JSON.stringify(event)]
    );

    return res.status(200).json({ status: 'ok' });

  } catch (error) {
    console.error('Webhook processing error:', error);
    // Don't insert into webhook_logs so Razorpay retries this event
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Original Validate License route is kept here for reference, adapted for Postgres
app.post('/api/validate-license', async (req, res) => {
  const { license_key, machine_id } = req.body;

  if (!license_key || !machine_id) {
    return res.status(400).json({ valid: false, reason: "missing_fields" });
  }

  try {
    const result = await db.query('SELECT * FROM licenses WHERE license_key = $1', [license_key]);
    const row = result.rows[0];

    if (!row) return res.json({ valid: false, reason: "invalid_key" });
    if (row.is_revoked) return res.json({ valid: false, reason: "revoked" });
    
    if (row.plan_type === 'monthly' && row.expires_at) {
      if (new Date() > new Date(row.expires_at)) {
        return res.json({ valid: false, reason: "expired" });
      }
    }

    if (!row.machine_id) {
      await db.query(
        'UPDATE licenses SET machine_id = $1, activation_count = activation_count + 1 WHERE license_key = $2',
        [machine_id, license_key]
      );
      return res.json({ valid: true, plan: "pro", expires_at: row.expires_at });
    }

    if (row.machine_id !== machine_id) {
      const currentMachines = row.machine_id.split(',');
      if (currentMachines.includes(machine_id)) {
         return res.json({ valid: true, plan: "pro", expires_at: row.expires_at });
      } else if (currentMachines.length < row.max_activations) {
         currentMachines.push(machine_id);
         const newMachineIds = currentMachines.join(',');
         await db.query(
           'UPDATE licenses SET machine_id = $1, activation_count = $2 WHERE license_key = $3',
           [newMachineIds, currentMachines.length, license_key]
         );
         return res.json({ valid: true, plan: "pro", expires_at: row.expires_at });
      } else {
         return res.json({ valid: false, reason: "max_devices_reached" });
      }
    }

    return res.json({ valid: true, plan: "pro", expires_at: row.expires_at });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ valid: false, reason: "server_error" });
  }
});

app.post('/api/create-subscription', async (req, res) => {
  const { email } = req.body;
  
  try {
    const subscription = await razorpay.subscriptions.create({
      plan_id: process.env.RAZORPAY_PLAN_ID,
      customer_notify: 1,
      total_count: 12,
      notes: {
        product: 'novasift_pro_monthly',
        email: email
      }
    });
    
    res.json({ 
      subscription_id: subscription.id,
      key_id: process.env.RAZORPAY_KEY_ID 
    });
  } catch (error) {
    console.error('Subscription creation failed:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

app.post('/api/resend-license', async (req, res) => {
  const { email } = req.body;
  
  try {
    const result = await db.query(
      'SELECT * FROM licenses WHERE customer_email = $1 ORDER BY created_at DESC LIMIT 1',
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No license found for this email' });
    }
    
    const row = result.rows[0];
    await sendLicenseEmail({ 
      email: row.customer_email, 
      name: row.customer_name || row.customer_email, 
      licenseKey: row.license_key, 
      plan: row.plan_type 
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to resend license:', error);
    res.status(500).json({ error: 'Failed to resend license email' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend Server running on port ${PORT}`);
});
