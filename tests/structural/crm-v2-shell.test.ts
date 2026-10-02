import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('CRM V2 shell contract', () => {
  it('uses a flat primary navigation without the legacy accordion hierarchy', () => {
    const source = read('components/admin/AdminLayout.tsx')

    for (const label of [
      'Dashboard',
      'Jobs',
      'Customers',
      'Taskers',
      'Companies',
      'Finance',
      'Disputes',
      'Trust & Safety',
      'Analytics',
      'App & Web',
      'Real Estate',
      'Staff',
      'Settings',
    ]) {
      expect(source).toContain(`name: '${label}'`)
    }

    expect(source).not.toContain('children?: NavItem[]')
    expect(source).not.toContain('expandedItems')
    expect(source).not.toContain('FiChevronDown')
    expect(source).not.toContain("ADMIN: { label: 'Admin'")
  })

  it('filters navigation from effective live permissions and uses server logout', () => {
    const source = read('components/admin/AdminLayout.tsx')

    expect(source).toContain('new Set(user?.permissions || [])')
    expect(source).toContain("fetch('/api/admin/auth/logout'")
    expect(source).toContain('credentials: \'include\'')
    expect(source).not.toContain("document.cookie = 'admin_token")
  })

  it('shows real market, TOTP and session state in the shell', () => {
    const source = read('components/admin/AdminLayout.tsx')
    const me = read('app/api/admin/auth/me/route.ts')

    expect(source).toContain('<CrmGlobalSearch market={market} />')
    expect(source).toContain('user.totpEnabled')
    expect(source).toContain('user.sessionExpiresAt')
    expect(source).toContain('user.markets')

    expect(me).toContain('permissions: effectivePermissions')
    expect(me).toContain('totpEnabled: adminUser.totpEnabled')
    expect(me).toContain('sessionExpiresAt: liveSession.expiresAt.toISOString()')
    expect(me).toContain('markets,')
  })

  it('keeps V2 visual tokens scoped to the CRM shell', () => {
    const css = read('app/globals.css')

    expect(css).toContain('.crm-v2 {')
    expect(css).toContain('--crm-rail:')
    expect(css).toContain('--crm-canvas:')
    expect(css).toContain('--crm-accent:')
    expect(css).toContain('.crm-v2 .crm-card')
  })
})
