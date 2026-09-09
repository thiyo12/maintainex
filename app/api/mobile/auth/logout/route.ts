import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/mobile-auth'
import { revokeSession, revokeAllUserSessions } from '@/lib/auth/sessions'
import { verifyMarketplaceAccessToken } from '@/lib/auth/marketplace-jwt'
import { parseRefreshToken } from '@/lib/auth/refresh'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const all = body.all === true

    const authHeader = request.headers.get('authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (token) {
      const claims = verifyMarketplaceAccessToken(token)
      if (claims) {
        if (all) {
          await revokeAllUserSessions(claims.sub, 'logout_all')
        } else {
          await revokeSession(claims.sid)
        }
        return NextResponse.json({ success: true })
      }

      const parsed = parseRefreshToken(token)
      if (parsed) {
        const session = await prisma.userSession.findUnique({
          where: { id: parsed.sessionId },
          select: { id: true, userId: true },
        })
        if (session) {
          if (all) {
            await revokeAllUserSessions(session.userId, 'logout_all')
          } else {
            await revokeSession(session.id)
          }
          return NextResponse.json({ success: true })
        }
      }
    }

    const user = await authenticateRequest(request)
    if (user) {
      if (all) {
        await revokeAllUserSessions(user.id, 'logout_all')
      } else {
        const claims = token ? verifyMarketplaceAccessToken(token) : null
        if (claims) {
          await revokeSession(claims.sid)
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: true })
  }
}
