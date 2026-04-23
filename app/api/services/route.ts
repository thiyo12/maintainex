import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth-utils'

function serializeService(service: any) {
  return {
    ...service,
    price: service.price ? Number(service.price) : null,
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const categorySlug = searchParams.get('category')
    const includeReviews = searchParams.get('reviews') === 'true'
    const includeAll = searchParams.get('all') === 'true'

    // Test simple query first
    const testCount = await prisma.service.count()
    console.log('Service count:', testCount)

    // Public API: only active services
    // Admin API (all=true): include all services
    const where: any = includeAll ? {} : { isActive: true }
    if (categorySlug) {
      where.category = { slug: categorySlug }
    }

    const services = await prisma.service.findMany({
      where,
      include: { 
        category: true,
        reviews: includeReviews ? {
          where: { status: 'APPROVED' }
        } : false
      },
      orderBy: [
        { category: { displayOrder: 'asc' } },
        { displayOrder: 'asc' }
      ]
    })

    const serializedServices = services.map(serializeService)

    return NextResponse.json(serializedServices, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error) {
    console.error('Services fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch services' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const isSuper = session.role === 'SUPER_ADMIN'
    const canEdit = session.canEditServices === true

    const body = await request.json()
    const { type } = body

    if (type === 'category') {
      if (!isSuper) {
        return NextResponse.json({ error: 'Only Super Admin can manage categories' }, { status: 403 })
      }

      if (!body.name || body.name.trim().length < 2) {
        return NextResponse.json({ error: 'Category name must be at least 2 characters' }, { status: 400 })
      }

      const category = await prisma.category.create({
        data: {
          name: body.name,
          slug: body.slug?.toLowerCase().replace(/\s+/g, '-') || body.name.toLowerCase().replace(/\s+/g, '-'),
          icon: body.icon || null,
          image: body.image || null,
          isActive: body.isActive ?? true
        }
      })
      return NextResponse.json(category, { status: 201 })
    }

    if (type === 'service') {
      if (!isSuper && !canEdit) {
        return NextResponse.json({ error: 'You do not have permission to add services' }, { status: 403 })
      }

      if (!body.name || body.name.trim().length < 2) {
        return NextResponse.json({ error: 'Service name must be at least 2 characters' }, { status: 400 })
      }

      if (!body.categoryId) {
        return NextResponse.json({ error: 'Category is required' }, { status: 400 })
      }

      if (body.price && (isNaN(parseFloat(body.price)) || parseFloat(body.price) < 0)) {
        return NextResponse.json({ error: 'Price must be a positive number' }, { status: 400 })
      }

      if (body.duration && (isNaN(parseInt(body.duration)) || parseInt(body.duration) < 0)) {
        return NextResponse.json({ error: 'Duration must be a positive number' }, { status: 400 })
      }
      
      const service = await prisma.service.create({
        data: {
          name: body.name,
          description: body.description || '',
          shortDescription: body.shortDescription || body.description || null,
          image: body.image || null,
          price: body.price ? parseFloat(body.price) : 0,
          duration: body.duration ? parseInt(body.duration) : 0,
          categoryId: body.categoryId,
          displayOrder: body.displayOrder ? parseInt(body.displayOrder) : 0,
          features: body.features || [],
          isActive: body.isActive ?? true
        },
        include: { category: true }
      })

      return NextResponse.json(serializeService(service), { status: 201 })
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  } catch {
    return NextResponse.json({ error: 'Failed to create resource' }, { status: 500 })
  }
}
