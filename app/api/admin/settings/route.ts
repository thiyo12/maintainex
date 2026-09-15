import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/admin-auth'
import { ROLE_PERMISSIONS } from '@/lib/admin-types'

const SETTINGS_ALLOWED_ROLES = ['SUPER_ADMIN', 'MANAGER', 'FINANCE'] as const

const DEFAULT_SETTINGS: Record<string, { value: string; type: string; label: string; description: string; groupName: string }> = {
  commissionRate: { value: '10', type: 'number', label: 'Commission Rate (%)', description: 'Platform commission percentage charged per completed job', groupName: 'billing' },
  platformName: { value: 'MaintainEX', type: 'string', label: 'Platform Name', description: 'Display name of the platform', groupName: 'general' },
  supportEmail: { value: 'support@maintainex.lk', type: 'string', label: 'Support Email', description: 'Customer support email address', groupName: 'general' },
  currency: { value: 'LKR', type: 'string', label: 'Currency', description: 'Default currency for transactions', groupName: 'billing' },
  minTaskerStaff: { value: '3', type: 'number', label: 'Minimum Tasker Staff', description: 'Minimum staff required for company verification', groupName: 'taskers' },
  weeklySettlementDay: { value: 'monday', type: 'string', label: 'Weekly Settlement Day', description: 'Day of the week for automatic settlements', groupName: 'billing' },
  autoApproveKyc: { value: 'false', type: 'boolean', label: 'Auto-Approve KYC', description: 'Automatically approve identity verification documents', groupName: 'security' },
  maintenanceMode: { value: 'false', type: 'boolean', label: 'Maintenance Mode', description: 'Enable maintenance mode to restrict public access', groupName: 'general' },
}

function parseSettingValue(value: string, type: string): string | number | boolean {
  switch (type) {
    case 'number':
      return Number(value)
    case 'boolean':
      return value === 'true'
    default:
      return value
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!(SETTINGS_ALLOWED_ROLES as readonly string[]).includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch all settings from DB
    const dbSettings = await prisma.settings.findMany()

    // Merge defaults with DB values
    const settings: Record<string, any> = {}

    for (const [key, defaultConfig] of Object.entries(DEFAULT_SETTINGS)) {
      const dbSetting = dbSettings.find((s) => s.key === key)
      if (dbSetting) {
        settings[key] = parseSettingValue(dbSetting.value, dbSetting.type || defaultConfig.type)
      } else {
        settings[key] = parseSettingValue(defaultConfig.value, defaultConfig.type)
      }
    }

    return NextResponse.json({ settings })
  } catch (error) {
    console.error('Settings GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getAdminSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: SUPER_ADMIN required' }, { status: 403 })
    }

    const body = await request.json()
    const { settings } = body

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json({ error: 'Invalid settings payload' }, { status: 400 })
    }

    const updated: Record<string, any> = {}

    for (const [key, value] of Object.entries(settings) as [string, any][]) {
      const defaultConfig = DEFAULT_SETTINGS[key]
      if (!defaultConfig) continue // skip unknown keys

      const stringValue = String(value)

      await prisma.settings.upsert({
        where: { key },
        create: {
          key,
          value: stringValue,
          type: defaultConfig.type,
          label: defaultConfig.label,
          description: defaultConfig.description,
          groupName: defaultConfig.groupName,
          updatedBy: session.email || session.id,
          updatedAt: new Date(),
        },
        update: {
          value: stringValue,
          updatedBy: session.email || session.id,
          updatedAt: new Date(),
        },
      })

      updated[key] = parseSettingValue(stringValue, defaultConfig.type)
    }

    return NextResponse.json({ settings: updated })
  } catch (error) {
    console.error('Settings PUT error:', error)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
}
