import { NextRequest } from 'next/server'
import { verifySimpleToken } from './admin-auth'

export interface SessionUser {
  id: string
  email: string
  role: string
  branchId?: string | null
  province?: string | null
  region?: string | null
  name?: string | null
  canEditServices?: boolean
}

export async function getSession(request: NextRequest): Promise<SessionUser | null> {
  // Try Bearer token header first
  const authHeader = request.headers.get('Authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    const payload = verifySimpleToken(token)
    if (payload && payload.id && payload.email && payload.role) {
      return {
        id: payload.id,
        email: payload.email,
        role: payload.role,
        branchId: payload.branchId || null,
        province: payload.province || null,
        region: payload.region || null,
        name: payload.name || null,
        canEditServices: payload.canEditServices || false,
      }
    }
  }

  // Fallback to cookie-based auth
  const cookieToken = request.cookies.get('admin_token')?.value
  if (!cookieToken) return null

  const cookiePayload = verifySimpleToken(cookieToken)
  if (!cookiePayload) return null

  return {
    id: cookiePayload.id,
    email: cookiePayload.email,
    role: cookiePayload.role,
    branchId: cookiePayload.branchId,
    province: cookiePayload.province || null,
    region: cookiePayload.region || null,
    name: cookiePayload.name,
    canEditServices: cookiePayload.canEditServices || false,
  }
}
