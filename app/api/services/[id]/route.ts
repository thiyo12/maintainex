import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth-utils'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const isSuper = session.role === 'SUPER_ADMIN'
    const canEdit = session.canEditServices === true

    if (!isSuper && !canEdit) {
      return NextResponse.json({ error: 'You do not have permission to delete services' }, { status: 403 })
    }

    const serviceId = params.id

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
    return NextResponse.json({ error: 'Failed to delete service', details: error.message }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const service = await prisma.service.findUnique({
      where: { id: params.id },
      include: { category: true }
    })

    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 })
    }

    return NextResponse.json({
      ...service,
      price: service.price ? Number(service.price) : null,
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch service' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const isSuper = session.role === 'SUPER_ADMIN'
    const canEdit = session.canEditServices === true

    if (!isSuper && !canEdit) {
      return NextResponse.json({ error: 'You do not have permission to update services' }, { status: 403 })
    }

    const body = await request.json()
    const { name, description, image, price, duration, categoryId, isActive } = body

    const service = await prisma.service.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(image !== undefined && { image }),
        ...(price !== undefined && { price: parseFloat(price) || 0 }),
        ...(duration !== undefined && { duration: parseInt(duration) || 0 }),
        ...(categoryId && { categoryId }),
        ...(isActive !== undefined && { isActive })
      },
      include: { category: true }
    })

    return NextResponse.json({
      ...service,
      price: service.price ? Number(service.price) : null,
    })
  } catch (error: any) {
    console.error('Update service error:', error)
    return NextResponse.json({ error: 'Failed to update service', details: error.message }, { status: 500 })
  }
}
