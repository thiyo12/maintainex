import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateStaffRequest } from '@/lib/auth/staff-sessions'
import { ROLE_PERMISSIONS } from '@/lib/admin-types'
import { setServiceProfessionRequirement, setServiceSkillRequirement, getServiceRequirements } from '@/lib/profession'

// GET: List service requirements for a service template
export async function GET(request: NextRequest) {
  try {
    const principal = await authenticateStaffRequest(request)
    if (!principal) {
      return NextResponse.json({ error: 'Invalid or revoked staff session' }, { status: 401 })
    }

    const adminUser = await prisma.adminUser.findUnique({
      where: { id: principal.adminUserId },
      select: { id: true, role: true, isActive: true, deletedAt: true },
    })
    if (!adminUser || !adminUser.isActive || adminUser.deletedAt) {
      return NextResponse.json({ error: 'Invalid or revoked staff session' }, { status: 401 })
    }

    const permissions = ROLE_PERMISSIONS[adminUser.role as keyof typeof ROLE_PERMISSIONS]
    if (!permissions?.includes('professions:read')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const serviceTemplateId = searchParams.get('serviceTemplateId')
    if (!serviceTemplateId) {
      return NextResponse.json({ error: 'serviceTemplateId required' }, { status: 400 })
    }

    const requirements = await getServiceRequirements(prisma, serviceTemplateId)
    return NextResponse.json({ requirements })
  } catch (error) {
    console.error('Admin service requirements error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

// POST: Set a service profession requirement
export async function POST(request: NextRequest) {
  try {
    const principal = await authenticateStaffRequest(request)
    if (!principal) {
      return NextResponse.json({ error: 'Invalid or revoked staff session' }, { status: 401 })
    }

    const adminUser = await prisma.adminUser.findUnique({
      where: { id: principal.adminUserId },
      select: { id: true, role: true, isActive: true, deletedAt: true },
    })
    if (!adminUser || !adminUser.isActive || adminUser.deletedAt) {
      return NextResponse.json({ error: 'Invalid or revoked staff session' }, { status: 401 })
    }

    const permissions = ROLE_PERMISSIONS[adminUser.role as keyof typeof ROLE_PERMISSIONS]
    if (!permissions?.includes('professions:write')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { type, serviceTemplateId, professionId, alternativeGroupId, professionSkillId, requirementMode } = body

    if (type === 'profession') {
      if (!serviceTemplateId || !professionId) {
        return NextResponse.json({ error: 'serviceTemplateId and professionId required' }, { status: 400 })
      }
      const requirement = await setServiceProfessionRequirement(prisma, {
        serviceTemplateId,
        professionId,
        alternativeGroupId,
      })
      return NextResponse.json({ requirement }, { status: 201 })
    }

    if (type === 'skill') {
      const { serviceProfessionReqId } = body
      if (!serviceProfessionReqId || !professionSkillId || !requirementMode) {
        return NextResponse.json({ error: 'serviceProfessionReqId, professionSkillId, and requirementMode required' }, { status: 400 })
      }
      const requirement = await setServiceSkillRequirement(prisma, {
        serviceProfessionReqId,
        professionSkillId,
        requirementMode,
      })
      return NextResponse.json({ requirement }, { status: 201 })
    }

    return NextResponse.json({ error: 'type must be "profession" or "skill"' }, { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error'
    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 })
    }
    if (message.includes('inactive')) {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    console.error('Admin service requirement create error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
