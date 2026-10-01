import { describe, expect, it } from 'vitest'
import {
  canDelegatePermissionClass,
  getPermissionCatalogEntry,
  isKnownPermission,
} from '@/lib/crm/governance'

describe('CRM V2 permission catalog', () => {
  it('recognizes legacy and V2 action permissions', () => {
    expect(isKnownPermission('jobs:view')).toBe(true)
    expect(isKnownPermission('finance:refund:initiate')).toBe(true)
    expect(isKnownPermission('staff:permissions:manage')).toBe(true)
  })

  it('classifies owner-only permissions as non-delegable', () => {
    expect(getPermissionCatalogEntry('staff:permissions:manage')?.class).toBe('OWNER_ONLY')
    expect(canDelegatePermissionClass('SUPER_ADMIN', 'OWNER_ONLY')).toBe(false)
  })

  it('allows SUPER_ADMIN to delegate sensitive but not owner-only permissions', () => {
    expect(canDelegatePermissionClass('SUPER_ADMIN', 'SENSITIVE')).toBe(true)
    expect(canDelegatePermissionClass('SUPER_ADMIN', 'OWNER_ONLY')).toBe(false)
  })

  it('does not recognize arbitrary permission strings', () => {
    expect(isKnownPermission('root:everything')).toBe(false)
  })
})
