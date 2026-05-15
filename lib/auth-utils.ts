import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { prisma } from '@/lib/prisma'

const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET or NEXTAUTH_SECRET must be set in production')
  }
  console.warn('⚠️ SECURITY: JWT_SECRET not set - using insecure fallback')
}


export type SessionUser = SessionData

export interface SessionData {
  id: string
  email: string
  name: string
  role: string
  isActive: boolean
  branchId?: string
  canEditServices?: boolean
  province?: string
}

export async function getSession(req: NextRequest): Promise<SessionData | null> {
  try {
    const cookie = req.cookies.get('session')
    if (!cookie) return null

    const token = cookie.value
    const decoded = jwt.verify(token, JWT_SECRET!) as unknown as SessionData

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { adminProfile: { select: { canEditServices: true, branchId: true, province: true } } }
    })

    if (!user || !user.isActive) return null

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      branchId: user.adminProfile?.branchId ?? undefined,
      canEditServices: user.adminProfile?.canEditServices ?? false,
      province: user.adminProfile?.province ?? undefined
    }
  } catch {
    return null
  }
}

export function requireAuth(req: NextRequest) {
  return getSession(req)
}

export function requireRole(session: SessionData | null, roles: string[]) {
  if (!session) return false
  return roles.includes(session.role)
}

export function createToken(user: SessionData): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      canEditServices: user.canEditServices,
    },
    JWT_SECRET!,
    { expiresIn: '7d' }
  )
}

export async function hashPassword(password: string): Promise<string> {
  const bcrypt = await import('bcryptjs')
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const bcrypt = await import('bcryptjs')
  return bcrypt.compare(password, hash)
}
