import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/auth/compatibility/mobile-auth'
import { safeParseJsonArr } from '@/lib/db-utils'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tasker = await prisma.taskerProfile.findFirst({
      where: { id },
      include: {
        user: { select: { id: true, name: true } },
        reviews: {
          include: { reviewer: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    })

    if (!tasker) {
      return NextResponse.json({ error: 'Tasker not found' }, { status: 404 })
    }

    return NextResponse.json({
      id: tasker.id,
      userId: tasker.userId,
      name: tasker.user.name,
      bio: tasker.bio || '',
      rating: tasker.rating,
      completedJobs: tasker.completedJobs,
      isVerified: tasker.isVerified,
      isOnline: tasker.isOnline,
      profileImage: tasker.profileImage,
      skills: safeParseJsonArr(tasker.skills),
      hourlyRate: tasker.hourlyRate,
      serviceAreas: safeParseJsonArr(tasker.serviceAreas),
      reviews: tasker.reviews.map(r => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        reviewerName: r.reviewer.name,
        createdAt: r.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error('Find tasker profile error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
