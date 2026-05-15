import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getProvinceFromDistrict } from '@/lib/provinces'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const categoryId = searchParams.get('categoryId')
    const district = searchParams.get('district')
    const minRating = searchParams.get('minRating')
    const minRate = searchParams.get('minRate')
    const maxRate = searchParams.get('maxRate')
    const isAvailable = searchParams.get('isAvailable')

    const where: Record<string, unknown> = {}

    if (isAvailable === 'true') where.isAvailable = true
    if (minRating) where.overallRating = { gte: parseFloat(minRating) }
    if (minRate) where.hourlyRate = { ...(where.hourlyRate as object), gte: parseFloat(minRate) }
    if (maxRate) where.hourlyRate = { ...(where.hourlyRate as object), lte: parseFloat(maxRate) }

    const skip = (page - 1) * limit

    const taskers = await prisma.taskerProfile.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            avatarUrl: true,
            role: true,
          }
        },
        skills: {
          include: {
            category: {
              select: { id: true, name: true, slug: true, icon: true },
            }
          }
        },
      },
      orderBy: [
        { overallRating: 'desc' },
        { totalTasksCompleted: 'desc' },
      ],
      skip,
      take: limit,
    })

    const filtered = taskers.filter(tasker => {
      if (categoryId && tasker.skills) {
        return tasker.skills.some(s => s.categoryId === categoryId)
      }
      if (district) {
        if (tasker.primaryDistrict === district) return true
        if (tasker.serviceDistricts) {
          try {
            const districts = JSON.parse(tasker.serviceDistricts) as string[]
            if (districts.includes(district)) return true
          } catch {}
        }
        if (tasker.primaryDistrict) {
          const taskerProvince = getProvinceFromDistrict(tasker.primaryDistrict)
          const customerProvince = getProvinceFromDistrict(district)
          if (taskerProvince === customerProvince) return true
        }
        return false
      }
      return true
    })

    const total = await prisma.taskerProfile.count({ where })

    return NextResponse.json({
      success: true,
      data: filtered,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      }
    })
  } catch (error) {
    console.error('Taskers fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch taskers' }, { status: 500 })
  }
}
