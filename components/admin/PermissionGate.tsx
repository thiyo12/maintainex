'use client'

import type { AdminRole } from '@/lib/admin-types'
import { can } from '@/lib/permissions'
import { useAuthStore } from '@/lib/auth-store'

export function PermissionGate({
  roles,
  children,
  fallback = null,
}: {
  roles: AdminRole[]
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  const adminUser = useAuthStore((s) => s.adminUser)
  if (!adminUser || !can(adminUser.role, roles)) return fallback
  return <>{children}</>
}

export function ShowForRole({
  role,
  children,
}: {
  role: AdminRole
  children: React.ReactNode
}) {
  return <PermissionGate roles={[role]}>{children}</PermissionGate>
}
