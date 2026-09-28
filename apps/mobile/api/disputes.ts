import { request } from './client'
// Disputes
export const disputes = {
  create: (data: { jobId: string; reason: string; description: string }) =>
    request<{ id: string; status: string }>('/api/mobile/disputes', { method: 'POST', body: JSON.stringify(data) }),
  list: () =>
    request<{ id: string; jobTitle: string; reason: string; status: string; createdAt: string }[]>('/api/mobile/disputes'),
  get: (id: string) =>
    request<any>(`/api/mobile/disputes/${id}`),
}
