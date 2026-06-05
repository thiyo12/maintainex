import { NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'
import { prisma } from './prisma'

const JWT_SECRET: string = process.env.NEXTAUTH_SECRET || ''
if (!JWT_SECRET) {
  throw new Error('NEXTAUTH_SECRET environment variable is required')
}

const TOKEN_MAX_AGE = '30d'

export function createToken(data: object): string | null {
  try {
    return jwt.sign(data, JWT_SECRET, { expiresIn: TOKEN_MAX_AGE })
  } catch {
    return null
  }
}

export function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch {
    return null
  }
}

export function getTokenFromRequest(request: NextRequest): string | null {
  const auth = request.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  return null
}

export async function authenticateRequest(request: NextRequest) {
  const token = getTokenFromRequest(request)
  if (!token) return null
  const payload = verifyToken(token)
  if (!payload) return null

  const user = await prisma.user.findUnique({
    where: { id: payload.id },
    select: { id: true, email: true, name: true, phone: true, role: true, isActive: true, identityStatus: true },
  })

  if (!user || !user.isActive) return null
  return user
}
