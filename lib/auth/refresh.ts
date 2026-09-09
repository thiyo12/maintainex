import crypto from 'crypto'
import { REFRESH_TOKEN_BYTES } from './constants'

export interface ParsedRefreshToken {
  sessionId: string
  secret: string
}

export function generateRefreshToken(sessionId: string): { raw: string; secretHash: string } {
  const secret = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString('hex')
  const raw = `${sessionId}.${secret}`
  const secretHash = hashRefreshSecret(secret)
  return { raw, secretHash }
}

export function parseRefreshToken(token: string): ParsedRefreshToken | null {
  const dotIndex = token.indexOf('.')
  if (dotIndex <= 0) return null

  const sessionId = token.substring(0, dotIndex)
  const secret = token.substring(dotIndex + 1)

  if (!sessionId) return null
  if (secret.length < 32) return null

  return { sessionId, secret }
}

export function hashRefreshSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret).digest('hex')
}

export function verifyRefreshSecret(secret: string, storedHash: string): boolean {
  const computed = hashRefreshSecret(secret)
  if (computed.length !== storedHash.length) return false
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(storedHash))
}
