import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/auth/compatibility/mobile-auth'
import { safeParseJsonArr } from '@/lib/db-utils'

// Get single tasker
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tasker = await prisma.taskerProfile.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, nickname: true } },
        reviews: { include: { reviewer: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 20 },
      },
    })

    if (!tasker) {
      const byUser = await prisma.taskerProfile.findUnique({
        where: { userId: id },
        include: {
          user: { select: { id: true, name: true, nickname: true } },
          reviews: { include: { reviewer: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 20 },
        },
      })
      if (!byUser) {
        return NextResponse.json({ error: 'Tasker not found' }, { status: 404 })
      }
      const resolved = byUser
      return NextResponse.json({
        id: resolved.id,
        userId: resolved.userId,
        bio: resolved.bio,
        hourlyRate: resolved.hourlyRate,
        skills: safeParseJsonArr(resolved.skills),
        serviceAreas: safeParseJsonArr(resolved.serviceAreas),
        rating: resolved.rating,
        completedJobs: resolved.completedJobs,
        isVerified: resolved.isVerified,
        isOnline: resolved.isOnline,
        completionRate: resolved.completionRate,
        avgResponseMin: resolved.avgResponseMin,
        profileImage: resolved.profileImage,
        user: resolved.user,
        reviews: resolved.reviews.map(r => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment,
          reviewerName: r.reviewer.name,
          createdAt: r.createdAt.toISOString(),
        })),
      })
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
      completionRate: tasker.completionRate,
      avgResponseMin: tasker.avgResponseMin,
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
