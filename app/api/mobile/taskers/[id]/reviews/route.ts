import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/auth/compatibility/mobile-auth'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const reviews = await prisma.taskerReview.findMany({
      where: { taskerId: id },
      include: { reviewer: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(
      reviews.map(r => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        jobId: r.jobId,
        reviewerName: r.reviewer.name,
        createdAt: r.createdAt.toISOString(),
      }))
    )
  } catch (error) {
    secureConsole.error('Reviews error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
