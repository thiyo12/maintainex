import { ROLE_PERMISSIONS, type AdminRole } from '@/lib/admin-types'
import type { PermissionClass } from './types'

export type PermissionOverrideEffect = 'ALLOW' | 'DENY'

export interface PermissionOverride {
  permission: string
  effect: PermissionOverrideEffect
}

export interface EffectivePermissionInput {
  role: AdminRole
  permission: string
  permissionClass?: PermissionClass
  overrides?: readonly PermissionOverride[]
}

export interface EffectivePermissionResult {
  allowed: boolean
  source: 'SYSTEM_ONLY' | 'OWNER_ONLY' | 'EXPLICIT_DENY' | 'EXPLICIT_ALLOW' | 'ROLE_TEMPLATE' | 'ACTION_ROLE_TEMPLATE' | 'NONE'
}

export function evaluateEffectivePermission(input: EffectivePermissionInput): EffectivePermissionResult {
  const permissionClass = input.permissionClass || 'NORMAL'

  if (permissionClass === 'SYSTEM_ONLY') {
    return { allowed: false, source: 'SYSTEM_ONLY' }
  }

  if (permissionClass === 'OWNER_ONLY') {
    return input.role === 'SUPER_ADMIN'
      ? { allowed: true, source: 'OWNER_ONLY' }
      : { allowed: false, source: 'OWNER_ONLY' }
  }

  const exactOverride = input.overrides?.find(item => item.permission === input.permission)
  if (exactOverride?.effect === 'DENY') {
    return { allowed: false, source: 'EXPLICIT_DENY' }
  }

  if (exactOverride?.effect === 'ALLOW') {
    return { allowed: true, source: 'EXPLICIT_ALLOW' }
  }

  if (ROLE_PERMISSIONS[input.role]?.includes(input.permission)) {
    return { allowed: true, source: 'ROLE_TEMPLATE' }
  }

  return { allowed: false, source: 'NONE' }
}

export function canDelegatePermissionClass(role: AdminRole, permissionClass: PermissionClass): boolean {
  if (permissionClass === 'SYSTEM_ONLY' || permissionClass === 'OWNER_ONLY') return false
  if (role === 'SUPER_ADMIN') return true
  if (role === 'MANAGER') return permissionClass === 'NORMAL' || permissionClass === 'READ'
  return false
}

export function validatePermissionOverrides(
  overrides: readonly PermissionOverride[]
): { valid: boolean; reason?: string } {
  const seen = new Set<string>()

  for (const item of overrides) {
    if (!item.permission || item.permission.length > 160) {
      return { valid: false, reason: 'Invalid permission identifier.' }
    }
    if (item.effect !== 'ALLOW' && item.effect !== 'DENY') {
      return { valid: false, reason: 'Invalid permission effect.' }
    }
    if (seen.has(item.permission)) {
      return { valid: false, reason: 'Duplicate permission override.' }
    }
    seen.add(item.permission)
  }

  return { valid: true }
}

import { getCrmAction } from './action-registry'
import type { CrmActionId } from './types'

export function evaluateActionInitiation(input: {
  role: AdminRole
  actionId: CrmActionId
  overrides?: readonly PermissionOverride[]
}): EffectivePermissionResult {
  const action = getCrmAction(input.actionId)

  if (action.permissionClass === 'SYSTEM_ONLY') {
    return { allowed: false, source: 'SYSTEM_ONLY' }
  }

  if (action.permissionClass === 'OWNER_ONLY') {
    return input.role === 'SUPER_ADMIN'
      ? { allowed: true, source: 'OWNER_ONLY' }
      : { allowed: false, source: 'OWNER_ONLY' }
  }

  const exactOverride = input.overrides?.find(item => item.permission === action.initiatePermission)
  if (exactOverride?.effect === 'DENY') {
    return { allowed: false, source: 'EXPLICIT_DENY' }
  }
  if (exactOverride?.effect === 'ALLOW') {
    return { allowed: true, source: 'EXPLICIT_ALLOW' }
  }

  if (action.initiatorRoles.includes(input.role)) {
    return { allowed: true, source: 'ACTION_ROLE_TEMPLATE' }
  }

  return { allowed: false, source: 'NONE' }
}
