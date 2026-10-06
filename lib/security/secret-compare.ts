import crypto from 'node:crypto'

export function timingSafeSecretEqual(
  actual: string | null | undefined,
  expected: string | null | undefined,
): boolean {
  if (!actual || !expected) return false

  const actualBuffer = Buffer.from(actual, 'utf8')
  const expectedBuffer = Buffer.from(expected, 'utf8')
  if (actualBuffer.length !== expectedBuffer.length) return false

  try {
    return crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  } catch {
    return false
  }
}

export function matchesBearerSecret(
  authorization: string | null | undefined,
  secret: string | null | undefined,
): boolean {
  if (!secret) return false
  return timingSafeSecretEqual(authorization, `Bearer ${secret}`)
}

export function matchesSharedSecret(
  supplied: string | null | undefined,
  secret: string | null | undefined,
): boolean {
  return timingSafeSecretEqual(supplied, secret)
}
