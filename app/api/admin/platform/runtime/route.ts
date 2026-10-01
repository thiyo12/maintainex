import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createAuditLog } from '@/lib/crm/audit'
import { guardCrmRequest } from '@/lib/crm/security'
import {
  PLATFORM_RUNTIME_DEFINITIONS,
  getPlatformRuntimeConfig,
  runtimeSettingDefinition,
  validatePlatformRuntimeSetting,
} from '@/lib/runtime/platform-runtime'

export async function GET(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'platform:settings:view',
      level: 'read',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response

    const config = await getPlatformRuntimeConfig()
    return NextResponse.json(
      {
        config,
        definitions: PLATFORM_RUNTIME_DEFINITIONS,
        canManage: guard.context.isSuperAdmin ||
          guard.context.permissionOverrides.some(
            item => item.permission === 'platform:settings:manage' && item.effect === 'ALLOW'
          ),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('CRM runtime config GET error:', error)
    return NextResponse.json({ error: 'Failed to load runtime controls' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'platform:settings:manage',
      level: 'sensitive',
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const body = await request.json().catch(() => ({}))
    const settings = body?.settings
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      return NextResponse.json({ error: 'Invalid runtime settings payload' }, { status: 400 })
    }

    const entries = Object.entries(settings)
    if (entries.length === 0 || entries.length > PLATFORM_RUNTIME_DEFINITIONS.length) {
      return NextResponse.json({ error: 'Runtime settings payload is empty or too large' }, { status: 400 })
    }

    const normalized: Array<[string, string]> = []
    for (const [key, rawValue] of entries) {
      const definition = runtimeSettingDefinition(key)
      if (!definition) {
        return NextResponse.json({ error: `${key}: Unknown runtime setting` }, { status: 400 })
      }
      const validation = validatePlatformRuntimeSetting(key, rawValue)
      if (validation) {
        return NextResponse.json({ error: `${key}: ${validation}` }, { status: 400 })
      }

      let value = rawValue
      if (typeof value === 'string') value = value.trim()
      if (key === 'runtime.banner.severity') value = String(value).toUpperCase()
      normalized.push([key, String(value)])
    }

    const oldRows = await prisma.settings.findMany({
      where: { key: { in: normalized.map(([key]) => key) } },
      select: { key: true, value: true },
    })
    const oldMap = new Map(oldRows.map(row => [row.key, row.value]))

    await prisma.$transaction(async tx => {
      for (const [key, value] of normalized) {
        const definition = runtimeSettingDefinition(key)!
        await tx.settings.upsert({
          where: { key },
          create: {
            key,
            value,
            type: definition.type,
            label: definition.label,
            description: definition.description,
            groupName: 'runtime',
            updatedBy: security.email,
            updatedAt: new Date(),
          },
          update: {
            value,
            type: definition.type,
            label: definition.label,
            description: definition.description,
            groupName: 'runtime',
            updatedBy: security.email,
            updatedAt: new Date(),
          },
        })
      }
    })

    await createAuditLog({
      action: 'PLATFORM_RUNTIME_UPDATE',
      category: 'SYSTEM',
      userId: security.adminId,
      userEmail: security.email,
      userRole: security.role,
      entityType: 'PlatformRuntime',
      entityName: 'App & Web runtime controls',
      description: 'CRM runtime controls updated',
      oldValue: Object.fromEntries(normalized.map(([key]) => [key, oldMap.get(key) ?? null])),
      newValue: Object.fromEntries(normalized),
      ipAddress: security.ipAddress,
      userAgent: security.userAgent || undefined,
      riskLevel: normalized.some(([key]) =>
        ['runtime.website.enabled', 'runtime.mobile.enabled', 'runtime.maintenance.enabled'].includes(key)
      ) ? 'HIGH' : 'MEDIUM',
    })

    return NextResponse.json({
      success: true,
      config: await getPlatformRuntimeConfig(),
    })
  } catch (error) {
    console.error('CRM runtime config PUT error:', error)
    return NextResponse.json({ error: 'Failed to update runtime controls' }, { status: 500 })
  }
}
