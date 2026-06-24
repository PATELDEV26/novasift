import { getSettings, saveSettings } from './db'

export const ADMIN_EMAILS = ['removed_admin@gmail.com']

export async function evaluateSubscriptionStatus(email: string | null = null): Promise<void> {
  const currentSettings = getSettings()
  const targetEmail = email || currentSettings.email_address

  if (!targetEmail) return

  let newTier: 'free' | 'pro' = 'free'

  // Admin Bypass
  if (ADMIN_EMAILS.includes(targetEmail)) {
    newTier = 'pro'
  } else if (currentSettings.license_key === 'NOVASIFT-PRO-TEST') {
    // Placeholder for future payment API validation
    newTier = 'pro'
  } else {
    // Check if they currently have a pro tier but shouldn't, downgrade them
    newTier = 'free'
  }

  if (currentSettings.subscription_tier !== newTier) {
    saveSettings({ subscription_tier: newTier })
  }
}

export async function verifyLicense(licenseKey: string): Promise<boolean> {
  // Mock API call
  if (licenseKey === 'NOVASIFT-PRO-TEST') {
    saveSettings({ license_key: licenseKey, subscription_tier: 'pro' })
    return true
  }
  return false
}
