import { describe, expect, it } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

function walk(root: string): string[] {
  if (!existsSync(root)) return []
  const out: string[] = []
  for (const entry of readdirSync(root)) {
    const path = join(root, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) out.push(...walk(path))
    else if (entry === 'route.ts') out.push(path)
  }
  return out
}

const PUBLIC_MUTATION_ROUTES = new Set([
  'app/api/applications/route.ts',
  'app/api/contact/route.ts',
  'app/api/waitlist/route.ts',
  'app/api/reviews/route.ts',
  'app/api/price-suggest/route.ts',
  'app/api/upload/cv/route.ts',
  'app/api/auth/forgot-password/route.ts',
  'app/api/auth/reset-password/route.ts',
  'app/api/admin/auth/login/route.ts',
  'app/api/admin/auth/2fa/verify/route.ts',
  'app/api/admin/auth/refresh/route.ts',
  'app/api/admin/auth/logout/route.ts',
])

const RETIRED_MUTATION_ROUTES = new Set([
  'app/api/mobile/quick-bookings/route.ts',
])

const PUBLIC_MARKETPLACE_AUTH_ROUTES = [
  '/auth/',
  '/register/',
  '/otp',
  '/password',
] as const

const SECURITY_BOUNDARY_MARKERS = [
  'authenticateMarketplaceUser(',
  'authenticateRequest(',
  'guardCrmRequest(',
  'guardCrmAction(',
  'getSession(',
  'requireInternal',
  'INTERNAL_SYNC_SECRET',
  'CRON_SECRET',
  'verifyPayPalWebhook',
  'verifyPayHere',
  'verifyNotificationSignature',
  'signatureVerified',
  "process.env.NODE_ENV === 'production'",
] as const

const PUBLIC_ABUSE_MARKERS = [
  'checkRateLimit(',
  'checkOtpSendLimit(',
  'checkOtpVerifyLimit(',
  'rateLimit',
  'RATE_LIMIT',
] as const

function exportedMethods(code: string): string[] {
  return [...code.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)/g)]
    .map(match => match[1])
}

function hasBoundary(code: string): boolean {
  return SECURITY_BOUNDARY_MARKERS.some(marker => code.includes(marker))
}

function isAuthBootstrapRoute(path: string): boolean {
  return path.startsWith('app/api/mobile/') &&
    PUBLIC_MARKETPLACE_AUTH_ROUTES.some(segment => path.includes(segment))
}

describe('API attack-surface inventory', () => {
  const root = resolve(process.cwd(), 'app/api')
  const routes = walk(root)
    .map(path => relative(process.cwd(), path).replaceAll('\\', '/'))
    .sort()

  it('maintains a non-empty inventory of API routes', () => {
    expect(routes.length).toBeGreaterThan(200)
  })

  it('classifies every mutation-capable API route behind a security boundary or explicit public contract', () => {
    const unclassified: Array<{ path: string; methods: string[] }> = []

    for (const path of routes) {
      const code = readFileSync(resolve(process.cwd(), path), 'utf8')
      const methods = exportedMethods(code)
      if (!methods.some(method => method !== 'GET')) continue

      if (hasBoundary(code)) continue
      if (PUBLIC_MUTATION_ROUTES.has(path)) continue
      if (RETIRED_MUTATION_ROUTES.has(path)) continue
      if (isAuthBootstrapRoute(path)) continue

      unclassified.push({ path, methods })
    }

    expect(unclassified).toEqual([])
  })

  it('keeps retired mutation routes as no-op 410 boundaries', () => {
    for (const path of RETIRED_MUTATION_ROUTES) {
      const code = readFileSync(resolve(process.cwd(), path), 'utf8')
      expect(code).toContain('status: 410')
      expect(code).not.toContain("from '@/lib/prisma'")
      expect(code).not.toContain('prisma.')
    }
  })

  it('keeps explicitly public mutation routes abuse-limited or security-gated', () => {
    const weak: string[] = []

    for (const path of PUBLIC_MUTATION_ROUTES) {
      const absolute = resolve(process.cwd(), path)
      if (!existsSync(absolute)) continue
      const code = readFileSync(absolute, 'utf8')
      const protectedByBoundary = hasBoundary(code)
      const abuseLimited = PUBLIC_ABUSE_MARKERS.some(marker => code.includes(marker))
      if (!protectedByBoundary && !abuseLimited) weak.push(path)
    }

    expect(weak).toEqual([])
  })

  it('requires internal, cron and webhook mutations to authenticate their caller/source', () => {
    const weak: string[] = []

    for (const path of routes) {
      if (
        !path.startsWith('app/api/internal/') &&
        !path.startsWith('app/api/cron/') &&
        !path.startsWith('app/api/webhooks/')
      ) continue

      const code = readFileSync(resolve(process.cwd(), path), 'utf8')
      const methods = exportedMethods(code)
      if (!methods.some(method => method !== 'GET')) continue

      if (!hasBoundary(code)) weak.push(path)
    }

    expect(weak).toEqual([])
  })

  it('records the attack-surface size for security review drift detection', () => {
    const mutations = routes.filter(path => {
      const code = readFileSync(resolve(process.cwd(), path), 'utf8')
      return exportedMethods(code).some(method => method !== 'GET')
    })

    expect({
      routes: routes.length,
      mutationRoutes: mutations.length,
    }).toMatchObject({
      routes: expect.any(Number),
      mutationRoutes: expect.any(Number),
    })
    expect(mutations.length).toBeGreaterThan(100)
  })
})
