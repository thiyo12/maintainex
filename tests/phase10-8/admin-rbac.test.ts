import { describe, it, expect } from 'vitest'
import {
  ROLE_PERMISSIONS,
  type AuditAction,
} from '../../lib/admin-types'

describe('Phase 10.8 — RBAC & Permissions', () => {
  const ALL_ROLES = ['SUPER_ADMIN', 'MANAGER', 'FINANCE', 'USER_MANAGEMENT', 'SUPPORT', 'TECHNICAL']

  it('all 6 roles have defined permission arrays', () => {
    for (const role of ALL_ROLES) {
      expect(ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS]).toBeDefined()
      expect(Array.isArray(ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS])).toBe(true)
    }
  })

  it('SUPER_ADMIN has all Phase 10.8 permissions', () => {
    const perms = ROLE_PERMISSIONS['SUPER_ADMIN']
    expect(perms).toContain('users:view')
    expect(perms).toContain('users:edit')
    expect(perms).toContain('users:suspend')
    expect(perms).toContain('companies:edit')
    expect(perms).toContain('credentials:read')
    expect(perms).toContain('credentials:write')
    expect(perms).toContain('risk_events:read')
    expect(perms).toContain('risk_events:resolve')
    expect(perms).toContain('pricing_config:read')
    expect(perms).toContain('pricing_config:write')
    expect(perms).toContain('market_config:read')
    expect(perms).toContain('market_config:write')
    expect(perms).toContain('audit:read')
    expect(perms).toContain('professions:read')
    expect(perms).toContain('professions:write')
  })

  it('MANAGER has trust & safety permissions', () => {
    const perms = ROLE_PERMISSIONS['MANAGER']
    expect(perms).toContain('credentials:read')
    expect(perms).toContain('credentials:write')
    expect(perms).toContain('risk_events:read')
    expect(perms).toContain('risk_events:resolve')
    expect(perms).toContain('companies:edit')
    expect(perms).toContain('professions:read')
    expect(perms).toContain('professions:write')
  })

  it('FINANCE has pricing permissions', () => {
    const perms = ROLE_PERMISSIONS['FINANCE']
    expect(perms).toContain('pricing_config:read')
    expect(perms).toContain('pricing_config:write')
    expect(perms).toContain('market_config:read')
    expect(perms).toContain('market_config:write')
    expect(perms).toContain('audit:read')
  })

  it('USER_MANAGEMENT has user/credential permissions', () => {
    const perms = ROLE_PERMISSIONS['USER_MANAGEMENT']
    expect(perms).toContain('users:view')
    expect(perms).toContain('users:edit')
    expect(perms).toContain('users:suspend')
    expect(perms).toContain('credentials:read')
    expect(perms).toContain('credentials:write')
    expect(perms).toContain('risk_events:read')
    expect(perms).toContain('risk_events:resolve')
    expect(perms).toContain('audit:read')
  })

  it('SUPPORT has risk event read and audit permissions', () => {
    const perms = ROLE_PERMISSIONS['SUPPORT']
    expect(perms).toContain('risk_events:read')
    expect(perms).toContain('audit:read')
    expect(perms).toContain('disputes:resolve')
  })

  it('TECHNICAL has audit read permission', () => {
    const perms = ROLE_PERMISSIONS['TECHNICAL']
    expect(perms).toContain('audit:read')
    expect(perms).toContain('security:view')
  })

  it('Phase 10.8 audit actions exist in AuditAction type', () => {
    const requiredActions: AuditAction[] = [
      'CREDENTIAL_APPROVE', 'CREDENTIAL_REJECT', 'CREDENTIAL_EXPIRE', 'CREDENTIAL_REVOKE',
      'PROFESSION_APPROVE', 'PROFESSION_REJECT', 'PROFESSION_DEACTIVATE',
      'RISK_EVENT_REVIEW', 'RISK_EVENT_RESOLVE', 'RISK_EVENT_DISMISS', 'RISK_EVENT_ESCALATE',
      'PRICING_CONFIG_UPDATE',
      'MARKET_CONFIG_UPDATE',
      'PROVIDER_SUSPEND', 'PROVIDER_REACTIVATE',
      'COMPANY_SUSPEND', 'COMPANY_REACTIVATE',
    ]
    expect(requiredActions.length).toBe(17)
    for (const action of requiredActions) {
      expect(typeof action).toBe('string')
    }
  })

  it('MANAGER does not have users:suspend (only USER_MANAGEMENT does)', () => {
    const managerPerms = ROLE_PERMISSIONS['MANAGER']
    expect(managerPerms).not.toContain('users:suspend')
    expect(managerPerms).not.toContain('users:ban')
  })

  it('SUPPORT does not have risk_events:resolve (read-only)', () => {
    const supportPerms = ROLE_PERMISSIONS['SUPPORT']
    expect(supportPerms).toContain('risk_events:read')
    expect(supportPerms).not.toContain('risk_events:resolve')
  })
})
