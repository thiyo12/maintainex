interface AdminContext {
  id: string
  email: string
  role: string
  province?: string | null
  branchId?: string | null
}

export function canAccessCustomer(admin: AdminContext, customerProvince?: string | null): boolean {
  if (admin.role === 'SUPER_ADMIN') {
    return true
  }
  
  if (!customerProvince) {
    return true
  }
  
  if (admin.province === customerProvince) {
    return true
  }
  
  return false
}

export function canAccessAllCustomers(admin: AdminContext): boolean {
  return admin.role === 'SUPER_ADMIN'
}

export function filterByProvince<T extends { province?: string | null }>(
  items: T[],
  admin: AdminContext
): T[] {
  if (admin.role === 'SUPER_ADMIN') {
    return items
  }
  
  return items.filter(item => !item.province || item.province === admin.province)
}

export function getProvinceFilter(admin: AdminContext): { province?: string } | {} {
  if (admin.role === 'SUPER_ADMIN') {
    return {}
  }
  
  return { province: admin.province || '' }
}

export function hasPermission(admin: AdminContext, permission: string): boolean {
  const permissions: Record<string, string[]> = {
    SUPER_ADMIN: ['*'],
    ADMIN: [
      'customers:read',
      'customers:write',
      'customers:delete',
      'bookings:read',
      'bookings:write',
      'services:read',
      'reports:read',
      'stats:read',
    ],
    PROVINCE_ADMIN: [
      'customers:read',
      'customers:write',
      'bookings:read',
      'bookings:write',
      'reports:read',
      'stats:read',
    ],
    BRANCH_ADMIN: [
      'customers:read',
      'bookings:read',
      'bookings:write',
    ],
  }

  const rolePermissions = permissions[admin.role] || []
  
  if (rolePermissions.includes('*')) {
    return true
  }
  
  return rolePermissions.includes(permission)
}