import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assertCrmCountryAllowed, guardCrmRequest } from '@/lib/crm/security'
import { createAuditLog } from '@/lib/crm/audit'
import { setServiceProfessionRequirement, setServiceSkillRequirement, getServiceRequirements } from '@/lib/profession'

const VALID_REQUIREMENT_MODES = new Set(['REQUIRED_ALL', 'REQUIRED_ANY_OF', 'PREFERRED'])

async function scopedTemplate(id: string) {
  return prisma.serviceTemplate.findUnique({
    where: { id },
    select: { id: true, name: true, countryCode: true },
  })
}

export async function GET(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'professions:read',
      level: 'read',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const serviceTemplateId = (new URL(request.url).searchParams.get('serviceTemplateId') || '').trim().slice(0, 128)
    if (!serviceTemplateId) {
      return NextResponse.json({ error: 'serviceTemplateId required' }, { status: 400 })
    }

    const template = await scopedTemplate(serviceTemplateId)
    if (!template) return NextResponse.json({ error: 'Service template not found' }, { status: 404 })
    if (!assertCrmCountryAllowed(security, template.countryCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const requirements = await getServiceRequirements(prisma, serviceTemplateId)
    return NextResponse.json(
      { requirements, serviceTemplate: template },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    secureConsole.error('CRM service requirements GET error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'professions:write',
      level: 'sensitive',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const body = await request.json().catch(() => ({}))
    const type = typeof body?.type === 'string' ? body.type.toLowerCase() : ''

    if (type === 'profession') {
      const serviceTemplateId = typeof body?.serviceTemplateId === 'string' ? body.serviceTemplateId.trim().slice(0, 128) : ''
      const professionId = typeof body?.professionId === 'string' ? body.professionId.trim().slice(0, 128) : ''
      const alternativeGroupId = typeof body?.alternativeGroupId === 'string' && body.alternativeGroupId.trim()
        ? body.alternativeGroupId.trim().slice(0, 128)
        : undefined

      if (!serviceTemplateId || !professionId) {
        return NextResponse.json({ error: 'serviceTemplateId and professionId required' }, { status: 400 })
      }

      const template = await scopedTemplate(serviceTemplateId)
      if (!template) return NextResponse.json({ error: 'Service template not found' }, { status: 404 })
      if (!assertCrmCountryAllowed(security, template.countryCode)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      const existing = await prisma.serviceProfessionRequirement.findUnique({
        where: { serviceTemplateId_professionId: { serviceTemplateId, professionId } },
      })

      const requirement = await setServiceProfessionRequirement(prisma, {
        serviceTemplateId,
        professionId,
        alternativeGroupId,
      })

      await createAuditLog({
        action: existing ? 'UPDATE' : 'CREATE',
        category: 'SYSTEM',
        userId: security.adminId,
        userEmail: security.email,
        userRole: security.role,
        entityType: 'ServiceProfessionRequirement',
        entityId: requirement.id,
        entityName: template.name,
        description: 'CRM service profession requirement saved',
        oldValue: existing,
        newValue: requirement,
        ipAddress: security.ipAddress,
        userAgent: security.userAgent || undefined,
        riskLevel: 'MEDIUM',
      })

      return NextResponse.json({ requirement }, { status: existing ? 200 : 201 })
    }

    if (type === 'skill') {
      const serviceProfessionReqId = typeof body?.serviceProfessionReqId === 'string' ? body.serviceProfessionReqId.trim().slice(0, 128) : ''
      const professionSkillId = typeof body?.professionSkillId === 'string' ? body.professionSkillId.trim().slice(0, 128) : ''
      const requirementMode = typeof body?.requirementMode === 'string' ? body.requirementMode.toUpperCase() : ''

      if (!serviceProfessionReqId || !professionSkillId || !VALID_REQUIREMENT_MODES.has(requirementMode)) {
        return NextResponse.json(
          { error: 'Valid serviceProfessionReqId, professionSkillId, and requirementMode required' },
          { status: 400 }
        )
      }

      const parent = await prisma.serviceProfessionRequirement.findUnique({
        where: { id: serviceProfessionReqId },
        select: {
          id: true,
          serviceTemplateId: true,
          professionId: true,
          skillRequirements: {
            where: { professionSkillId },
            take: 1,
          },
        },
      })
      if (!parent) return NextResponse.json({ error: 'Service profession requirement not found' }, { status: 404 })

      const template = await scopedTemplate(parent.serviceTemplateId)
      if (!template) return NextResponse.json({ error: 'Service template not found' }, { status: 404 })
      if (!assertCrmCountryAllowed(security, template.countryCode)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      const existing = parent.skillRequirements[0] || null
      const requirement = await setServiceSkillRequirement(prisma, {
        serviceProfessionReqId,
        professionSkillId,
        requirementMode: requirementMode as 'REQUIRED_ALL' | 'REQUIRED_ANY_OF' | 'PREFERRED',
      })

      await createAuditLog({
        action: existing ? 'UPDATE' : 'CREATE',
        category: 'SYSTEM',
        userId: security.adminId,
        userEmail: security.email,
        userRole: security.role,
        entityType: 'ServiceSkillRequirement',
        entityId: requirement.id,
        entityName: template.name,
        description: 'CRM service skill requirement saved',
        oldValue: existing,
        newValue: requirement,
        ipAddress: security.ipAddress,
        userAgent: security.userAgent || undefined,
        riskLevel: 'MEDIUM',
      })

      return NextResponse.json({ requirement }, { status: existing ? 200 : 201 })
    }

    return NextResponse.json({ error: 'type must be "profession" or "skill"' }, { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error'
    if (message.includes('not found')) return NextResponse.json({ error: message }, { status: 404 })
    if (message.includes('inactive') || message.includes('does not belong')) {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    secureConsole.error('CRM service requirement POST error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
