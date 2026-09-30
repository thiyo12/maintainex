import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { verifyAccessToken } from './admin-jwt'

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

export async function getAdminSession(request: { headers: { get: (name: string) => string | null }, cookies: { get: (name: string) => { value: string } | undefined } }) {
  // Try Bearer header first (for API/mobile clients)
  const authHeader = request.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const rawToken = authHeader.slice(7)
    // Try new JWT access token first
    const jwtPayload = verifyAccessToken(rawToken)
    if (jwtPayload) return jwtPayload
    // Fallback to old simple token
    const payload = verifySimpleToken(rawToken)
    if (payload) return payload
  }
  // Fallback to cookie. Current CRM logins store the signed JWT access
  // token in admin_token; keep simple-token verification only as a temporary
  // compatibility fallback for older sessions.
  const token = request.cookies.get('admin_token')?.value
  if (!token) return null

  const jwtPayload = verifyAccessToken(token)
  if (jwtPayload) return jwtPayload

  const legacyPayload = verifySimpleToken(token)
  if (!legacyPayload) return null
  return legacyPayload
}
