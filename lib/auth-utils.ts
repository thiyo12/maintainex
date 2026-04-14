import { NextRequest } from 'next/server'

export interface SessionUser {
  id: string
  email: string
  role: string
  branchId?: string | null
  name?: string | null
  canEditServices?: boolean
}

export async function getSession(request: NextRequest): Promise<SessionUser | null> {
  // First try to get from Authorization header (from localStorage auth)
  const authHeader = request.headers.get('Authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7) // Remove 'Bearer ' prefix
      const decoded = JSON.parse(atob(token))
      if (decoded.id && decoded.email && decoded.role) {
        return {
          id: decoded.id,
          email: decoded.email,
          role: decoded.role,
          branchId: decoded.branchId || null,
          name: decoded.name || null,
          canEditServices: decoded.canEditServices || false
        }
      }
    } catch {
      // Fall through to cookie check
    }
  }

  // Fallback to cookie-based auth
  const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'fallback-secret-key-change-in-production'
  
  function verifySimpleToken(token: string): any {
    try {
      const [encoded, signature] = token.split('.')
      if (!encoded || !signature) return null
      
      const expectedSig = Buffer.from(JWT_SECRET + encoded).toString('base64').slice(0, 32)
      if (signature !== expectedSig) return null
      
      const payload = JSON.parse(Buffer.from(encoded, 'base64').toString())
      
      const maxAge = 30 * 24 * 60 * 60 * 1000
      if (Date.now() - payload.created > maxAge) return null
      
      return payload
    } catch {
      return null
    }
  }

  const token = request.cookies.get('admin_token')?.value
  
  if (!token) {
    return null
  }
  
  const payload = verifySimpleToken(token)
  if (!payload) {
    return null
  }
  
  return {
    id: payload.id,
    email: payload.email,
    role: payload.role,
    branchId: payload.branchId,
    name: payload.name,
    canEditServices: payload.canEditServices || false
  }
}
