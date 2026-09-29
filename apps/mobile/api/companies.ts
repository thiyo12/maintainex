import { request } from './client'

// Resolve the user's active company membership. This works for owners,
// managers, dispatchers, and workers without changing their global account role.
export type ActiveCompanyContext = {
  companyId: string
  role: 'COMPANY_OWNER' | 'MANAGER' | 'DISPATCHER' | 'WORKER' | 'FINANCE'
  membershipId: string
}

export async function getActiveCompanyContext(): Promise<ActiveCompanyContext | null> {
  try {
    return await request<ActiveCompanyContext>('/api/mobile/company/context')
  } catch {
    return null
  }
}

export async function getActiveCompanyId(): Promise<string | null> {
  const context = await getActiveCompanyContext()
  return context?.companyId || null
}

// Company
export const company = {
  profile: {
    get: () => request<any>('/api/mobile/company/profile'),
    update: (data: any) => request<any>('/api/mobile/company/profile', { method: 'PUT', body: JSON.stringify(data) }),
  },
  contracts: {
    list: (params?: string) =>
      request<any[]>(`/api/mobile/company/contracts${params ? `?${params}` : ''}`),
    get: (id: string) => request<any>(`/api/mobile/company/contracts/${id}`),
    update: (id: string, data: any) =>
      request<any>(`/api/mobile/company/contracts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  },
  milestones: {
    list: (params?: string) =>
      request<any[]>(`/api/mobile/company/milestones${params ? `?${params}` : ''}`),
  },
  team: {
    list: () => request<any[]>('/api/mobile/company/team'),
  },
  earnings: {
    get: (period?: string) => request<any>(`/api/mobile/company/earnings${period ? `?period=${period}` : ''}`),
  },
}
