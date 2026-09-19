import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'
import { safeParseJsonArr } from '@/lib/db-utils'

function computeTier(completedJobs: number, totalSpent: number): string {
  if (completedJobs >= 25 || totalSpent >= 150000) return 'ELITE'
  if (completedJobs >= 10 || totalSpent >= 50000) return 'PREMIUM'
  if (completedJobs >= 3) return 'REGULAR'
  return 'EXPLORER'
}

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true, name: true, phone: true, phoneVerified: true, role: true, isActive: true, createdAt: true, lastNameChangedAt: true, identityStatus: true, nickname: true },
    })
    if (!fullUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    let extra = {}
    let needsOnboarding = false
    let tierLevel = 'EXPLORER'
    let completedJobs = 0
    let totalSpent = 0
    if (fullUser.role === 'TASKER') {
      const profile = await prisma.taskerProfile.findUnique({
        where: { userId: user.id },
        select: { skills: true, dateOfBirth: true, address: true, bio: true, experienceSummary: true },
      })
      needsOnboarding = !profile || safeParseJsonArr(profile.skills).length === 0
      const identity = (fullUser.identityStatus || 'NOT_SUBMITTED').toUpperCase()
      const identityReady = identity === 'VERIFIED' || identity === 'APPROVED'
      const taskerOnboardingStage = needsOnboarding
        ? 'SERVICES'
        : identityReady
          ? 'READY'
          : (identity === 'NOT_SUBMITTED' || identity === 'REJECTED')
            ? 'IDENTITY'
            : 'PENDING_APPROVAL'
      extra = {
        taskerOnboardingStage,
        taskerDateOfBirth: profile?.dateOfBirth ? profile.dateOfBirth.toISOString().split('T')[0] : null,
        taskerAddress: profile?.address || null,
        taskerExperienceSummary: profile?.experienceSummary || profile?.bio || null,
      }
    } else if (fullUser.role === 'COMPANY') {
      const profile = await prisma.companyProfile.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })
      needsOnboarding = !profile
    } else if (fullUser.role === 'CUSTOMER') {
      const agg = await prisma.marketplaceJob.aggregate({
        where: { customerId: user.id, status: 'COMPLETED' },
        _count: true,
        _sum: { budgetAmount: true },
      })
      completedJobs = agg._count || 0
      totalSpent = Number(agg._sum.budgetAmount || 0)
      tierLevel = computeTier(completedJobs, totalSpent)

      const customerProfile = await prisma.customerProfile.findUnique({
        where: { userId: user.id },
        select: { profileImage: true, birthday: true, gender: true, language: true, emergencyContact: true },
      })
      if (customerProfile) {
        extra = {
          profileImage: customerProfile.profileImage,
          birthday: customerProfile.birthday ? customerProfile.birthday.toISOString().split('T')[0] : null,
          gender: customerProfile.gender,
          language: customerProfile.language,
          emergencyContact: customerProfile.emergencyContact,
        }
      }
    }

    return NextResponse.json({
      user: { ...fullUser, tierLevel, completedJobs, totalSpent, ...extra },
      needsOnboarding,
    })
  } catch (error) {
    console.error('Me error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (user.role !== 'CUSTOMER') {
      return NextResponse.json({ error: 'Only customer accounts can be deleted from the mobile app' }, { status: 403 })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { isActive: false },
    })
    await prisma.userSession.deleteMany({ where: { userId: user.id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete account error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}