import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function getInternalSyncSecret(): string {
  if (!process.env.INTERNAL_SYNC_SECRET) throw new Error('[SECURITY] INTERNAL_SYNC_SECRET env var is required')
  return process.env.INTERNAL_SYNC_SECRET
}

export async function GET(request: NextRequest) {
  const syncHeader = request.headers.get('x-internal-sync')
  if (!syncHeader || syncHeader !== getInternalSyncSecret()) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const blockedIPs = await prisma.ipBlock.findMany({
      where: {
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      select: {
        ip: true,
        expiresAt: true,
      },
    })

    return NextResponse.json({ blockedIPs })
  } catch (error) {
    return NextResponse.json({ blockedIPs: [] })
  }
}
