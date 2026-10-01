import { ROLE_PERMISSIONS } from '@/lib/admin-types'
import { CRM_ACTIONS } from './action-registry'
import { CRM_PERMISSION_LEGACY_ALIASES } from './permissions'
import type { PermissionClass } from './types'

export interface PermissionCatalogEntry {
  id: string
  class: PermissionClass
  source: 'LEGACY_ROLE_TEMPLATE' | 'CANONICAL_V2' | 'CRM_ACTION'
}

const SENSITIVE_LEGACY = new Set([
  'users:edit', 'users:ban', 'users:suspend',
  'taskers:edit', 'taskers:ban', 'taskers:verify',
  'companies:edit', 'companies:ban', 'companies:verify',
  'kyc:approve', 'kyc:reject',
  'jobs:manage', 'jobs:cancel',
  'commission:manage', 'commission:config',
  'wallets:manage',
  'disputes:resolve',
  'cheating:action',
  'queue:manage', 'queue:assign',
  'settings:edit',
  'security:audit',
  'wishlist:manage',
  'professions:write',
  'credentials:write',
  'risk_events:resolve',
  'pricing_config:write',
  'market_config:write',
  'realestate:manage',
])

const OWNER_ONLY_LEGACY = new Set([
  'admins:create',
  'admins:edit',
  'admins:delete',
])

const CANONICAL_SENSITIVE = new Set([
  'customers:status:manage',
  'customers:sessions:revoke',
  'taskers:status:manage',
  'companies:status:manage',
  'companies:workforce:manage',
  'kyc:review',
  'credentials:view',
  'credentials:manage',
  'risk:resolve',
  'catalog:publish',
  'promotions:manage',
  'platform:settings:manage',
  'pricing:manage',
  'markets:manage',
])

const CANONICAL_NORMAL = new Set([
  'customers:edit',
  'messages:respond',
  'disputes:manage',
  'catalog:edit',
])

function canonicalAliasClass(permission: string): PermissionClass {
  if (CANONICAL_SENSITIVE.has(permission)) return 'SENSITIVE'
  if (CANONICAL_NORMAL.has(permission)) return 'NORMAL'
  if (permission.endsWith(':view') || permission.endsWith(':read')) return 'READ'
  return 'NORMAL'
}

function legacyClass(permission: string): PermissionClass {
  if (OWNER_ONLY_LEGACY.has(permission)) return 'OWNER_ONLY'
  if (SENSITIVE_LEGACY.has(permission)) return 'SENSITIVE'
  if (permission.endsWith(':view') || permission.endsWith(':read')) return 'READ'
  return 'NORMAL'
}

export function getPermissionCatalog(): PermissionCatalogEntry[] {
  const catalog = new Map<string, PermissionCatalogEntry>()

  for (const permissions of Object.values(ROLE_PERMISSIONS)) {
    for (const permission of permissions) {
      if (!catalog.has(permission)) {
        catalog.set(permission, {
          id: permission,
          class: legacyClass(permission),
          source: 'LEGACY_ROLE_TEMPLATE',
        })
      }
    }
  }

  for (const permission of Object.keys(CRM_PERMISSION_LEGACY_ALIASES)) {
    catalog.set(permission, {
      id: permission,
      class: canonicalAliasClass(permission),
      source: 'CANONICAL_V2',
    })
  }

  for (const action of Object.values(CRM_ACTIONS)) {
    catalog.set(action.initiatePermission, {
      id: action.initiatePermission,
      class: action.permissionClass,
      source: 'CRM_ACTION',
    })
    if (action.approvePermission) {
      catalog.set(action.approvePermission, {
        id: action.approvePermission,
        class: action.permissionClass,
        source: 'CRM_ACTION',
      })
    }
  }

  return [...catalog.values()].sort((a, b) => a.id.localeCompare(b.id))
}

export function getPermissionCatalogEntry(permission: string): PermissionCatalogEntry | null {
  return getPermissionCatalog().find(entry => entry.id === permission) || null
}

export function isKnownPermission(permission: string): boolean {
  return getPermissionCatalogEntry(permission) !== null
}
