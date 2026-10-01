import { prisma } from '@/lib/prisma'

export type RuntimeBannerSeverity = 'INFO' | 'WARNING' | 'CRITICAL'

export interface RuntimeSettingDefinition {
  key: string
  type: 'boolean' | 'string'
  defaultValue: boolean | string
  label: string
  description: string
}

export const PLATFORM_RUNTIME_DEFINITIONS: readonly RuntimeSettingDefinition[] = [
  {
    key: 'runtime.website.enabled',
    type: 'boolean',
    defaultValue: true,
    label: 'Website available',
    description: 'Allow normal public website access when maintenance mode is off.',
  },
  {
    key: 'runtime.mobile.enabled',
    type: 'boolean',
    defaultValue: true,
    label: 'Mobile app available',
    description: 'Allow customer, tasker and company mobile sessions when maintenance mode is off.',
  },
  {
    key: 'runtime.maintenance.enabled',
    type: 'boolean',
    defaultValue: false,
    label: 'Maintenance mode',
    description: 'Temporarily place public web and mobile channels into maintenance state.',
  },
  {
    key: 'runtime.maintenance.message',
    type: 'string',
    defaultValue: 'MaintainEX is temporarily unavailable while scheduled maintenance is completed.',
    label: 'Maintenance message',
    description: 'Public-safe message shown while maintenance mode is active.',
  },
  {
    key: 'runtime.catalog.visible',
    type: 'boolean',
    defaultValue: true,
    label: 'Catalog visible',
    description: 'Allow public and mobile service/category discovery.',
  },
  {
    key: 'runtime.offers.visible',
    type: 'boolean',
    defaultValue: true,
    label: 'Offers visible',
    description: 'Allow active seasonal and flash promotions to be returned to public/mobile clients.',
  },
  {
    key: 'runtime.notifications.enabled',
    type: 'boolean',
    defaultValue: true,
    label: 'Push notifications enabled',
    description: 'Allow mobile clients to register and listen for operational push notifications.',
  },
  {
    key: 'runtime.banner.enabled',
    type: 'boolean',
    defaultValue: false,
    label: 'Operational banner enabled',
    description: 'Show a public-safe operational banner on supported web/mobile surfaces.',
  },
  {
    key: 'runtime.banner.message',
    type: 'string',
    defaultValue: '',
    label: 'Operational banner message',
    description: 'Short public-safe operational message.',
  },
  {
    key: 'runtime.banner.severity',
    type: 'string',
    defaultValue: 'INFO',
    label: 'Operational banner severity',
    description: 'INFO, WARNING or CRITICAL presentation severity.',
  },
  {
    key: 'runtime.mobile.minimumVersion',
    type: 'string',
    defaultValue: '1.0.0',
    label: 'Minimum mobile version',
    description: 'Minimum supported semantic app version.',
  },
] as const

export const PLATFORM_RUNTIME_KEYS = PLATFORM_RUNTIME_DEFINITIONS.map(item => item.key)

const definitions = new Map(PLATFORM_RUNTIME_DEFINITIONS.map(item => [item.key, item]))

function parseValue(raw: string | undefined, definition: RuntimeSettingDefinition): boolean | string {
  if (raw === undefined) return definition.defaultValue
  if (definition.type === 'boolean') return raw === 'true'
  return raw
}

function normalizeCountry(value: string | null | undefined): string | null {
  const country = value?.trim().toUpperCase() || ''
  return /^[A-Z]{2}$/.test(country) ? country : null
}

export function validatePlatformRuntimeSetting(key: string, value: unknown): string | null {
  const definition = definitions.get(key)
  if (!definition) return 'Unknown runtime setting'

  if (definition.type === 'boolean') {
    return typeof value === 'boolean' ? null : 'Expected boolean'
  }

  if (typeof value !== 'string') return 'Expected string'
  const trimmed = value.trim()

  if (key === 'runtime.banner.message' || key === 'runtime.maintenance.message') {
    if (trimmed.length > 240) return 'Message must be 240 characters or fewer'
    if (key === 'runtime.maintenance.message' && trimmed.length < 3) {
      return 'Maintenance message is required'
    }
    return null
  }

  if (key === 'runtime.banner.severity') {
    return ['INFO', 'WARNING', 'CRITICAL'].includes(trimmed.toUpperCase())
      ? null
      : 'Severity must be INFO, WARNING or CRITICAL'
  }

  if (key === 'runtime.mobile.minimumVersion') {
    return /^\d+\.\d+\.\d+$/.test(trimmed)
      ? null
      : 'Minimum version must use semantic version format'
  }

  return trimmed.length <= 240 ? null : 'Value is too long'
}

export async function getPlatformRuntimeConfig(countryInput?: string | null) {
  const [rows, marketRows] = await Promise.all([
    prisma.settings.findMany({
      where: { key: { in: PLATFORM_RUNTIME_KEYS } },
      select: { key: true, value: true },
    }),
    prisma.marketConfig.findMany({
      where: { countryCode: { not: 'GLOBAL' } },
      select: { countryCode: true },
      orderBy: { countryCode: 'asc' },
    }),
  ])

  const stored = new Map(rows.map(row => [row.key, row.value]))
  const value = (key: string) => {
    const definition = definitions.get(key)
    if (!definition) throw new Error(`Unknown runtime setting: ${key}`)
    return parseValue(stored.get(key), definition)
  }

  const availableMarkets = [...new Set(
    marketRows
      .map(row => row.countryCode.trim().toUpperCase())
      .filter(code => /^[A-Z]{2}$/.test(code))
  )]
  const countryCode = normalizeCountry(countryInput)
  const marketAvailable = countryCode ? availableMarkets.includes(countryCode) : true

  const bannerSeverity = String(value('runtime.banner.severity')).toUpperCase() as RuntimeBannerSeverity
  const maintenanceEnabled = Boolean(value('runtime.maintenance.enabled'))

  return {
    channels: {
      website: Boolean(value('runtime.website.enabled')),
      mobile: Boolean(value('runtime.mobile.enabled')),
      booking: false,
    },
    maintenance: {
      enabled: maintenanceEnabled,
      message: String(value('runtime.maintenance.message')),
    },
    catalog: {
      visible: Boolean(value('runtime.catalog.visible')),
    },
    offers: {
      visible: Boolean(value('runtime.offers.visible')),
    },
    notifications: {
      enabled: Boolean(value('runtime.notifications.enabled')),
    },
    banner: {
      enabled: Boolean(value('runtime.banner.enabled')),
      message: String(value('runtime.banner.message')),
      severity: ['INFO', 'WARNING', 'CRITICAL'].includes(bannerSeverity)
        ? bannerSeverity
        : 'INFO',
    },
    mobile: {
      minimumVersion: String(value('runtime.mobile.minimumVersion')),
    },
    market: {
      countryCode,
      available: marketAvailable,
      availableMarkets,
    },
    booking: {
      enabled: false,
      locked: true,
      reason: 'PUBLIC_BOOKING_UX_GATE_PENDING',
    },
  }
}

export function runtimeSettingDefinition(key: string): RuntimeSettingDefinition | null {
  return definitions.get(key) || null
}
