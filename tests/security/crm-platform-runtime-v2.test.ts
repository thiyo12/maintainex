import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  PLATFORM_RUNTIME_KEYS,
  validatePlatformRuntimeSetting,
} from '@/lib/runtime/platform-runtime'

describe('CRM V2 platform runtime controls', () => {
  it('defines only validated runtime settings and keeps booking locked', () => {
    expect(PLATFORM_RUNTIME_KEYS).toContain('runtime.website.enabled')
    expect(PLATFORM_RUNTIME_KEYS).toContain('runtime.mobile.enabled')
    expect(PLATFORM_RUNTIME_KEYS).toContain('runtime.maintenance.enabled')
    expect(PLATFORM_RUNTIME_KEYS).toContain('runtime.catalog.visible')
    expect(PLATFORM_RUNTIME_KEYS).toContain('runtime.offers.visible')
    expect(PLATFORM_RUNTIME_KEYS).toContain('runtime.notifications.enabled')
    expect(PLATFORM_RUNTIME_KEYS).toContain('runtime.mobile.minimumVersion')
    expect(validatePlatformRuntimeSetting('runtime.mobile.minimumVersion', '1.2.3')).toBeNull()
    expect(validatePlatformRuntimeSetting('runtime.mobile.minimumVersion', 'latest')).toBeTruthy()
  })

  it('exposes a safe public runtime contract without secret values', () => {
    const source = readFileSync(resolve(process.cwd(), 'app/api/runtime/config/route.ts'), 'utf8')
    expect(source).toContain("booking: false")
    expect(source).toContain("reason: 'PUBLIC_BOOKING_UX_GATE_PENDING'")
    expect(source).not.toContain('process.env')
    expect(source).not.toContain('DATABASE_URL')
    expect(source).not.toContain('SECRET')
  })

  it('protects runtime mutation with canonical CRM permission and audit', () => {
    const source = readFileSync(resolve(process.cwd(), 'app/api/admin/platform/runtime/route.ts'), 'utf8')
    expect(source).toContain("permission: 'platform:settings:manage'")
    expect(source).toContain("level: 'sensitive'")
    expect(source).toContain('prisma.$transaction')
    expect(source).toContain('createAuditLog')
    expect(source).toContain("action: 'PLATFORM_RUNTIME_UPDATE'")
  })
})
