'use client'

import { useAuthStore } from '@/lib/auth-store'

export function CountryScopeBadge() {
  const adminUser = useAuthStore((s) => s.adminUser)
  if (!adminUser) return null
  if (adminUser.role === 'SUPER_ADMIN') return null

  const countries = adminUser.assignedCountries
  if (countries.length === 0) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
        No countries assigned
      </span>
    )
  }

  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
      {countries.join(', ')}
    </span>
  )
}
