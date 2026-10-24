import { createHash, randomBytes } from 'node:crypto'

export const TRUSTED_CONTACT_CONSENT_VERSION = 'safety-share-v1'
export const TRUSTED_CONTACT_MAX_HOURS = 24

export function createTrustedContactToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashTrustedContactToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function isValidTrustedContactToken(token: unknown): token is string {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token)
}

export function trustedContactExpiry(hours: unknown, now = new Date()): Date | null {
  if (!Number.isInteger(hours) || (hours as number) < 1 || (hours as number) > TRUSTED_CONTACT_MAX_HOURS) {
    return null
  }
  return new Date(now.getTime() + (hours as number) * 60 * 60 * 1000)
}
