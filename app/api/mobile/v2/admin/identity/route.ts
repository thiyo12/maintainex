import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/auth/compatibility/mobile-auth'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user || !['SUPER_ADMIN', 'MANAGER', 'FINANCE'].includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const where: any = {}
    if (status) where.status = status

    const pendingDocs = await prisma.identityDocument.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true, phone: true } } },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ documents: pendingDocs })
  } catch (error) {
    console.error('Admin list identity error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
