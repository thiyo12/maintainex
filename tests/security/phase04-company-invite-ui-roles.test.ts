import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { canAssignRole, isValidCompanyRole } from '@/lib/phase6/rbac'

const screen = readFileSync(
  resolve(process.cwd(), 'apps/mobile/features/company/screens/team/invite.tsx'),
  'utf8',
)

describe('Phase 04 — mobile team invitation roles align with company permissions', () => {
  it('defaults to the API-supported WORKER role instead of legacy MEMBER', () => {
    expect(screen).toContain("useState<'WORKER' | 'MANAGER'>('WORKER')")
    expect(screen).toContain("setRole('WORKER')")
    expect(screen).not.toContain("setRole('MEMBER')")
  })

  it('offers MANAGER rather than an unsupported ADMIN role', () => {
    expect(screen).toContain("setRole('MANAGER')")
    expect(screen).not.toContain("setRole('ADMIN')")
    expect(screen).toContain('>Manager</Text>')
  })

  it('both offered roles are legal and assignable by a company owner', () => {
    for (const role of ['WORKER', 'MANAGER'] as const) {
      expect(isValidCompanyRole(role)).toBe(true)
      expect(canAssignRole('COMPANY_OWNER', role)).toBe(true)
    }
  })

  it('managers can invite workers but cannot escalate another manager', () => {
    expect(canAssignRole('MANAGER', 'WORKER')).toBe(true)
    expect(canAssignRole('MANAGER', 'MANAGER')).toBe(false)
  })

  it('passes the selected canonical role unchanged to the existing invitation API', () => {
    expect(screen).toContain('await v2Team.invite({')
    expect(screen).toContain('        role,')
  })
})
