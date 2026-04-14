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
    
    const { title, description, image, price, duration, categoryId, isActive } = body

    const updateData: any = {}

    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (isActive !== undefined) updateData.isActive = isActive

    if (image !== undefined && image !== null && image !== '') {
      updateData.image = image
      console.log('Updating image to:', image)
    }

    if (price !== undefined && price !== null && price !== '') {
      updateData.price = parseFloat(String(price))
      console.log('Updating price to:', updateData.price)
    } else if (price === '' || price === null) {
      updateData.price = null
      console.log('Setting price to null')
    }

    if (duration !== undefined && duration !== null && duration !== '') {
      updateData.duration = parseInt(String(duration))
      console.log('Updating duration to:', updateData.duration)
    } else if (duration === '' || duration === null) {
      updateData.duration = null
      console.log('Setting duration to null')
    }

    if (categoryId !== undefined && isSuper) {
      updateData.categoryId = categoryId
    }

    console.log('updateData:', JSON.stringify(updateData, null, 2))

    const service = await prisma.service.update({
      where: { id },
      data: updateData,
      include: { category: true }
    })

    console.log('Service updated successfully:', service.id)
    return NextResponse.json(serializeService(service))
  } catch (error) {
    console.error('Error updating service:', error)
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
