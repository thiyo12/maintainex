import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let profile = await prisma.companyProfile.findUnique({
      where: { userId: user.id },
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
      services: profile.services,
      serviceAreas: profile.serviceAreas,
      rating: profile.rating,
      completedProjects: profile.completedProjects,
      isVerified: profile.isVerified,
      logo: profile.logo,
      createdAt: profile.createdAt.toISOString(),
      teamMembers: profile.teamMembers.map(t => ({
        id: t.id,
        name: t.name,
        role: t.role,
        skills: t.skills,
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
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const profile = await prisma.companyProfile.upsert({
      where: { userId: user.id },
      update: {
        companyName: data.companyName ?? undefined,
        registrationNo: data.registrationNo ?? undefined,
        description: data.description ?? undefined,
        services: data.services ?? undefined,
        serviceAreas: data.serviceAreas ?? undefined,
        logo: data.logo ?? undefined,
      },
      create: {
        userId: user.id,
        companyName: data.companyName || 'My Company',
        services: data.services || [],
        serviceAreas: data.serviceAreas || [],
      },
    })

    return NextResponse.json({ success: true, profile: { id: profile.id, companyName: profile.companyName } })
  } catch (error) {
    console.error('Company profile update error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
