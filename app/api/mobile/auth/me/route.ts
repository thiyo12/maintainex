import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/auth/compatibility/mobile-auth'
import { safeParseJsonArr } from '@/lib/db-utils'
import { closeAccountPreservingProviderIntegrity } from '@/lib/identity/account-closure'

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

    const [taskerPresence, ownedCompany, companyMembership] = await Promise.all([
      prisma.taskerProfile.findUnique({ where: { userId: user.id }, select: { id: true } }),
      prisma.companyProfile.findUnique({ where: { userId: user.id }, select: { id: true } }),
      prisma.teamMember.findFirst({ where: { userId: user.id, status: 'ACTIVE' }, select: { companyId: true, role: true } }),
    ])
    const profileSet = new Set<string>(['CUSTOMER', fullUser.role])
    if (taskerPresence) profileSet.add('TASKER')
    if (ownedCompany || companyMembership) profileSet.add('COMPANY')

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
      needsOnboarding = !profile && !companyMembership
      extra = {
        activeCompany: companyMembership
          ? { companyId: companyMembership.companyId, role: companyMembership.role }
          : profile
            ? { companyId: profile.id, role: 'COMPANY_OWNER' }
            : null,
      }
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
      user: { ...fullUser, tierLevel, completedJobs, totalSpent, availableProfiles: Array.from(profileSet), ...extra },
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

    const result = await prisma.$transaction(tx =>
      closeAccountPreservingProviderIntegrity(tx, user.id)
    )

    return NextResponse.json({
      success: true,
      closedWithBalance: result.closesWithBalance,
      outstandingBalances: result.outstandingBalances.map(balance => ({
        providerIdentityId: balance.providerIdentityId,
        identityType: balance.identityType,
        currency: balance.currency,
        commissionDueMinor: balance.commissionDueMinor.toString(),
        status: balance.status,
      })),
      message: result.closesWithBalance
        ? 'Account access closed. Outstanding MaintainEX commission remains attached to the verified provider identity.'
        : 'Account closed.',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message === 'ACCOUNT_CLOSURE_BLOCKED') {
      const assessment = (error as Error & {
        assessment?: {
          blockers: string[]
          activeJobIds: string[]
          openDisputes: Array<{ id: string; jobId: string; status: string }>
          pendingPayouts: Array<{ id: string; status: string }>
        }
      }).assessment

      return NextResponse.json(
        {
          error: 'Resolve active jobs, disputes, and pending payouts before closing the account.',
          code: 'ACCOUNT_CLOSURE_BLOCKED',
          blockers: assessment?.blockers || [],
          activeJobCount: assessment?.activeJobIds.length || 0,
          openDisputeCount: assessment?.openDisputes.length || 0,
          pendingPayoutCount: assessment?.pendingPayouts.length || 0,
        },
        { status: 409 },
      )
    }
    if (message === 'USER_NOT_FOUND') {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    console.error('Delete account error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

