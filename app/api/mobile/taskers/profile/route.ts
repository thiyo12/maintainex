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
    const tasker = await prisma.taskerProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        countryCode: user.countryCode || 'LK',
        verificationStatus: 'PENDING',
        isVerified: false,
        isOnline: false,
        skills: '[]',
      },
      include: {
        user: { select: { id: true, name: true, phone: true, email: true, nickname: true, identityStatus: true } },
        reviews: {
          orderBy: { createdAt: 'desc' },
          take: 3,
          include: { reviewer: { select: { name: true } } },
        },
        taskerSkills: { select: { experienceYears: true } },
      },
    })
    return NextResponse.json({
      id: tasker.id,
      userId: tasker.userId,
      bio: tasker.bio,
      experienceSummary: tasker.experienceSummary,
      dateOfBirth: tasker.dateOfBirth ? tasker.dateOfBirth.toISOString().split('T')[0] : null,
      address: tasker.address,
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
      completionRate: tasker.completionRate,
      avgResponseMin: tasker.avgResponseMin,
      experienceYears: tasker.taskerSkills.reduce((max, skill) => Math.max(max, skill.experienceYears), 0),
      reviews: tasker.reviews.map((review) => ({
        id: review.id,
        reviewerName: review.reviewer.name,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt.toISOString(),
      })),
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

    const tasker = await prisma.taskerProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        countryCode: user.countryCode || 'LK',
        verificationStatus: 'PENDING',
        isVerified: false,
        isOnline: false,
        skills: '[]',
      },
    })

    const { bio, experienceSummary, dateOfBirth, address, hourlyRate, skills, serviceAreas, profileImage, name, phone, nickname } = await request.json()
    const updateData: any = {}
    if (bio !== undefined) updateData.bio = bio
    if (experienceSummary !== undefined) updateData.experienceSummary = typeof experienceSummary === 'string' ? experienceSummary.trim() : null
    if (dateOfBirth !== undefined) {
      if (!dateOfBirth) {
        updateData.dateOfBirth = null
      } else {
        const rawDate = String(dateOfBirth).trim()
        if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
          return NextResponse.json({ error: 'Date of birth must use YYYY-MM-DD' }, { status: 400 })
        }
        const parsedDate = new Date(`${rawDate}T00:00:00.000Z`)
        if (Number.isNaN(parsedDate.getTime()) || parsedDate >= new Date()) {
          return NextResponse.json({ error: 'Enter a valid date of birth' }, { status: 400 })
        }
        updateData.dateOfBirth = parsedDate
      }
    }
    if (address !== undefined) updateData.address = typeof address === 'string' ? address.trim() : null
    if (hourlyRate !== undefined) updateData.hourlyRate = parseFloat(hourlyRate)
    if (skills !== undefined) updateData.skills = JSON.stringify(skills)
    if (serviceAreas !== undefined) updateData.serviceAreas = JSON.stringify(serviceAreas)
    if (profileImage !== undefined) updateData.profileImage = profileImage

    const userUpdate: any = {}
    if (phone !== undefined && phone !== user.phone) {
      return NextResponse.json({ error: 'Mobile number changes require OTP verification.' }, { status: 400 })
    }
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
      experienceSummary: updated.experienceSummary,
      dateOfBirth: updated.dateOfBirth ? updated.dateOfBirth.toISOString().split('T')[0] : null,
      address: updated.address,
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
