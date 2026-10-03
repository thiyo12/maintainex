import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/auth/compatibility/mobile-auth'
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
    const providerIdentity = await prisma.providerIdentity.findUnique({
      where: {
        identityType_subjectId: {
          identityType: 'TASKER',
          subjectId: tasker.id,
        },
      },
      select: {
        id: true,
        verifiedPhotoUrl: true,
        photoLocked: true,
        kycStatus: true,
      },
    })
    const pendingPhotoChange = providerIdentity
      ? await prisma.providerPhotoChangeRequest.findFirst({
          where: { providerIdentityId: providerIdentity.id, status: 'PENDING' },
          orderBy: { createdAt: 'desc' },
          select: { id: true, status: true, createdAt: true },
        })
      : null

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
      profileImage:
        tasker.user.identityStatus === 'VERIFIED' || tasker.user.identityStatus === 'APPROVED'
          ? providerIdentity?.verifiedPhotoUrl || null
          : tasker.profileImage,
      verifiedProfilePhoto: providerIdentity?.verifiedPhotoUrl || null,
      profilePhotoLocked:
        tasker.user.identityStatus === 'VERIFIED' ||
        tasker.user.identityStatus === 'APPROVED' ||
        providerIdentity?.photoLocked === true,
      pendingPhotoChange,
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

    const profileIdentity = await prisma.providerIdentity.findUnique({
      where: {
        identityType_subjectId: {
          identityType: 'TASKER',
          subjectId: tasker.id,
        },
      },
      select: { photoLocked: true, verifiedPhotoUrl: true },
    })

    const { bio, experienceSummary, dateOfBirth, address, hourlyRate, skills, serviceAreas, profileImage, name, phone, nickname } = await request.json()
    if (skills !== undefined) {
      return NextResponse.json(
        { error: 'Service skills must be updated through the validated job-selection endpoint.' },
        { status: 400 }
      )
    }

    const updateData: any = {}
    if (bio !== undefined) {
      if (bio !== null && typeof bio !== 'string') {
        return NextResponse.json({ error: 'bio must be text' }, { status: 400 })
      }
      updateData.bio = typeof bio === 'string' ? bio.trim().slice(0, 2000) : null
    }
    if (experienceSummary !== undefined) {
      if (experienceSummary !== null && typeof experienceSummary !== 'string') {
        return NextResponse.json({ error: 'experienceSummary must be text' }, { status: 400 })
      }
      updateData.experienceSummary = typeof experienceSummary === 'string'
        ? experienceSummary.trim().slice(0, 3000)
        : null
    }
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
    if (address !== undefined) {
      if (address !== null && typeof address !== 'string') {
        return NextResponse.json({ error: 'address must be text' }, { status: 400 })
      }
      updateData.address = typeof address === 'string' ? address.trim().slice(0, 500) : null
    }
    if (hourlyRate !== undefined) {
      const rate = Number(hourlyRate)
      if (!Number.isFinite(rate) || rate < 0) {
        return NextResponse.json({ error: 'hourlyRate must be a non-negative number' }, { status: 400 })
      }
      updateData.hourlyRate = rate
    }
    if (serviceAreas !== undefined) {
      if (!Array.isArray(serviceAreas) || serviceAreas.length > 100) {
        return NextResponse.json({ error: 'serviceAreas must be an array with at most 100 items' }, { status: 400 })
      }
      const normalizedAreas = serviceAreas
        .filter((value: unknown): value is string => typeof value === 'string')
        .map(value => value.trim().slice(0, 120))
        .filter(Boolean)
      if (normalizedAreas.length !== serviceAreas.length) {
        return NextResponse.json({ error: 'serviceAreas must contain non-empty text values' }, { status: 400 })
      }
      updateData.serviceAreas = JSON.stringify([...new Set(normalizedAreas)])
    }
    if (profileImage !== undefined) {
      if (profileImage !== null && typeof profileImage !== 'string') {
        return NextResponse.json({ error: 'profileImage must be a URL string' }, { status: 400 })
      }
      const normalizedProfileImage =
        typeof profileImage === 'string' ? profileImage.trim().slice(0, 2000) : null
      const verifiedIdentity =
        user.identityStatus === 'VERIFIED' || user.identityStatus === 'APPROVED'
      const photoLocked = verifiedIdentity || profileIdentity?.photoLocked === true

      if (photoLocked && normalizedProfileImage !== tasker.profileImage) {
        return NextResponse.json(
          {
            error: 'Verified profile photo changes require MaintainEX identity review.',
            code: 'VERIFIED_PHOTO_CHANGE_REQUIRES_REVIEW',
          },
          { status: 409 },
        )
      }

      if (!photoLocked) {
        updateData.profileImage = normalizedProfileImage
      }
    }

    const userUpdate: any = {}
    if (phone !== undefined && phone !== user.phone) {
      return NextResponse.json({ error: 'Mobile number changes require OTP verification.' }, { status: 400 })
    }
    if (nickname !== undefined) {
      if (nickname !== null && typeof nickname !== 'string') {
        return NextResponse.json({ error: 'nickname must be text' }, { status: 400 })
      }
      userUpdate.nickname = typeof nickname === 'string' ? nickname.trim().slice(0, 80) || null : null
    }

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return NextResponse.json({ error: 'name must be non-empty text' }, { status: 400 })
      }
      const normalizedName = name.trim().slice(0, 150)
      if (user.identityStatus === 'VERIFIED' && normalizedName !== user.name) {
        return NextResponse.json({ error: 'Name is locked after identity verification. Use your verified name.' }, { status: 400 })
      }
      userUpdate.name = normalizedName
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
      profileImage:
        user.identityStatus === 'VERIFIED' || user.identityStatus === 'APPROVED'
          ? profileIdentity?.verifiedPhotoUrl || null
          : updated.profileImage,
      profilePhotoLocked:
        user.identityStatus === 'VERIFIED' ||
        user.identityStatus === 'APPROVED' ||
        profileIdentity?.photoLocked === true,
      user: updated.user,
    })
  } catch (error) {
    console.error('Tasker profile update error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
