import crypto from 'crypto'
import jwt from 'jsonwebtoken'

const JWT_SECRET: string = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'dev-jwt-secret-change-in-production'
const JWT_REFRESH_SECRET: string = process.env.JWT_REFRESH_SECRET || 'dev-jwt-refresh-secret-change-in-production'

function hmacSign(data: string): string {
  return crypto.createHmac('sha256', JWT_SECRET).update(data).digest('hex')
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
        const decoded = jwt.verify(token, JWT_SECRET) as any
        return {
          id: decoded.sub || decoded.id,
          email: decoded.email,
          role: decoded.role,
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

export async function getAdminSession(request: { cookies: { get: (name: string) => { value: string } | undefined } }) {
  const token = request.cookies.get('admin_token')?.value
  if (!token) return null
  const payload = verifySimpleToken(token)
  if (!payload) return null
  return payload
}
