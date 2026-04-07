import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/activity-log'

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

    return NextResponse.json(service)
  } catch (error) {
    console.error('Error fetching service:', error)
    return NextResponse.json({ error: 'Failed to fetch service' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { title, description, image, price, categoryId, isActive } = body

    const service = await prisma.service.update({
      where: { id: params.id },
      data: {
        title,
        description,
        image,
        price: price ? parseFloat(price) : null,
        categoryId,
        isActive
      },
      include: { category: true }
    })

    await logActivity({
      adminId: (session.user as any).id,
      adminEmail: session.user!.email!,
      adminName: session.user!.name,
      action: 'UPDATE',
      entityType: 'SERVICE',
      entityId: service.id,
      description: `Updated service "${title}"`,
      details: { title, isActive }
    })

    return NextResponse.json(service)
  } catch (error) {
    console.error('Error updating service:', error)
    return NextResponse.json({ error: 'Failed to update service' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const service = await prisma.service.findUnique({
      where: { id: params.id }
    })

    await prisma.service.delete({
      where: { id: params.id }
    })

    await logActivity({
      adminId: (session.user as any).id,
      adminEmail: session.user!.email!,
      adminName: session.user!.name,
      action: 'DELETE',
      entityType: 'SERVICE',
      entityId: params.id,
      description: `Deleted service "${service?.title}"`,
      details: { title: service?.title }
    })

    return NextResponse.json({ message: 'Service deleted successfully' })
  } catch (error) {
    console.error('Error deleting service:', error)
    return NextResponse.json({ error: 'Failed to delete service' }, { status: 500 })
  }
}
