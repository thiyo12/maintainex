import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardCrmRequest } from '@/lib/crm/security'
import { createAuditLog } from '@/lib/crm/audit'

const DELEGATED_SETTINGS = new Set([
  'commissionRate',
  'currency',
  'minTaskerStaff',
  'weeklySettlementDay',
  'autoApproveKyc',
])

const DEFAULT_SETTINGS: Record<string, { value: string; type: string; label: string; description: string; groupName: string }> = {
  commissionRate: { value: '10', type: 'number', label: 'Commission Rate (%)', description: 'Platform commission percentage charged per completed job', groupName: 'billing' },
  platformName: { value: 'MaintainEX', type: 'string', label: 'Platform Name', description: 'Display name of the platform', groupName: 'general' },
  supportEmail: { value: 'support@maintainex.lk', type: 'string', label: 'Support Email', description: 'Customer support email address', groupName: 'general' },
  currency: { value: 'LKR', type: 'string', label: 'Currency', description: 'Default currency for transactions', groupName: 'billing' },
  minTaskerStaff: { value: '3', type: 'number', label: 'Minimum Tasker Staff', description: 'Minimum staff required for company verification', groupName: 'taskers' },
  weeklySettlementDay: { value: 'monday', type: 'string', label: 'Weekly Settlement Day', description: 'Day of the week for automatic settlements', groupName: 'billing' },
  autoApproveKyc: { value: 'false', type: 'boolean', label: 'Auto-Approve KYC', description: 'Automatically approve identity verification documents', groupName: 'security' },
}

function parseSettingValue(value: string, type: string): string | number | boolean {
  if (type === 'number') return Number(value)
  if (type === 'boolean') return value === 'true'
  return value
}

function validateSetting(key: string, value: unknown): string | null {
  const config = DEFAULT_SETTINGS[key]
  if (!config) return 'Unknown setting'

  if (config.type === 'boolean' && typeof value !== 'boolean') return 'Expected boolean'
  if (config.type === 'number') {
    const n = Number(value)
    if (!Number.isFinite(n)) return 'Expected finite number'
    if (key === 'commissionRate' && (n < 0 || n > 100)) return 'Commission rate must be between 0 and 100'
    if (key === 'minTaskerStaff' && (n < 0 || n > 10000)) return 'Minimum tasker staff is out of range'
  }
  if (config.type === 'string') {
    if (typeof value !== 'string') return 'Expected string'
    if (value.length > 500) return 'Value is too long'
    if (key === 'supportEmail' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Invalid support email'
    if (key === 'currency' && !/^[A-Z]{3}$/.test(value)) return 'Currency must be a 3-letter ISO code'
  }
  return null
}

export async function GET(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'platform:settings:view',
      level: 'read',
    })
    if (!guard.ok) return guard.response

    const dbSettings = await prisma.settings.findMany()
    const settings: Record<string, string | number | boolean> = {}
    const definitions: Record<string, unknown> = {}

    for (const [key, defaultConfig] of Object.entries(DEFAULT_SETTINGS)) {
      const dbSetting = dbSettings.find(setting => setting.key === key)
      settings[key] = parseSettingValue(
        dbSetting?.value ?? defaultConfig.value,
        dbSetting?.type || defaultConfig.type
      )
      definitions[key] = {
        type: defaultConfig.type,
        label: defaultConfig.label,
        description: defaultConfig.description,
        groupName: defaultConfig.groupName,
        updatedBy: dbSetting?.updatedBy || null,
        updatedAt: dbSetting?.updatedAt || null,
      }
    }

    return NextResponse.json(
      { settings, definitions },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    secureConsole.error('CRM settings GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
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
      return NextResponse.json({ error: 'Invalid settings payload' }, { status: 400 })
    }

    const entries = Object.entries(settings)
    if (entries.length === 0 || entries.length > 20) {
      return NextResponse.json({ error: 'Settings payload is empty or too large' }, { status: 400 })
    }

    const validated: Array<[string, unknown]> = []
    for (const [key, value] of entries) {
      if (DELEGATED_SETTINGS.has(key)) {
        return NextResponse.json(
          { error: `${key} must be changed through its canonical domain control` },
          { status: 409 }
        )
      }

      const error = validateSetting(key, value)
      if (error) {
        return NextResponse.json({ error: `${key}: ${error}` }, { status: 400 })
      }
      validated.push([key, value])
    }

    const oldRows = await prisma.settings.findMany({
      where: { key: { in: validated.map(([key]) => key) } },
    })
    const oldMap = new Map(oldRows.map(row => [row.key, row.value]))

    const updated: Record<string, unknown> = {}
    await prisma.$transaction(async tx => {
      for (const [key, value] of validated) {
        const config = DEFAULT_SETTINGS[key]
        const stringValue = String(value)
        await tx.settings.upsert({
          where: { key },
          create: {
            key,
            value: stringValue,
            type: config.type,
            label: config.label,
            description: config.description,
            groupName: config.groupName,
            updatedBy: security.email,
            updatedAt: new Date(),
          },
          update: {
            value: stringValue,
            updatedBy: security.email,
            updatedAt: new Date(),
          },
        })
        updated[key] = parseSettingValue(stringValue, config.type)
      }
    })

    await createAuditLog({
      action: 'UPDATE',
      category: 'SYSTEM',
      userId: security.adminId,
      userEmail: security.email,
      userRole: security.role,
      entityType: 'Settings',
      entityName: 'Platform settings',
      description: 'CRM platform settings updated',
      oldValue: Object.fromEntries(validated.map(([key]) => [key, oldMap.get(key) ?? null])),
      newValue: updated,
      ipAddress: security.ipAddress,
      userAgent: security.userAgent || undefined,
      riskLevel: validated.some(([key]) => ['commissionRate', 'autoApproveKyc'].includes(key)) ? 'HIGH' : 'MEDIUM',
    })

    return NextResponse.json({ settings: updated })
  } catch (error) {
    secureConsole.error('CRM settings PUT error:', error)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
