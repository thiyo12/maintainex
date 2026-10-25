import { request } from './client'
// Disputes
export const disputes = {
  create: (data: { jobId: string; reason: string; description: string }) =>
    request<{ id: string; status: string }>('/api/mobile/disputes', { method: 'POST', body: JSON.stringify(data) }),
  list: () =>
    request<{ id: string; jobTitle: string; reason: string; status: string; createdAt: string }[]>('/api/mobile/disputes'),
  get: (id: string) =>
    request<{
      id: string
      source: 'MARKETPLACE'
      jobId: string
      status: string
      reason: string
      description: string | null
      resolution: string | null
      resolutionAction: string | null
      caseHistory: Array<{
        id: string
        action: string
        fromState: string | null
        toState: string | null
        appeal: string | null
        resolution: string | null
        resolutionAction: string | null
        createdAt: string
      }>
      job: { id: string; title: string; status: string; countryCode: string; budgetMinor: string }
    }>(`/api/mobile/disputes/${encodeURIComponent(id)}`),
  appeal: (id: string, data: { appeal: string; idempotencyKey: string }) =>
    request<{ disputeId: string; status: string; replayed: boolean; financialEffect: 'NONE'; message: string }>(
      `/api/mobile/disputes/${encodeURIComponent(id)}/appeal`,
      { method: 'POST', body: JSON.stringify(data) },
    ),
  getByJob: (jobId: string) =>
    request<{ id: string; jobId: string; status: string }>(
      `/api/mobile/disputes/by-job/${encodeURIComponent(jobId)}`,
    ),
}
