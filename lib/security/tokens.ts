import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/shared/observability/logger'

const TOKEN_LENGTH = 48
const TOKEN_EXPIRY_HOURS = 1

function generateToken(): string {
  return crypto.randomBytes(TOKEN_LENGTH).toString('base64url')
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export async function createPasswordResetToken(userId: string): Promise<string> {
  const token = generateToken()
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000)
  const id = crypto.randomUUID()
  const createdAt = new Date()

  await prisma.$executeRaw`
    INSERT INTO PasswordResetToken (id, userId, tokenHash, expiresAt, createdAt)
    VALUES (${id}, ${userId}, ${tokenHash}, ${expiresAt.toISOString()}, ${createdAt.toISOString()})
  `

  return token
}

export async function verifyPasswordResetToken(token: string): Promise<{ userId: string } | null> {
  const tokenHash = hashToken(token)

  const result = await prisma.$queryRaw`
    SELECT id, userId, expiresAt, usedAt FROM PasswordResetToken WHERE tokenHash = ${tokenHash} LIMIT 1
  ` as Array<{ id: string; userId: string; expiresAt: string; usedAt: string | null }>

  if (!result || result.length === 0) return null

  const row = result[0]
  if (row.usedAt) return null
  if (new Date(row.expiresAt) < new Date()) return null

  await prisma.$executeRaw`
    UPDATE PasswordResetToken SET usedAt = ${new Date().toISOString()} WHERE id = ${row.id}
  `

  return { userId: row.userId }
}

export async function cleanupExpiredTokens(): Promise<number> {
  try {
    const result = await prisma.$executeRaw`
      DELETE FROM PasswordResetToken WHERE expiresAt < ${new Date().toISOString()} OR usedAt IS NOT NULL
    `
    return result as number
  } catch (e) {
    logger.error('Password reset token cleanup failed', { err: e })
    return 0
  }
}
