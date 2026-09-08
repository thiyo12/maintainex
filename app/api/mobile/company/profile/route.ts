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
    console.error('Company profile get error:', error)
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
    const { companyId, ...data } = body

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

    return NextResponse.json({ success: true, profile: { id: profile.id, companyName: profile.companyName } })
  } catch (error) {
    console.error('Company profile update error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
