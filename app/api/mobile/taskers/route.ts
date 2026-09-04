import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/mobile-auth'
import { jsonArrayContains, safeParseJsonArr } from '@/lib/db-utils'

// List taskers (public-ish, requires auth)
export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const area = searchParams.get('area')
    const isOnline = searchParams.get('isOnline')

    const where: any = { isVerified: true }
    if (isOnline === 'true') where.isOnline = true

    let taskers = await prisma.taskerProfile.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, phone: true, email: true } },
      },
      orderBy: [{ rating: 'desc' }, { completedJobs: 'desc' }],
    })

    if (category) {
      const matchKeys = await resolveCategoryMatchKeys(category)
      if (matchKeys.length > 0) {
        taskers = taskers.filter(t => {
          const skills = safeParseJsonArr(t.skills)
          return skills.some(s => matchKeys.includes(s))
        })
      }
    }
    if (area) {
      taskers = taskers.filter(t => jsonArrayContains(t.serviceAreas, area))
    }

    return NextResponse.json(
      taskers.map(t => ({
        id: t.id,
        userId: t.userId,
        bio: t.bio,
        hourlyRate: t.hourlyRate,
        skills: safeParseJsonArr(t.skills),
        serviceAreas: safeParseJsonArr(t.serviceAreas),
        rating: t.rating,
        completedJobs: t.completedJobs,
        isVerified: t.isVerified,
        isOnline: t.isOnline,
        latitude: t.latitude,
        longitude: t.longitude,
        locationUpdatedAt: t.locationUpdatedAt?.toISOString(),
        user: t.user,
      }))
    )
  } catch (error) {
    console.error('Taskers list error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

async function resolveCategoryMatchKeys(category: string): Promise<string[]> {
  const keys = new Set<string>([category])

  const jobCat = await prisma.jobCategory.findFirst({
    where: { OR: [{ id: category }, { slug: category }] },
  })

  if (jobCat) {
    keys.add(jobCat.id)
    if (jobCat.slug) keys.add(jobCat.slug)
    // Include any legacy Category slug that relates to this JobCategory so
    // previously-onboarded taskers (stored with legacy slugs) still match.
    const legacy = await prisma.category.findMany({ where: { isActive: true }, select: { name: true, slug: true } })
    for (const c of legacy) {
      if (
        c.name.toLowerCase().includes(jobCat.name.toLowerCase()) ||
        jobCat.name.toLowerCase().includes(c.name.toLowerCase())
      ) {
        keys.add(c.slug)
      }
    }
    return [...keys]
  }

  // Not a JobCategory — treat as a legacy Category id/slug.
  const legacyCat = await prisma.category.findFirst({
    where: { OR: [{ id: category }, { slug: category }] },
    select: { name: true, slug: true },
  })
  if (legacyCat) {
    if (legacyCat.slug) keys.add(legacyCat.slug)
    // Map back to the JobCategory namespace where possible.
    const jobCatByName = await prisma.jobCategory.findMany({ select: { id: true, name: true, slug: true } })
    for (const jc of jobCatByName) {
      if (
        legacyCat.name.toLowerCase().includes(jc.name.toLowerCase()) ||
        jc.name.toLowerCase().includes(legacyCat.name.toLowerCase())
      ) {
        keys.add(jc.id)
        if (jc.slug) keys.add(jc.slug)
      }
    }
  }

  return [...keys]
}
