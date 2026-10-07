import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/shared/observability/logger'
import { prisma } from '@/lib/prisma'
import { recalculateReputation } from '@/lib/reputation-engine'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) throw new Error('[SECURITY] CRON_SECRET env var is required')
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const taskers = await prisma.taskerProfile.findMany({
      where: { user: { isActive: true } },
      select: { userId: true },
    })

    let updated = 0
    for (const t of taskers) {
      await recalculateReputation(t.userId)
      updated++
    }

    return NextResponse.json({ success: true, updated })
  } catch (error) {
    logger.error('Reputation recalculation cron failed unexpectedly', { err: error })
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
