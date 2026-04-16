import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth-utils'

function serializeService(service: any) {
  return {
    ...service,
    price: service.price !== null && service.price !== undefined ? Number(service.price) : null,
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const includeRelated = searchParams.get('includeRelated') !== 'false'

    let service = await prisma.service.findUnique({
      where: { id },
      include: { 
        category: true,
        reviews: {
          where: { status: 'APPROVED' }
        }
      }
    })

    if (!service) {
      service = await prisma.service.findFirst({
        where: { 
          slug: id,
          isActive: true
        },
        include: { 
          category: true,
          reviews: {
            where: { status: 'APPROVED' }
          }
        }
      })
    }

    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }

    if (includeRelated && service.categoryId) {
      const relatedServices = await prisma.service.findMany({
        where: { 
          categoryId: service.categoryId,
          isActive: true,
          id: { not: service.id }
        },
        include: { category: true },
        take: 4,
        orderBy: { createdAt: 'desc' }
      })

      return NextResponse.json({
        ...serializeService(service),
        relatedServices: relatedServices.map(serializeService)
      })
    }

    return NextResponse.json(serializeService(service))
  } catch {
    return NextResponse.json({ error: 'Failed to fetch service' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('=== Service PUT called ===')
    
    const session = await getSession(request)
    console.log('Session:', session)
    
    const isSuper = session?.role === 'SUPER_ADMIN'
    const canEdit = session?.canEditServices === true

    if (!isSuper && !canEdit) {
      console.log('Permission denied - isSuper:', isSuper, 'canEdit:', canEdit)
      return NextResponse.json({ error: 'You do not have permission to edit services' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    console.log('Request body:', JSON.stringify(body, null, 2))
    
    const { name, title, slug, description, image, price, duration, categoryId, isActive } = body

    // Check if service exists first
    const existingService = await prisma.service.findUnique({
      where: { id }
    })
    
    if (!existingService) {
      console.log('Service not found:', id)
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }

    const updateData: any = {}

    if (name !== undefined) updateData.name = name
    else if (title !== undefined) updateData.name = title
    
    if (slug !== undefined && slug !== null && slug !== '') {
      updateData.slug = slug
    }
    
    if (description !== undefined) updateData.description = description
    if (isActive !== undefined) updateData.isActive = isActive

    if (image !== undefined && image !== null && image !== '') {
      updateData.image = image
    }

    if (price !== undefined && price !== null && price !== '') {
      updateData.price = parseFloat(String(price))
    } else if (price === '' || price === null) {
      updateData.price = null
    }

    if (duration !== undefined && duration !== null && duration !== '') {
      updateData.duration = parseInt(String(duration))
    } else if (duration === '' || duration === null) {
      updateData.duration = null
    }

    if (categoryId !== undefined && isSuper) {
      updateData.categoryId = categoryId
    }

    console.log('Updating service:', id)
    console.log('updateData:', JSON.stringify(updateData, null, 2))

    const service = await prisma.service.update({
      where: { id },
      data: updateData,
      include: { category: true }
    })

    console.log('Service updated successfully:', service.id)
    return NextResponse.json(serializeService(service))
  } catch (error: any) {
    console.error('Error updating service:', error)
    
    // Return more specific error message
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }
    
    return NextResponse.json({ error: 'Failed to update service: ' + (error.message || 'Unknown error') }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request)
    const isSuper = session?.role === 'SUPER_ADMIN'
    const canEdit = session?.canEditServices === true

    if (!isSuper && !canEdit) {
      return NextResponse.json({ error: 'You do not have permission to delete services' }, { status: 403 })
    }

    const { id } = await params
    await prisma.service.delete({
      where: { id }
    })

    return NextResponse.json({ message: 'Service deleted successfully' })
  } catch {
    return NextResponse.json({ error: 'Failed to delete service' }, { status: 500 })
  }
}
