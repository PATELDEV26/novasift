import { machineIdSync } from 'node-machine-id';
import Store from 'electron-store';
import crypto from 'crypto';
import { app, net } from 'electron';

export interface LicenseState {
  isValid: boolean;
  isOfflineGrace: boolean;
  reason?: string;
  plan?: 'free' | 'pro' | 'lifetime';
  expiresAt?: string;
}

interface StoredLicenseData {
  license_key: string | null;
  machine_id: string;
  last_validation_response: any;
  last_validation_timestamp: number;
}

let secureStore: Store<StoredLicenseData> | null = null;
let cachedMachineId: string | null = null;

export function getMachineId(): string {
  if (!cachedMachineId) {
    try {
      // Hash the machine ID for privacy
      const rawId = machineIdSync(true); // true = original id
      cachedMachineId = crypto.createHash('sha256').update(rawId).digest('hex');
    } catch (err) {
      console.error('Failed to generate machine ID', err);
      // Fallback
      cachedMachineId = crypto.createHash('sha256').update('fallback-machine-id-123').digest('hex');
    }
  }
  return cachedMachineId;
}

export function getSecureStore(): Store<StoredLicenseData> {
  if (!secureStore) {
    const mId = getMachineId();
    secureStore = new Store<StoredLicenseData>({
      name: 'secure-config',
      encryptionKey: mId, // Encrypted tied to machine
      defaults: {
        license_key: null,
        machine_id: mId,
        last_validation_response: null,
        last_validation_timestamp: 0,
      }
    });
  }
  return secureStore;
}

// Generate an HMAC signature to sign the request
function signRequest(payload: string): string {
  // In a real app, this secret should be injected during build time or obfuscated
  const SECRET = 'NOVA-VALIDATION-SECRET-X1Y2Z3';
  return crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
}

export async function validateLicense(key: string): Promise<LicenseState> {
  const store = getSecureStore();
  const mId = getMachineId();

  // Save the key so we can validate it offline later
  store.set('license_key', key);

  try {
    const payloadObj = {
      license_key: key,
      machine_id: mId,
      app_version: app.getVersion()
    };
    const payload = JSON.stringify(payloadObj);
    const signature = signRequest(payload);

    // Call validation API
    const response = await fetch('https://thesidejob.tech/api/validate-license', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Signature': signature
      },
      body: payload
    });

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    const data = await response.json();

    if (data.valid) {
      store.set('last_validation_response', data);
      store.set('last_validation_timestamp', Date.now());
      return { isValid: true, isOfflineGrace: false, plan: data.plan, expiresAt: data.expires_at };
    } else {
      // Validation failed (revoked, expired, invalid)
      store.set('last_validation_response', null);
      store.set('last_validation_timestamp', 0);
      return { isValid: false, isOfflineGrace: false, reason: data.reason };
    }
  } catch (error) {
    console.error('Validation API failed, checking offline grace period:', error);
    
    // Check offline grace period
    const lastValidationTimestamp = store.get('last_validation_timestamp') || 0;
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const timeSinceLastValidation = Date.now() - lastValidationTimestamp;

    if (store.get('last_validation_response') && timeSinceLastValidation < sevenDaysMs) {
       return { isValid: true, isOfflineGrace: true, reason: 'offline_grace', plan: store.get('last_validation_response').plan };
    }

    return { isValid: false, isOfflineGrace: false, reason: 'network_error' };
  }
}

export async function getLicenseState(): Promise<LicenseState> {
  const store = getSecureStore();
  const key = store.get('license_key');
  
  if (!key) {
    return { isValid: false, isOfflineGrace: false, reason: 'no_key' };
  }

  // Check if we need to re-validate in background or just return cached state
  // For simplicity, we'll validate on every app launch if we have a key
  return validateLicense(key);
}

export function deactivateLicense(): void {
  const store = getSecureStore();
  store.set('license_key', null);
  store.set('last_validation_response', null);
  store.set('last_validation_timestamp', 0);
}
