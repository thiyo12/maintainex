const REQUIRED_PRODUCTION_SECRETS = [
  'MARKETPLACE_JWT_SECRET',
  'STAFF_JWT_SECRET',
] as const

const REQUIRED_SECRETS = [
  'MARKETPLACE_JWT_SECRET',
  'STAFF_JWT_SECRET',
  'PASSWORD_PEPPER',
  'INTERNAL_SYNC_SECRET',
  'CRON_SECRET',
] as const

function validateSecretLength(name: string, value: string, minBytes: number) {
  const hexLength = minBytes * 2
  if (value.length < hexLength) {
    console.error(
      `[SECURITY] ${name} is too short. Minimum ${minBytes} bytes (${hexLength} hex chars). Got ${value.length} chars.`
    )
    return false
  }
  return true
}

export function validateRequiredSecrets(): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  for (const name of REQUIRED_SECRETS) {
    const value = process.env[name]
    if (!value) {
      if (process.env.NODE_ENV === 'production') {
        errors.push(`[CRITICAL] ${name} is missing in production environment`)
      } else {
        console.warn(`[WARN] ${name} is not set (non-production)`)
      }
    } else {
      validateSecretLength(name, value, 32)
    }
  }

  if (process.env.NODE_ENV === 'production') {
    const marketplace = process.env.MARKETPLACE_JWT_SECRET
    const staff = process.env.STAFF_JWT_SECRET
    const legacy = process.env.JWT_SECRET

    if (marketplace && legacy && marketplace === legacy) {
      errors.push('[CRITICAL] MARKETPLACE_JWT_SECRET must not equal legacy JWT_SECRET')
    }
    if (staff && legacy && staff === legacy) {
      errors.push('[CRITICAL] STAFF_JWT_SECRET must not equal legacy JWT_SECRET')
    }
    if (marketplace && staff && marketplace === staff) {
      errors.push('[CRITICAL] MARKETPLACE_JWT_SECRET and STAFF_JWT_SECRET must be independent')
    }
    if (process.env.ALLOW_TEST_OTP === 'true') {
      errors.push('[CRITICAL] ALLOW_TEST_OTP must not be enabled in production')
    }
  }

  if (errors.length > 0) {
    for (const err of errors) {
      console.error(err)
    }
    return { valid: false, errors }
  }

  return { valid: true, errors: [] }
}

export function getPayHereConfig(): { merchantId: string; merchantSecret: string; sandbox: boolean } | null {
  const merchantId = process.env.PAYHERE_MERCHANT_ID
  const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET
  if (!merchantId || !merchantSecret) return null
  return { merchantId, merchantSecret, sandbox: process.env.PAYHERE_SANDBOX !== 'false' }
}

let validated = false

export function ensureSecretsValidated() {
  if (validated) return
  validated = true

  const result = validateRequiredSecrets()
  if (!result.valid && process.env.NODE_ENV === 'production') {
    console.error('[SECURITY] Startup validation FAILED. Auth endpoints may be unavailable.')
  }
}
