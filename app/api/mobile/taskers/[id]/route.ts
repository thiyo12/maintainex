import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'
import { safeParseJsonArr } from '@/lib/db-utils'

// Get single tasker
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tasker = await prisma.taskerProfile.findUnique({
      where: { id: params.id },
      include: {
        user: { select: { id: true, name: true, phone: true, email: true } },
        reviews: { include: { reviewer: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 20 },
      },
    })

    if (!tasker) {
      return NextResponse.json({ error: 'Tasker not found' }, { status: 404 })
    }

    return NextResponse.json({
      id: tasker.id,
      userId: tasker.userId,
      bio: tasker.bio,
      hourlyRate: tasker.hourlyRate,
      skills: safeParseJsonArr(tasker.skills),
      serviceAreas: safeParseJsonArr(tasker.serviceAreas),
      rating: tasker.rating,
      completedJobs: tasker.completedJobs,
      isVerified: tasker.isVerified,
      isOnline: tasker.isOnline,
      latitude: tasker.latitude,
      longitude: tasker.longitude,
      profileImage: tasker.profileImage,
      user: tasker.user,
      reviews: tasker.reviews.map(r => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        reviewerName: r.reviewer.name,
        createdAt: r.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error('Tasker get error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
