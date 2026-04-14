import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth-utils'

function serializeService(service: any) {
  return {
    ...service,
    price: service.price ? Number(service.price) : null,
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const service = await prisma.service.findUnique({
      where: { id },
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
    console.log('Service PUT called')
    console.log('Headers:', Object.fromEntries(request.headers.entries()))
    
    const session = await getSession(request)
    console.log('Session:', session)
    
    const isSuper = session?.role === 'SUPER_ADMIN'
    const canEdit = session?.canEditServices === true
    console.log('Permissions - isSuper:', isSuper, 'canEdit:', canEdit)

    if (!isSuper && !canEdit) {
      return NextResponse.json({ error: 'You do not have permission to edit services' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { title, description, image, price, duration, categoryId, isActive } = body

    const updateData: any = {
      title,
      description,
      isActive
    }

    if (image !== undefined && image !== null && image !== '') {
      updateData.image = image
    }

    if (price !== undefined) {
      updateData.price = price ? parseFloat(price) : null
    }
    if (duration !== undefined) {
      updateData.duration = duration ? parseInt(duration) : null
    }
    if (categoryId !== undefined && isSuper) {
      updateData.categoryId = categoryId
    }

    const service = await prisma.service.update({
      where: { id },
      data: updateData,
      include: { category: true }
    })

    return NextResponse.json(serializeService(service))
  } catch {
    return NextResponse.json({ error: 'Failed to update service' }, { status: 500 })
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
