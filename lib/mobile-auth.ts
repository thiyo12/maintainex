import { NextRequest } from 'next/server'
import { prisma } from './prisma'

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'fallback-secret-key-change-in-production'

export function createToken(data: any): string {
  const payload = { ...data, created: Date.now() }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64')
  const signature = Buffer.from(JWT_SECRET + encoded).toString('base64').slice(0, 32)
  return `${encoded}.${signature}`
}

export function verifyToken(token: string): any {
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
    select: { id: true, email: true, name: true, phone: true, role: true, isActive: true },
  })

  if (!user || !user.isActive) return null
  return user
}
