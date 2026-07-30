import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const INTERNAL_SYNC_SECRET = process.env.INTERNAL_SYNC_SECRET || 'maintainex-internal-sync-2024'

export async function GET(request: NextRequest) {
  const syncHeader = request.headers.get('x-internal-sync')
  if (!syncHeader || syncHeader !== INTERNAL_SYNC_SECRET) {
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
