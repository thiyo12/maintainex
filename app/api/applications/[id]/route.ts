import { NextRequest, NextResponse } from 'next/server'
import { guardCrmRequest } from '@/lib/crm/security'
import { prisma } from '@/lib/prisma'
import { resolveReportBranchScope } from '@/lib/reports/branch-scope'
import { logActivity } from '@/lib/activity-log'

async function authorizeApplication(
  request: NextRequest,
  applicationId: string,
  permission: 'users:view' | 'users:edit',
  level: 'read' | 'mutation' | 'sensitive',
) {
  const guard = await guardCrmRequest(request, {
    permission,
    level,
    requireCountryScope: true,
  })
  if (!guard.ok) return { ok: false as const, response: guard.response }

  const application = await prisma.application.findUnique({ where: { id: applicationId } })
  if (!application) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Application not found' }, { status: 404 }),
    }
  }

  if (!guard.context.isSuperAdmin) {
    if (!application.branchId) {
      return {
        ok: false as const,
        response: NextResponse.json({ error: 'Application is outside your assigned countries' }, { status: 403 }),
      }
    }
    const scope = await resolveReportBranchScope(guard.context, application.branchId)
    if (!scope.ok) {
      return {
        ok: false as const,
        response: NextResponse.json({ error: scope.error }, { status: scope.status }),
      }
    }
  }

  return { ok: true as const, guard: guard.context, application }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const access = await authorizeApplication(request, id, 'users:view', 'read')
    if (!access.ok) return access.response
    return NextResponse.json(access.application)
  } catch (error) {
    console.error('Error fetching application:', error)
    return NextResponse.json({ error: 'Failed to fetch application' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const access = await authorizeApplication(request, id, 'users:edit', 'mutation')
    if (!access.ok) return access.response

    const body = await request.json()
    const { status } = body
    if (!status || !['NEW', 'REVIEWED', 'INTERVIEW', 'REJECTED', 'HIRED'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const application = await prisma.application.update({
      where: { id },
      data: { status },
    })

    await logActivity({
      adminId: access.guard.adminId,
      adminEmail: access.guard.email,
      adminName: access.guard.email,
      branchId: application.branchId,
      action: 'STATUS_CHANGE',
      entityType: 'APPLICATION',
      entityId: application.id,
      description: `Updated application status to ${status}`,
      details: { applicantName: application.name, service: application.service, newStatus: status },
    })

    return NextResponse.json(application)
  } catch (error) {
    console.error('Error updating application:', error)
    return NextResponse.json({ error: 'Failed to update application' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const access = await authorizeApplication(request, id, 'users:edit', 'sensitive')
    if (!access.ok) return access.response

    await prisma.application.delete({ where: { id } })

    await logActivity({
      adminId: access.guard.adminId,
      adminEmail: access.guard.email,
      adminName: access.guard.email,
      branchId: access.application.branchId,
      action: 'DELETE',
      entityType: 'APPLICATION',
      entityId: id,
      description: `Deleted application from ${access.application.name}`,
      details: { applicantName: access.application.name, service: access.application.service },
    })

    return NextResponse.json({ message: 'Application deleted successfully' })
  } catch (error) {
    console.error('Error deleting application:', error)
    return NextResponse.json({ error: 'Failed to delete application' }, { status: 500 })
  }
}
