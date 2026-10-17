import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateMarketplaceUser } from '@/lib/auth/marketplace-auth'
import { assertNotSuspended } from '@/lib/auth/compatibility/mobile-auth'
import { resolveCompanyContext } from '@/lib/phase6/company-context'
import { normalizeCompanyServiceAreas, normalizeCompanyServices } from '@/lib/phase6/company-profile-market'

function safeParseJson(val: string | null | undefined): string[] {
  if (!val) return []
  try {
    const parsed = JSON.parse(val)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return val ? val.split(',').map(s => s.trim()).filter(Boolean) : []
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateMarketplaceUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')

    const { context, error } = await resolveCompanyContext(user.id, companyId, 'company:read')
    if (error) return error

    const profile = await prisma.companyProfile.findUnique({
      where: { id: context!.companyId },
      include: {
        teamMembers: true,
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
      userId: profile.userId,
      companyName: profile.companyName,
      registrationNo: profile.registrationNo,
      description: profile.description,
      services: safeParseJson(profile.services),
      serviceAreas: safeParseJson(profile.serviceAreas),
      rating: profile.rating,
      completedProjects: profile.completedProjects,
      isVerified: profile.isVerified,
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
    secureConsole.error('Company profile get error:', error)
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
    const { companyId: requestedCompanyId, ...data } = body
    let companyId = typeof requestedCompanyId === 'string' && requestedCompanyId.trim()
      ? requestedCompanyId.trim()
      : null

    // Registration/onboarding path: a COMPANY user does not have a companyId
    // until this first profile is created.
    if (!companyId) {
      const existingProfile = await prisma.companyProfile.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })

      if (!existingProfile) {
        if (user.role !== 'COMPANY') {
          return NextResponse.json({ error: 'Company account required' }, { status: 403 })
        }

        const companyName = typeof data.companyName === 'string' ? data.companyName.trim() : ''
        const market = (user.countryCode || 'LK').trim().toUpperCase()
        const checkedAreas = normalizeCompanyServiceAreas(market, data.serviceAreas ?? [])
        if (!checkedAreas.ok) {
          return NextResponse.json({ error: checkedAreas.error }, { status: 400 })
        }
        const checkedServices = normalizeCompanyServices(data.services)
        if (!checkedServices.ok) {
          return NextResponse.json({ error: checkedServices.error }, { status: 400 })
        }
        const services = checkedServices.services
        const serviceAreas = checkedAreas.areas

        if (!companyName) {
          return NextResponse.json({ error: 'Company name is required' }, { status: 400 })
        }
        if (services.length === 0) {
          return NextResponse.json({ error: 'Select at least one service' }, { status: 400 })
        }

        const created = await prisma.$transaction(async (tx) => {
          const profile = await tx.companyProfile.create({
            data: {
              userId: user.id,
              companyName,
              registrationNo: data.registrationNo || null,
              description: data.description || null,
              services: JSON.stringify(services),
              serviceAreas: JSON.stringify(serviceAreas),
              countryCode: market,
            },
          })

          await tx.teamMember.create({
            data: {
              companyId: profile.id,
              userId: user.id,
              name: user.name,
              role: 'COMPANY_OWNER',
              skills: '[]',
              status: 'ACTIVE',
            },
          })

          return profile
        })

        return NextResponse.json({
          success: true,
          created: true,
          profile: { id: created.id, companyName: created.companyName },
        }, { status: 201 })
      }

      companyId = existingProfile.id

      // Repair legacy company profiles that predate the owner-membership model.
      const membership = await prisma.teamMember.findFirst({
        where: { companyId, userId: user.id },
        select: { id: true, role: true, status: true },
      })
      if (!membership && user.role === 'COMPANY') {
        await prisma.teamMember.create({
          data: {
            companyId,
            userId: user.id,
            name: user.name,
            role: 'COMPANY_OWNER',
            skills: '[]',
            status: 'ACTIVE',
          },
        })
      }
      // Existing memberships are authoritative. Never restore SUSPENDED or
      // REMOVED access (or promote a demoted member) through profile editing.
      // Those changes must go through the authorized workforce flow.
    }

    const { context, error } = await resolveCompanyContext(user.id, companyId, 'company:update')
    if (error) return error

    // Only mutate declarations in the company's persisted account market.
    // Client-supplied country codes, including edits from a stale mobile
    // session, cannot change a company's service territory.
    const company = await prisma.companyProfile.findUnique({
      where: { id: context!.companyId },
      select: { countryCode: true },
    })
    if (!company) {
      return NextResponse.json({ error: 'Company profile not found' }, { status: 404 })
    }
    const accountMarket = (user.countryCode || 'LK').trim().toUpperCase()
    const market = (company.countryCode || '').trim().toUpperCase()
    if (market !== accountMarket) {
      return NextResponse.json({ error: 'Company and account markets do not match' }, { status: 403 })
    }
    const checkedAreas = data.serviceAreas === undefined
      ? null : normalizeCompanyServiceAreas(market, data.serviceAreas)
    if (checkedAreas && !checkedAreas.ok) {
      return NextResponse.json({ error: checkedAreas.error }, { status: 400 })
    }
    const checkedServices = data.services === undefined
      ? null : normalizeCompanyServices(data.services)
    if (checkedServices && !checkedServices.ok) {
      return NextResponse.json({ error: checkedServices.error }, { status: 400 })
    }

    const profile = await prisma.companyProfile.update({
      where: { id: context!.companyId },
      data: {
        companyName: data.companyName ?? undefined,
        registrationNo: data.registrationNo ?? undefined,
        description: data.description ?? undefined,
        services: checkedServices?.ok ? JSON.stringify(checkedServices.services) : undefined,
        serviceAreas: checkedAreas?.ok ? JSON.stringify(checkedAreas.areas) : undefined,
        logo: data.logo ?? undefined,
      },
    })

    return NextResponse.json({ success: true, profile: { id: profile.id, companyName: profile.companyName } })
  } catch (error) {
    secureConsole.error('Company profile update error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
