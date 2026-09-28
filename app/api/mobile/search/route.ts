import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest } from '@/lib/auth/compatibility/mobile-auth'
import { jsonArrayContains, safeParseJsonArr } from '@/lib/db-utils'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    const country = searchParams.get('country') || 'LK'

    if (!query.trim()) {
      return NextResponse.json({ categories: [], jobs: [], taskers: [], totalResults: 0 })
    }

    const [allCategories, allJobs, taskers] = await Promise.all([
      prisma.jobCategory.findMany({
        where: {
          isActive: true,
          name: { contains: query },
        },
        orderBy: { sortOrder: 'asc' },
        take: 5,
      }),
      prisma.templateJob.findMany({
        where: {
          isActive: true,
          OR: [
            { name: { contains: query } },
            { description: { contains: query } },
          ],
        },
        include: { category: true },
        take: 10,
        orderBy: [{ isPopular: 'desc' }, { name: 'asc' }],
      }),
      prisma.taskerProfile.findMany({
        where: {
          isVerified: true,
          user: { name: { contains: query } },
        },
        include: { user: { select: { id: true, name: true } } },
        take: 5,
        orderBy: { rating: 'desc' },
      }),
    ])

    const categories = allCategories.filter(c => jsonArrayContains(c.countries, country))
    const jobs = allJobs.filter(j => jsonArrayContains(j.countries, country))
    const totalResults = categories.length + jobs.length + taskers.length

    return NextResponse.json({
      categories: categories.map(c => ({
        id: c.id, name: c.name, iconName: c.iconName, colorHex: c.colorHex, sortOrder: c.sortOrder,
      })),
      jobs: jobs.map(j => ({
        id: j.id, name: j.name, description: j.description, priceMin: j.priceMin, priceMax: j.priceMax,
        typicalDurationMinutes: j.typicalDurationMinutes, isPopular: j.isPopular,
        category: { id: j.category.id, name: j.category.name, iconName: j.category.iconName, colorHex: j.category.colorHex },
      })),
      taskers: taskers.map(t => ({
        id: t.id, userId: t.userId, name: t.user.name, rating: t.rating,
        completedJobs: t.completedJobs, isVerified: t.isVerified, isOnline: t.isOnline,
        hourlyRate: t.hourlyRate,
      })),
      totalResults,
    })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
