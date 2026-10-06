import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { verifyStaffAccessToken } from '../staff-jwt'

function getJwtSecret(): string {
  if (!process.env.JWT_SECRET && !process.env.NEXTAUTH_SECRET) throw new Error('[SECURITY] JWT_SECRET or NEXTAUTH_SECRET env var is required')
  return process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET!
}

function hmacSign(data: string): string {
  return crypto.createHmac('sha256', getJwtSecret()).update(data).digest('hex')
}

function b64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4) base64 += '='
  return Buffer.from(base64, 'base64').toString('utf-8')
}

export function verifySimpleToken(token: string): any {
  try {
    const parts = token.split('.')

    if (parts.length === 3) {
      try {
        const decoded = jwt.verify(token, getJwtSecret()) as any
        return {
          id: decoded.sub || decoded.id,
          email: decoded.email,
          role: decoded.role,
          firstName: decoded.firstName || '',
          lastName: decoded.lastName || '',
          assignedCountries: Array.isArray(decoded.assignedCountries) ? decoded.assignedCountries : [],
          sid: decoded.sid || decoded.sessionId || null,
          sessionId: decoded.sid || decoded.sessionId || null,
          type: decoded.type || undefined,
          name: [decoded.firstName, decoded.lastName].filter(Boolean).join(' ') || decoded.name || null,
          branchId: decoded.branchId || null,
          province: decoded.province || null,
          region: decoded.region || null,
          canEditServices: decoded.canEditServices || false,
          authType: decoded.authType || 'admin',
        }
      } catch {
        return null
      }
    }

    const [encoded, signature] = parts
    if (!encoded || !signature) return null
    const expectedSig = hmacSign(encoded)
    if (!crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSig, 'hex'))) return null
    const payload = JSON.parse(Buffer.from(encoded, 'base64').toString())
    const maxAge = 30 * 24 * 60 * 60 * 1000
    if (Date.now() - payload.created > maxAge) return null
    return payload
  } catch {
    return null
  }
}

export function createSimpleToken(data: any): string {
  const payload = { ...data, created: Date.now() }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64')
  const signature = hmacSign(encoded)
  return `${encoded}.${signature}`
}

export async function getAdminSession(request: {
  headers: { get: (name: string) => string | null }
  cookies: { get: (name: string) => { value: string } | undefined }
}) {
  const authorization = request.headers.get('Authorization')
  if (authorization?.startsWith('Bearer ')) {
    const claims = verifyStaffAccessToken(authorization.slice(7))
    if (claims) return claims

    // Legacy admin tokens are development/test compatibility only. Production
    // CRM authorization must be isolated on STAFF_JWT_SECRET.
    if (process.env.NODE_ENV !== 'production') {
      const legacy = verifySimpleToken(authorization.slice(7))
      if (legacy) return legacy
    }
    return null
  }

  const token = request.cookies.get('admin_token')?.value
  if (!token) return null

  const claims = verifyStaffAccessToken(token)
  if (claims) return claims

  if (process.env.NODE_ENV !== 'production') {
    return verifySimpleToken(token)
  }

  return null
}
