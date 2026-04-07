import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, isSuperAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logActivity } from '@/lib/activity-log'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const application = await prisma.application.findUnique({
      where: { id: params.id }
    })

    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    if (!isSuperAdmin(session) && application.branchId !== user.branchId) {
      return NextResponse.json({ error: 'Unauthorized - This application belongs to another branch' }, { status: 403 })
    }

    return NextResponse.json(application)
  } catch (error) {
    console.error('Error fetching application:', error)
    return NextResponse.json({ error: 'Failed to fetch application' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const existingApplication = await prisma.application.findUnique({
      where: { id: params.id }
    })

    if (!existingApplication) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    if (!isSuperAdmin(session) && existingApplication.branchId !== user.branchId) {
      return NextResponse.json({ error: 'Unauthorized - This application belongs to another branch' }, { status: 403 })
    }

    const body = await request.json()
    const { status } = body

    if (status && !['NEW', 'REVIEWED', 'INTERVIEW', 'REJECTED', 'HIRED'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const application = await prisma.application.update({
      where: { id: params.id },
      data: { status }
    })

    await logActivity({
      adminId: (session.user as any).id,
      adminEmail: session.user!.email!,
      adminName: session.user!.name,
      branchId: user.branchId,
      action: 'STATUS_CHANGE',
      entityType: 'APPLICATION',
      entityId: application.id,
      description: `Updated application status to ${status}`,
      details: { applicantName: application.name, position: application.position, newStatus: status }
    })

    return NextResponse.json(application)
  } catch (error) {
    console.error('Error updating application:', error)
    return NextResponse.json({ error: 'Failed to update application' }, { status: 500 })
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

    const user = session.user as any
    const application = await prisma.application.findUnique({
      where: { id: params.id }
    })

    if (!application) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    if (!isSuperAdmin(session) && application.branchId !== user.branchId) {
      return NextResponse.json({ error: 'Unauthorized - This application belongs to another branch' }, { status: 403 })
    }

    await prisma.application.delete({
      where: { id: params.id }
    })

    await logActivity({
      adminId: (session.user as any).id,
      adminEmail: session.user!.email!,
      adminName: session.user!.name,
      branchId: user.branchId,
      action: 'DELETE',
      entityType: 'APPLICATION',
      entityId: params.id,
      description: `Deleted application from ${application?.name}`,
      details: { applicantName: application?.name, position: application?.position }
    })

    return NextResponse.json({ message: 'Application deleted successfully' })
  } catch (error) {
    console.error('Error deleting application:', error)
    return NextResponse.json({ error: 'Failed to delete application' }, { status: 500 })
  }
}
