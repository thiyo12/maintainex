import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth-utils'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const canEdit = session.role === 'SUPER_ADMIN' || session.canEditServices

    if (!canEdit) {
      return NextResponse.json({ error: 'Only Super Admin or authorized admins can delete services' }, { status: 403 })
    }

    const serviceId = id

    const service = await prisma.service.findUnique({
      where: { id: serviceId }
    })

    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }

    await prisma.service.delete({
      where: { id: serviceId }
    })

    return NextResponse.json({ success: true, message: 'Service deleted successfully' })
  } catch (error: any) {
    console.error('Delete service error:', error)
    return NextResponse.json({ error: 'Failed to delete service' }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const service = await prisma.service.findFirst({
      where: {
        OR: [
          { id },
          { slug: id },
        ]
      },
      include: { category: true }
    })

    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }

    await prisma.service.update({
      where: { id: service.id },
      data: { views: { increment: 1 } }
    })

    // Fetch related services
    const relatedServices = await prisma.service.findMany({
      where: {
        categoryId: service.categoryId,
        id: { not: service.id },
        isActive: true,
      },
      take: 4,
      orderBy: { views: 'desc' },
      include: { category: { select: { name: true } } }
    })

    return NextResponse.json({
      ...service,
      price: service.price ? Number(service.price) : null,
      relatedServices,
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch service' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getSession(request)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized', reason: 'No session' }, { status: 401 })
    }
    
    const canEdit = session.role === 'SUPER_ADMIN' || session.canEditServices

    if (!canEdit) {
      return NextResponse.json({ error: 'Only Super Admin or authorized admins can update services' }, { status: 403 })
    }

    const body = await request.json()
    const { name, description, shortDescription, image, price, duration, categoryId, isActive, isTrending, displayOrder, features } = body

    const service = await prisma.service.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(shortDescription !== undefined && { shortDescription }),
        ...(image !== undefined && { image }),
        ...(price !== undefined && { price: parseFloat(price) || 0 }),
        ...(duration !== undefined && { duration: parseInt(duration) || 0 }),
        ...(categoryId && { categoryId }),
        ...(isActive !== undefined && { isActive }),
        ...(isTrending !== undefined && { isTrending }),
        ...(displayOrder !== undefined && { displayOrder: parseInt(displayOrder) || 0 }),
        ...(features !== undefined && { features })
      },
      include: { category: true }
    })

    return NextResponse.json({
      ...service,
      price: service.price ? Number(service.price) : null,
    })
  } catch (error: any) {
    console.error('Update service error:', error)
    return NextResponse.json({ error: 'Failed to update service' }, { status: 500 })
  }
}