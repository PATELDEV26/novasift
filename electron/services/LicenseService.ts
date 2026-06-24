import { machineIdSync } from 'node-machine-id';
import Store from 'electron-store';
import crypto from 'crypto';

interface LicenseStore {
  license_key: string | null;
  machine_id: string | null;
  last_validation_response: any | null;
  last_validation_timestamp: number | null;
}

export class LicenseService {
  private store: Store<LicenseStore>;
  private machineId: string;
  private readonly API_URL = 'https://thesidejob.tech/api/validate-license'; // Point to backend

  constructor() {
    this.machineId = this.generateMachineId();
    
    // Use an encryption key derived from the machine ID to prevent copying store files
    const encryptionKey = crypto.createHash('sha256').update(this.machineId + 'novasift_secret').digest('hex');
    
    this.store = new Store<LicenseStore>({
      name: 'novasift_license',
      encryptionKey,
      defaults: {
        license_key: null,
        machine_id: this.machineId,
        last_validation_response: null,
        last_validation_timestamp: null
      }
    });
  }

  private generateMachineId(): string {
    try {
      // machineIdSync generates a stable unique ID based on hardware
      const hardwareId = machineIdSync(true);
      return crypto.createHash('sha256').update(hardwareId).digest('hex');
    } catch (e) {
      console.error('Failed to generate machine ID', e);
      return 'fallback-machine-id-' + Math.random().toString(36).substring(7);
    }
  }

  public getMachineId(): string {
    return this.machineId;
  }

  public async validateKey(licenseKey: string): Promise<any> {
    try {
      // In production, you would want to use a hardened HTTPS client to prevent MITM
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          license_key: licenseKey,
          machine_id: this.machineId,
          app_version: '1.0.0'
        })
      });

      const data = await response.json();

      if (data.valid) {
        // Cache the successful response
        this.store.set('license_key', licenseKey);
        this.store.set('last_validation_response', data);
        this.store.set('last_validation_timestamp', Date.now());
      } else {
        // Clear if invalid or revoked
        this.store.set('license_key', null);
        this.store.set('last_validation_response', data); // Store error reason
      }

      return data;
    } catch (error) {
      console.error('Validation API error, checking offline cache', error);
      return this.checkOfflineCache(licenseKey);
    }
  }

  private checkOfflineCache(licenseKey: string): any {
    const cachedKey = this.store.get('license_key');
    const cachedResponse = this.store.get('last_validation_response');
    const lastTimestamp = this.store.get('last_validation_timestamp');

    if (cachedKey === licenseKey && cachedResponse?.valid && lastTimestamp) {
      const daysOffline = (Date.now() - lastTimestamp) / (1000 * 60 * 60 * 24);
      if (daysOffline <= 7) {
        return {
          valid: true,
          plan: cachedResponse.plan,
          expires_at: cachedResponse.expires_at,
          offline: true,
          offline_days_remaining: Math.floor(7 - daysOffline)
        };
      } else {
        return { valid: false, reason: 'offline_grace_expired' };
      }
    }
    return { valid: false, reason: 'network_error' };
  }

  public getCachedLicenseStatus(): any {
    const cachedKey = this.store.get('license_key');
    if (!cachedKey) return { valid: false, reason: 'no_license' };
    
    // Automatically revalidate in background if it's been more than 24h
    const lastTimestamp = this.store.get('last_validation_timestamp');
    if (lastTimestamp && (Date.now() - lastTimestamp) > (1000 * 60 * 60 * 24)) {
      // Revalidate async
      this.validateKey(cachedKey).catch(console.error);
    }
    
    return this.checkOfflineCache(cachedKey);
  }

  public deactivateLicense(): void {
    this.store.clear();
  }
}
