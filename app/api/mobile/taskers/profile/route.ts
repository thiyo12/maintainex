import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'
import { safeParseJsonArr } from '@/lib/db-utils'

export async function PUT(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user || user.role !== 'TASKER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tasker = await prisma.taskerProfile.findUnique({ where: { userId: user.id } })
    if (!tasker) {
      return NextResponse.json({ error: 'Tasker profile not found' }, { status: 404 })
    }

    const { bio, hourlyRate, skills, serviceAreas, profileImage } = await request.json()
    const updateData: any = {}
    if (bio !== undefined) updateData.bio = bio
    if (hourlyRate !== undefined) updateData.hourlyRate = parseFloat(hourlyRate)
    if (skills !== undefined) updateData.skills = JSON.stringify(skills)
    if (serviceAreas !== undefined) updateData.serviceAreas = JSON.stringify(serviceAreas)
    if (profileImage !== undefined) updateData.profileImage = profileImage

    const updated = await prisma.taskerProfile.update({
      where: { userId: user.id },
      data: updateData,
      include: { user: { select: { id: true, name: true, email: true, phone: true } } },
    })

    return NextResponse.json({
      id: updated.id,
      userId: updated.userId,
      bio: updated.bio,
      hourlyRate: updated.hourlyRate,
      skills: safeParseJsonArr(updated.skills),
      serviceAreas: safeParseJsonArr(updated.serviceAreas),
      rating: updated.rating,
      completedJobs: updated.completedJobs,
      isVerified: updated.isVerified,
      isOnline: updated.isOnline,
      user: updated.user,
    })
  } catch (error) {
    console.error('Tasker profile update error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
