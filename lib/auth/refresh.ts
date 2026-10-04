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
  const expectedSecretLength = REFRESH_TOKEN_BYTES * 2
  if (!token || token.length > 384) return null

  const dotIndex = token.indexOf('.')
  if (dotIndex <= 0 || token.indexOf('.', dotIndex + 1) !== -1) return null

  const sessionId = token.substring(0, dotIndex)
  const secret = token.substring(dotIndex + 1)

  if (!sessionId || sessionId.length > 191) return null
  if (!/^[A-Za-z0-9_-]+$/.test(sessionId)) return null
  if (secret.length !== expectedSecretLength) return null
  if (!/^[0-9a-f]+$/.test(secret)) return null

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
