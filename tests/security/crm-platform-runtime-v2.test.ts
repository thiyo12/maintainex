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

  it('guards mobile catalog endpoints with runtime and market availability', () => {
    for (const path of [
      'app/api/mobile/job-categories/route.ts',
      'app/api/mobile/service-categories/route.ts',
      'app/api/mobile/v2/service-templates/route.ts',
    ]) {
      const source = readFileSync(resolve(process.cwd(), path), 'utf8')
      expect(source).toContain('getPlatformRuntimeConfig')
      expect(source).toContain('runtime.maintenance.enabled')
      expect(source).toContain('!runtime.channels.mobile')
      expect(source).toContain('!runtime.catalog.visible')
      expect(source).toContain('!runtime.market.available')
    }

    const serviceCategories = readFileSync(
      resolve(process.cwd(), 'app/api/mobile/service-categories/route.ts'),
      'utf8'
    )
    expect(serviceCategories).toContain('storedListIncludes(category.countries, country)')
    expect(serviceCategories).toContain('storedListIncludes(job.countries, country)')
  })

  it('wires website and mobile consumers to the runtime contract', () => {
    const publicLayout = readFileSync(resolve(process.cwd(), 'app/(public)/layout.tsx'), 'utf8')
    const mobileLayout = readFileSync(resolve(process.cwd(), 'apps/mobile/app/_layout.tsx'), 'utf8')
    const mobileRuntime = readFileSync(resolve(process.cwd(), 'apps/mobile/lib/runtime.tsx'), 'utf8')
    const categories = readFileSync(resolve(process.cwd(), 'app/api/categories/route.ts'), 'utf8')
    const serviceTemplates = readFileSync(resolve(process.cwd(), 'app/api/mobile/v2/service-templates/route.ts'), 'utf8')
    const search = readFileSync(resolve(process.cwd(), 'app/api/mobile/v2/search/route.ts'), 'utf8')

    expect(publicLayout).toContain('getPlatformRuntimeConfig')
    expect(publicLayout).toContain("redirect('/maintenance')")
    expect(mobileLayout).toContain('RuntimeProvider')
    expect(mobileLayout).toContain('RuntimeGate')
    expect(mobileLayout).toContain('config.notifications.enabled')
    expect(mobileRuntime).toContain('minimumVersion')
    expect(mobileRuntime).toContain('!config.market.available')
    expect(categories).toContain('runtime.catalog.visible')
    expect(serviceTemplates).toContain('runtime.catalog.visible')
    expect(search).toContain('runtime.catalog.visible')
  })

  it('consumes runtime controls in the mobile root and push boundaries', () => {
    const runtime = readFileSync(resolve(process.cwd(), 'apps/mobile/lib/runtime.tsx'), 'utf8')
    const layout = readFileSync(resolve(process.cwd(), 'apps/mobile/app/_layout.tsx'), 'utf8')
    const notifications = readFileSync(
      resolve(process.cwd(), 'app/api/mobile/notifications/route.ts'),
      'utf8'
    )
    const push = readFileSync(resolve(process.cwd(), 'lib/push.ts'), 'utf8')

    expect(runtime).toContain('config.maintenance.enabled')
    expect(runtime).toContain('!config.channels.mobile')
    expect(runtime).toContain('!config.market.available')
    expect(runtime).toContain('config.mobile.minimumVersion')
    expect(runtime).toContain('config.banner.enabled')
    expect(layout).toContain('!config.notifications.enabled')
    expect(notifications).toContain('getPlatformRuntimeConfig')
    expect(notifications).toContain('!runtime.notifications.enabled')
    expect(push).toContain('getPlatformRuntimeConfig')
    expect(push).toContain('!runtime.notifications.enabled')
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
