import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateMarketplaceUser } from '@/lib/auth/marketplace-auth'
import { assertNotSuspended } from '@/lib/mobile-auth'
import { resolveCompanyContext } from '@/lib/phase6/company-context'

function safeParseJson(val: string | null | undefined): string[] {
  if (!val) return []
  try {
    const parsed = JSON.parse(val)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return val ? val.split(',').map(s => s.trim()).filter(Boolean) : []
  }
}

async function resolveCompanyIdForUser(userId: string, requestedCompanyId?: string | null): Promise<string | null> {
  if (requestedCompanyId) return requestedCompanyId

  const owned = await prisma.companyProfile.findUnique({
    where: { userId },
    select: { id: true },
  })
  if (owned) return owned.id

  const membership = await prisma.teamMember.findFirst({
    where: { userId, status: 'ACTIVE' },
    orderBy: { joinedAt: 'asc' },
    select: { companyId: true },
  })
  return membership?.companyId || null
}

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateMarketplaceUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const requestedCompanyId = searchParams.get('companyId')
    const companyId = await resolveCompanyIdForUser(user.id, requestedCompanyId)

    if (!companyId) {
      return NextResponse.json({ error: 'Company profile not found', needsOnboarding: true }, { status: 404 })
    }

    const { context, error } = await resolveCompanyContext(user.id, companyId, 'company:read')
    if (error) return error

    const profile = await prisma.companyProfile.findUnique({
      where: { id: context!.companyId },
      include: {
        user: { select: { emailVerified: true } },
        teamMembers: true,
        specialties: true,
        contracts: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    })

    if (!profile) {
      return NextResponse.json({ error: 'Company profile not found' }, { status: 404 })
    }

    return NextResponse.json({
      id: profile.id,
      companyId: profile.id,
      userId: profile.userId,
      companyName: profile.companyName,
      registrationNo: profile.registrationNo,
      description: profile.description,
      services: safeParseJson(profile.services),
      serviceAreas: safeParseJson(profile.serviceAreas),
      specialties: profile.specialties,
      rating: profile.rating,
      completedProjects: profile.completedProjects,
      isVerified: profile.isVerified,
      verificationStatus: profile.verificationStatus,
      emailVerified: profile.user.emailVerified,
      logo: profile.logo,
      createdAt: profile.createdAt.toISOString(),
      teamMembers: profile.teamMembers.map(t => ({
        id: t.id,
        name: t.name,
        role: t.role,
        skills: safeParseJson(t.skills),
        isOnline: t.isOnline,
        rating: t.rating,
        completedJobs: t.completedJobs,
        joinedAt: t.joinedAt.toISOString(),
      })),
      recentContracts: profile.contracts.map(c => ({
        id: c.id,
        title: c.title,
        clientName: c.clientName,
        value: c.value,
        status: c.status,
        progress: c.progress,
      })),
    })
  } catch (error) {
    console.error('Company profile get error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateMarketplaceUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    if (user.role !== 'COMPANY') {
      return NextResponse.json({ error: 'Switch to or register as a Company provider first' }, { status: 403 })
    }

    const existing = await prisma.companyProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })
    if (existing) {
      return NextResponse.json({ error: 'Company profile already exists', companyId: existing.id }, { status: 409 })
    }

    const body = await request.json()
    const companyName = typeof body?.companyName === 'string' ? body.companyName.trim() : ''
    const registrationNo = typeof body?.registrationNo === 'string' ? body.registrationNo.trim() : ''
    const description = typeof body?.description === 'string' ? body.description.trim() : ''
    const serviceAreas = Array.isArray(body?.serviceAreas)
      ? body.serviceAreas.filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0)
      : []
    const rawServiceJobIds: unknown[] = Array.isArray(body?.serviceJobIds) ? body.serviceJobIds : []
    const serviceJobIds = [...new Set(rawServiceJobIds.filter((id): id is string => typeof id === 'string' && id.length > 0))]

    if (companyName.length < 2) {
      return NextResponse.json({ error: 'Company name is required' }, { status: 400 })
    }
    if (serviceJobIds.length === 0) {
      return NextResponse.json({ error: 'Select at least one service your company provides' }, { status: 400 })
    }
    if (serviceJobIds.length > 100) {
      return NextResponse.json({ error: 'Too many services selected' }, { status: 400 })
    }

    const selectedJobs = await prisma.templateJob.findMany({
      where: {
        id: { in: serviceJobIds },
        isActive: true,
      },
      select: {
        id: true,
        categoryId: true,
      },
    })
    if (selectedJobs.length !== serviceJobIds.length) {
      return NextResponse.json({ error: 'One or more selected services are unavailable' }, { status: 400 })
    }

    const categoryIds = [...new Set(selectedJobs.map(job => job.categoryId))]

    const profile = await prisma.$transaction(async (tx) => {
      const created = await tx.companyProfile.create({
        data: {
          userId: user.id,
          companyName,
          registrationNo: registrationNo || null,
          description: description || null,
          services: JSON.stringify(categoryIds),
          serviceAreas: JSON.stringify(serviceAreas),
          countryCode: user.countryCode || 'LK',
          verificationStatus: 'PENDING',
          isVerified: false,
        },
      })

      await tx.teamMember.create({
        data: {
          companyId: created.id,
          userId: user.id,
          name: user.name || companyName,
          role: 'COMPANY_OWNER',
          status: 'ACTIVE',
          skills: '[]',
        },
      })

      for (const job of selectedJobs) {
        await tx.companySpecialty.create({
          data: {
            companyId: created.id,
            categoryId: job.categoryId,
            jobId: job.id,
          },
        })
      }

      await tx.companyAuditLog.create({
        data: {
          companyId: created.id,
          actorId: user.id,
          actorRole: 'COMPANY_OWNER',
          action: 'COMPANY_CREATE',
          targetType: 'CompanyProfile',
          targetId: created.id,
          description: 'Company profile created from mobile onboarding',
          metadata: JSON.stringify({ serviceCount: serviceJobIds.length }),
        },
      })

      return created
    })

    return NextResponse.json({
      success: true,
      companyId: profile.id,
      profile: {
        id: profile.id,
        companyName: profile.companyName,
        verificationStatus: profile.verificationStatus,
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Company profile create error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await authenticateMarketplaceUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const body = await request.json()
    const requestedCompanyId = typeof body?.companyId === 'string' ? body.companyId : null
    const companyId = await resolveCompanyIdForUser(user.id, requestedCompanyId)

    if (!companyId) {
      return NextResponse.json({ error: 'Company profile not found' }, { status: 404 })
    }

    const { companyId: _discard, ...data } = body
    const { context, error } = await resolveCompanyContext(user.id, companyId, 'company:update')
    if (error) return error

    const profile = await prisma.companyProfile.update({
      where: { id: context!.companyId },
      data: {
        companyName: data.companyName ?? undefined,
        registrationNo: data.registrationNo ?? undefined,
        description: data.description ?? undefined,
        services: data.services ? JSON.stringify(data.services) : undefined,
        serviceAreas: data.serviceAreas ? JSON.stringify(data.serviceAreas) : undefined,
        logo: data.logo ?? undefined,
      },
    })

    return NextResponse.json({
      success: true,
      companyId: profile.id,
      profile: { id: profile.id, companyName: profile.companyName },
    })
  } catch (error) {
    console.error('Company profile update error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
