const REQUIRED_SECRETS = [
  'MARKETPLACE_JWT_SECRET',
  'STAFF_JWT_SECRET',
  'PASSWORD_PEPPER',
  'IDENTITY_CLAIM_PEPPER',
  'INTERNAL_SYNC_SECRET',
  'CRON_SECRET',
] as const

function validateSecretLength(name: string, value: string, minBytes: number): string | null {
  const bytes = Buffer.byteLength(value, 'utf8')
  if (bytes < minBytes) {
    return `[CRITICAL] ${name} is too short. Minimum ${minBytes} bytes; got ${bytes}.`
  }
  return null
}

function anyConfigured(names: readonly string[]): boolean {
  return names.some(name => Boolean(process.env[name]))
}

export function validateRequiredSecrets(): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  const production = process.env.NODE_ENV === 'production'

  for (const name of REQUIRED_SECRETS) {
    const value = process.env[name]
    if (!value) {
      if (production) {
        errors.push(`[CRITICAL] ${name} is missing in production environment`)
      } else {
        console.warn(`[WARN] ${name} is not set (non-production)`)
      }
      continue
    }

    const lengthError = validateSecretLength(name, value, 32)
    if (lengthError) {
      if (production) errors.push(lengthError)
      else console.warn(lengthError.replace('[CRITICAL]', '[WARN]'))
    }
  }

  if (production) {
    const marketplace = process.env.MARKETPLACE_JWT_SECRET
    const staff = process.env.STAFF_JWT_SECRET
    const legacy = process.env.JWT_SECRET
    const passwordPepper = process.env.PASSWORD_PEPPER
    const identityPepper = process.env.IDENTITY_CLAIM_PEPPER

    if (marketplace && legacy && marketplace === legacy) {
      errors.push('[CRITICAL] MARKETPLACE_JWT_SECRET must not equal legacy JWT_SECRET')
    }
    if (staff && legacy && staff === legacy) {
      errors.push('[CRITICAL] STAFF_JWT_SECRET must not equal legacy JWT_SECRET')
    }
    if (marketplace && staff && marketplace === staff) {
      errors.push('[CRITICAL] MARKETPLACE_JWT_SECRET and STAFF_JWT_SECRET must be independent')
    }
    if (passwordPepper && identityPepper && passwordPepper === identityPepper) {
      errors.push('[CRITICAL] PASSWORD_PEPPER and IDENTITY_CLAIM_PEPPER must be independent')
    }

    if (process.env.ALLOW_TEST_OTP === 'true') {
      errors.push('[CRITICAL] ALLOW_TEST_OTP must not be enabled in production')
    }

    const mobileCorsOrigin = process.env.MOBILE_CORS_ORIGIN?.trim()
    if (mobileCorsOrigin) {
      if (mobileCorsOrigin === '*') {
        errors.push('[CRITICAL] MOBILE_CORS_ORIGIN must not be wildcard in production')
      } else {
        try {
          const parsed = new URL(mobileCorsOrigin)
          if (parsed.protocol !== 'https:' || parsed.origin !== mobileCorsOrigin) {
            errors.push('[CRITICAL] MOBILE_CORS_ORIGIN must be a single HTTPS origin in production')
          }
        } catch {
          errors.push('[CRITICAL] MOBILE_CORS_ORIGIN must be a valid HTTPS origin in production')
        }
      }
    }

    const releaseSha = process.env.APP_RELEASE_SHA
    if (!releaseSha) {
      errors.push('[CRITICAL] APP_RELEASE_SHA is required in production')
    } else if (!/^[0-9a-f]{40}$/.test(releaseSha)) {
      errors.push('[CRITICAL] APP_RELEASE_SHA must be a lowercase 40-character git SHA')
    }

    const paypalVars = ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_WEBHOOK_ID'] as const
    if (anyConfigured(paypalVars)) {
      for (const name of paypalVars) {
        if (!process.env[name]) {
          errors.push(`[CRITICAL] ${name} is required when PayPal is configured in production`)
        }
      }
      if (process.env.PAYPAL_SANDBOX !== 'false') {
        errors.push('[CRITICAL] PAYPAL_SANDBOX must be explicitly false when PayPal is configured in production')
      }
    }

    const payHereVars = [
      'PAYHERE_MERCHANT_ID',
      'PAYHERE_MERCHANT_SECRET',
      'PAYHERE_APP_ID',
      'PAYHERE_APP_SECRET',
    ] as const
    if (anyConfigured(payHereVars) && process.env.PAYHERE_SANDBOX !== 'false') {
      errors.push('[CRITICAL] PAYHERE_SANDBOX must be explicitly false when PayHere production reconciliation/refund credentials are configured')
    }
  }

  if (errors.length > 0) {
    for (const err of errors) console.error(err)
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

  const result = validateRequiredSecrets()
  if (!result.valid && process.env.NODE_ENV === 'production') {
    throw new Error('[SECURITY] Production startup validation failed')
  }

  validated = true
}
