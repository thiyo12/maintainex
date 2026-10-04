import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { getTrustedClientIp } from '@/lib/security/client-ip'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

function walk(root: string): string[] {
  if (!existsSync(root)) return []
  const out: string[] = []
  for (const entry of readdirSync(root)) {
    if (['node_modules', '.next', 'dist', 'build', 'coverage', 'tests'].includes(entry)) continue
    const path = join(root, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) out.push(...walk(path))
    else if (/\.(?:ts|tsx|js|jsx)$/.test(path)) out.push(path)
  }
  return out
}

function headers(values: Record<string, string>): { get(name: string): string | null } {
  const normalized = new Map(
    Object.entries(values).map(([key, value]) => [key.toLowerCase(), value])
  )
  return {
    get(name: string) {
      return normalized.get(name.toLowerCase()) ?? null
    },
  }
}

describe('trusted proxy client IP boundary', () => {
  it('uses Cloudflare client IP and ignores spoofed forwarded headers in production', () => {
    const h = headers({
      'cf-connecting-ip': '203.0.113.10',
      'x-forwarded-for': '198.51.100.99, 10.0.0.1',
      'x-real-ip': '192.0.2.44',
    })

    expect(getTrustedClientIp(h, { production: true, proxyMode: 'cloudflare' }))
      .toBe('203.0.113.10')
  })

  it('uses only x-real-ip for an explicitly trusted reverse proxy', () => {
    const h = headers({
      'x-forwarded-for': '198.51.100.99',
      'x-real-ip': '192.0.2.44',
    })

    expect(getTrustedClientIp(h, { production: true, proxyMode: 'reverse-proxy' }))
      .toBe('192.0.2.44')
  })

  it('fails closed to unknown when production proxy trust is not configured', () => {
    const h = headers({
      'x-forwarded-for': '198.51.100.99',
      'x-real-ip': '192.0.2.44',
    })

    expect(getTrustedClientIp(h, { production: true, proxyMode: '' }))
      .toBe('unknown')
  })

  it('rejects arbitrary non-IP header text', () => {
    const h = headers({ 'cf-connecting-ip': 'attacker-controlled-value' })
    expect(getTrustedClientIp(h, { production: true, proxyMode: 'cloudflare' }))
      .toBe('unknown')
  })

  it('keeps local/test forwarded-header compatibility outside production', () => {
    const h = headers({ 'x-forwarded-for': '198.51.100.9, 10.0.0.2' })
    expect(getTrustedClientIp(h, { production: false, proxyMode: '' }))
      .toBe('198.51.100.9')
  })

  it('uses the canonical resolver in middleware, rate limiting and admin audit context', () => {
    for (const path of [
      'middleware.ts',
      'lib/shared/rate-limit/middleware.ts',
      'lib/auth/authorization/admin-rbac.ts',
    ]) {
      const code = source(path)
      expect(code).toContain('getTrustedClientIp')
    }

    expect(source('middleware.ts')).not.toContain(
      "request.headers.get('x-forwarded-for')?.split(',')[0]"
    )
    expect(source('lib/shared/rate-limit/middleware.ts')).not.toContain(
      "request.headers.get('x-forwarded-for')?.split(',')[0]"
    )
  })

  it('does not read spoofable client-IP headers outside the canonical resolver', () => {
    const roots = [
      resolve(process.cwd(), 'app'),
      resolve(process.cwd(), 'lib'),
    ]
    const files = [
      resolve(process.cwd(), 'middleware.ts'),
      ...roots.flatMap(walk),
    ]
    const allowed = new Set([
      'lib/security/client-ip.ts',
    ])
    const violations: Array<{ path: string; header: string }> = []

    for (const file of files) {
      const path = relative(process.cwd(), file).replaceAll('\\', '/')
      if (allowed.has(path)) continue
      const code = readFileSync(file, 'utf8')
      for (const header of ['x-forwarded-for', 'x-real-ip', 'cf-connecting-ip']) {
        if (code.toLowerCase().includes(header)) violations.push({ path, header })
      }
    }

    expect(violations).toEqual([])
  })

  it('requires explicit proxy trust in production startup and deployment checks', () => {
    const env = source('lib/config/env-validation.ts')
    const preflight = source('scripts/crm-v2-production-preflight.sh')
    const deploy = source('deploy-rsync.sh')

    expect(env).toContain('TRUSTED_PROXY_MODE must be explicitly configured')
    expect(preflight).toContain('TRUSTED_PROXY_MODE')
    expect(preflight).toContain('must be cloudflare for the current production edge topology')
    expect(deploy).toContain('TRUSTED_PROXY_MODE')
    expect(deploy).toContain('must be cloudflare for the current production edge topology')
  })
})
