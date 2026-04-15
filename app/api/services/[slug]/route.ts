import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function serializeService(service: any) {
  return {
    ...service,
    price: service.price !== null && service.price !== undefined ? Number(service.price) : null,
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const { searchParams } = new URL(request.url)
    const includeRelated = searchParams.get('includeRelated') !== 'false'

    const service = await prisma.service.findFirst({
      where: { 
        slug,
        isActive: true
      },
      include: { 
        category: true,
        reviews: {
          where: { status: 'APPROVED' }
        }
      }
    })

    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }

    // Get related services from the same category
    let relatedServices: any[] = []
    if (includeRelated && service.categoryId) {
      relatedServices = await prisma.service.findMany({
        where: { 
          categoryId: service.categoryId,
          isActive: true,
          id: { not: service.id }
        },
        include: { category: true },
        take: 4,
        orderBy: { createdAt: 'desc' }
      })
      relatedServices = relatedServices.map(serializeService)
    }

    return NextResponse.json({
      ...serializeService(service),
      relatedServices
    })
  } catch (error) {
    console.error('Error fetching service by slug:', error)
    return NextResponse.json({ error: 'Failed to fetch service' }, { status: 500 })
  }
}
