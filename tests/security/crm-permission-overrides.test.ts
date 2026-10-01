import { describe, expect, it } from 'vitest'
import {
  canDelegatePermissionClass,
  evaluateEffectivePermission,
  validatePermissionOverrides,
} from '@/lib/crm/governance'

describe('CRM V2 effective permissions', () => {
  it('explicit DENY wins over a role-template permission', () => {
    const result = evaluateEffectivePermission({
      role: 'MANAGER',
      permission: 'jobs:manage',
      overrides: [{ permission: 'jobs:manage', effect: 'DENY' }],
    })
    expect(result).toEqual({ allowed: false, source: 'EXPLICIT_DENY' })
  })

  it('explicit ALLOW can grant a delegable missing permission', () => {
    const result = evaluateEffectivePermission({
      role: 'SUPPORT',
      permission: 'jobs:manage',
      permissionClass: 'NORMAL',
      overrides: [{ permission: 'jobs:manage', effect: 'ALLOW' }],
    })
    expect(result).toEqual({ allowed: true, source: 'EXPLICIT_ALLOW' })
  })

  it('OWNER_ONLY ignores explicit ALLOW for non-owner roles', () => {
    const result = evaluateEffectivePermission({
      role: 'MANAGER',
      permission: 'staff:role:manage',
      permissionClass: 'OWNER_ONLY',
      overrides: [{ permission: 'staff:role:manage', effect: 'ALLOW' }],
    })
    expect(result).toEqual({ allowed: false, source: 'OWNER_ONLY' })
  })

  it('SYSTEM_ONLY is never granted to a human role', () => {
    expect(evaluateEffectivePermission({
      role: 'SUPER_ADMIN',
      permission: 'audit:mutate',
      permissionClass: 'SYSTEM_ONLY',
    }).allowed).toBe(false)
  })

  it('only SUPER_ADMIN can delegate sensitive or owner permissions', () => {
    expect(canDelegatePermissionClass('SUPER_ADMIN', 'SENSITIVE')).toBe(true)
    expect(canDelegatePermissionClass('MANAGER', 'SENSITIVE')).toBe(false)
    expect(canDelegatePermissionClass('MANAGER', 'NORMAL')).toBe(true)
    expect(canDelegatePermissionClass('FINANCE', 'NORMAL')).toBe(false)
  })

  it('rejects duplicate overrides', () => {
    expect(validatePermissionOverrides([
      { permission: 'jobs:view', effect: 'ALLOW' },
      { permission: 'jobs:view', effect: 'DENY' },
    ])).toEqual({ valid: false, reason: 'Duplicate permission override.' })
  })

  it('maps canonical V2 read permissions to legacy role templates during migration', () => {
    expect(evaluateEffectivePermission({
      role: 'USER_MANAGEMENT',
      permission: 'customers:view',
      permissionClass: 'READ',
    })).toEqual({ allowed: true, source: 'ROLE_TEMPLATE' })

    expect(evaluateEffectivePermission({
      role: 'TECHNICAL',
      permission: 'customers:view',
      permissionClass: 'READ',
    }).allowed).toBe(false)
  })
})
