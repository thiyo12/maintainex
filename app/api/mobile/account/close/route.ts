import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { getTrustedClientIp } from '@/lib/security/client-ip'
import { authenticateRequest } from '@/lib/auth/compatibility/mobile-auth'
import {
  closeMarketplaceAccount,
  getAccountClosurePreflight,
  type AccountClosurePreflight,
} from '@/lib/account/account-closure'
import { prisma } from '@/lib/prisma'

function ipFromRequest(request: NextRequest): string | null {
  const ip = getTrustedClientIp(request.headers)
  return ip === 'unknown' ? null : ip
}

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const preflight = await getAccountClosurePreflight(prisma, user.id)
    return NextResponse.json(
      { preflight },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    secureConsole.error('Account closure preflight error:', error)
    return NextResponse.json(
      { error: 'Unable to check account closure requirements' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const confirmation =
      typeof body?.confirmation === 'string'
        ? body.confirmation.trim().toUpperCase()
        : ''

    if (confirmation !== 'CLOSE ACCOUNT') {
      return NextResponse.json(
        {
          error: 'Type CLOSE ACCOUNT to confirm permanent marketplace account closure.',
          code: 'CLOSURE_CONFIRMATION_REQUIRED',
        },
        { status: 400 },
      )
    }

    const result = await closeMarketplaceAccount({
      userId: user.id,
      ipAddress: ipFromRequest(request),
      userAgent: request.headers.get('user-agent'),
    })

    return NextResponse.json({
      success: true,
      closed: true,
      closesWithBalance: result.preflight.closesWithBalance,
      outstandingCommission: result.preflight.outstandingCommission,
    })
  } catch (error) {
    secureConsole.error('Account closure error:', error)
    const message = error instanceof Error ? error.message : ''

    if (message === 'ACCOUNT_CLOSURE_CHANGED_CONCURRENTLY') {
      return NextResponse.json(
        { error: 'Account state changed while closing. Refresh and try again.' },
        { status: 409 },
      )
    }

    if (message === 'ACCOUNT_CLOSURE_BLOCKED') {
      const preflight = (error as Error & { preflight?: AccountClosurePreflight }).preflight
      return NextResponse.json(
        {
          error: 'Resolve the listed account obligations before closing this account.',
          code: 'ACCOUNT_CLOSURE_BLOCKED',
          preflight,
        },
        { status: 409 },
      )
    }

    return NextResponse.json(
      { error: 'Unable to close account' },
      { status: 500 },
    )
  }
}
