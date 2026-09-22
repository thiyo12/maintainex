import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'
import { safeParseJsonArr } from '@/lib/db-utils'

// Get own tasker profile (resolved via authenticated user)
export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user || user.role !== 'TASKER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const tasker = await prisma.taskerProfile.findUnique({
      where: { userId: user.id },
      include: { user: { select: { id: true, name: true, phone: true, email: true, nickname: true, identityStatus: true } } },
    })
    if (!tasker) {
      return NextResponse.json({ error: 'Tasker profile not found' }, { status: 404 })
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
    })
  } catch (error) {
    console.error('Tasker profile get error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user || user.role !== 'TASKER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    // Older/seeded TASKER users may predate the TaskerProfile row.
    // Self-heal only the authenticated user's own provider profile.
    const tasker = await prisma.taskerProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, countryCode: user.countryCode || 'LK' },
    })

    const { bio, hourlyRate, skills, serviceAreas, profileImage, name, phone, nickname } = await request.json()
    const updateData: any = {}
    if (bio !== undefined) updateData.bio = bio
    if (hourlyRate !== undefined) updateData.hourlyRate = parseFloat(hourlyRate)
    if (skills !== undefined) updateData.skills = JSON.stringify(skills)
    if (serviceAreas !== undefined) updateData.serviceAreas = JSON.stringify(serviceAreas)
    if (profileImage !== undefined) updateData.profileImage = profileImage

    const userUpdate: any = {}
    if (phone !== undefined) userUpdate.phone = phone
    if (nickname !== undefined) userUpdate.nickname = nickname?.trim() || null

    if (name !== undefined) {
      if (user.identityStatus === 'VERIFIED' && name.trim() !== user.name) {
        return NextResponse.json({ error: 'Name is locked after identity verification. Use your verified name.' }, { status: 400 })
      }
      userUpdate.name = name
    }

    if (Object.keys(userUpdate).length > 0) {
      await prisma.user.update({ where: { id: user.id }, data: userUpdate })
    }

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
