import { v2Request } from './v2-client'
import { V2Job, V2Quote, SubTask, CustomJobRequest, CustomJobRequestInput, InspectionInput, EvidenceInput, ChangeOrderInput } from './v2-types'

export const v2Locations = {
  get: () => v2Request<{ countries: any[] }>('/api/mobile/v2/locations'),
}

export const v2Jobs = {
  create: (data: any) =>
    v2Request<{ job: V2Job }>('/api/mobile/v2/jobs', { method: 'POST', body: JSON.stringify(data) }),
  list: (params?: string) =>
    v2Request<{ jobs: V2Job[] }>(`/api/mobile/v2/jobs${params ? `?${params}` : ''}`),
  get: (id: string, context?: 'company') =>
    v2Request<{ job: V2Job & { quotes: V2Quote[] } }>(
      `/api/mobile/v2/jobs/${id}${context ? `?context=${context}` : ''}`
    ),
  pollNew: (since: string) =>
    v2Request<{ jobs: V2Job[] }>(`/api/mobile/v2/jobs?role=provider&after=${encodeURIComponent(since)}`),
  getTaskerLocation: (id: string) =>
    v2Request<{ sharing: boolean; location: { providerId: string; latitude: number; longitude: number; updatedAt: string } | null }>(`/api/mobile/taskers/${id}/location`),
}

export const v2JobActions = {
  update: (jobId: string, data: any) =>
    v2Request<{ job: V2Job }>(`/api/mobile/v2/jobs/${jobId}`, { method: 'PATCH', body: JSON.stringify(data) }),

  selectQuote: (jobId: string, quoteId: string) =>
    v2Request<{ success: boolean }>(`/api/mobile/v2/jobs/${jobId}/select-quote`, { method: 'POST', body: JSON.stringify({ quoteId }) }),
  depositEscrow: (jobId: string, amount: number) =>
    v2Request<{ success: boolean }>(`/api/mobile/v2/jobs/${jobId}/escrow`, { method: 'POST', body: JSON.stringify({ amount }) }),
  getEscrow: (jobId: string) =>
    v2Request<{ escrow: any }>(`/api/mobile/v2/jobs/${jobId}/escrow`),
  refundEscrow: (jobId: string) =>
    v2Request<{ success: boolean }>(`/api/mobile/v2/jobs/${jobId}/escrow/refund`, { method: 'POST' }),
  shareAddress: (jobId: string, data: { street?: string; building?: string; apartment?: string; landmark?: string }) =>
    v2Request<{ job: V2Job }>(`/api/mobile/v2/jobs/${jobId}/share-address`, { method: 'POST', body: JSON.stringify(data) }),
  getWorkspace: (jobId: string) =>
    v2Request<{ workspace: any }>(`/api/mobile/v2/jobs/${jobId}/workspace`),
  updateProgress: (jobId: string, progressStatus: string) =>
    v2Request<{ workspace: any }>(`/api/mobile/v2/jobs/${jobId}/workspace`, { method: 'PATCH', body: JSON.stringify({ progressStatus }) }),
  complete: (jobId: string, action: string, reason?: string) =>
    v2Request<{
      success: boolean
      message: string
      commission?: number
      netAmount?: number
    }>(`/api/mobile/v2/jobs/${jobId}/complete`, { method: 'POST', body: JSON.stringify({ action, reason }) }),
  releaseEscrow: (jobId: string) =>
    v2Request<{ success: boolean }>(`/api/mobile/v2/jobs/${jobId}/release-escrow`, { method: 'POST' }),
  confirmCashPayment: (jobId: string) =>
    v2Request<{ success: boolean; commission: number; netAmount: number }>(`/api/mobile/v2/jobs/${jobId}/cash-payment`, { method: 'POST' }),
  createReview: (jobId: string, data: any) =>
    v2Request<{ review: any }>(`/api/mobile/v2/jobs/${jobId}/reviews`, { method: 'POST', body: JSON.stringify(data) }),
  getReviews: (jobId: string) =>
    v2Request<{ reviews: any }>(`/api/mobile/v2/jobs/${jobId}/reviews`),
  dispute: (jobId: string, reason?: string) =>
    v2Request<{ success: boolean; message: string }>(
      `/api/mobile/v2/jobs/${jobId}/complete`,
      { method: 'POST', body: JSON.stringify({ action: 'DISPUTE', reason }) },
    ),
  getPinState: (jobId: string) =>
    v2Request<{
      pinState: {
        hasActivePin: boolean
        version: number | null
        locked: boolean
        lastSuccessfulUseAt: string | null
        arrivalVerifiedAt: string | null
        workStartVerifiedAt: string | null
        completionVerifiedAt: string | null
      }
    }>(`/api/mobile/v2/jobs/${jobId}/pin`),
  generatePin: (jobId: string) =>
    v2Request<{ success: boolean; pin: string; version: number }>(`/api/mobile/v2/jobs/${jobId}/pin`, { method: 'POST' }),
  rotatePin: (jobId: string) =>
    v2Request<{ success: boolean; pin: string; version: number }>(`/api/mobile/v2/jobs/${jobId}/pin/rotate`, { method: 'POST' }),
  revokePin: (jobId: string) =>
    v2Request<{ success: boolean }>(`/api/mobile/v2/jobs/${jobId}/pin/revoke`, { method: 'POST' }),
  verifyPin: (jobId: string, pin: string, purpose: string) =>
    v2Request<{ success: boolean; purpose: string }>(`/api/mobile/v2/jobs/${jobId}/pin/verify`, { method: 'POST', body: JSON.stringify({ pin, purpose }) }),
  getCustomerStatus: (jobId: string) =>
    v2Request<{ status: any }>(`/api/mobile/v2/jobs/${jobId}/customer-status`),
}

export const v2Match = {
  getProviders: (jobId: string) =>
    v2Request<{ providers: any[] }>(`/api/mobile/v2/match/${jobId}`),
}

export const v2SubTasks = {
  getByCategory: (categoryId: string, categoryName?: string) =>
    v2Request<{ categoryId: string; subTasks: SubTask[] }>(
      `/api/mobile/v2/subtasks?categoryId=${encodeURIComponent(categoryId)}${categoryName ? `&categoryName=${encodeURIComponent(categoryName)}` : ''}`
    ),
}

export const v2CustomJobs = {
  submit: (input: CustomJobRequestInput) =>
    v2Request<{ request: any }>('/api/mobile/v2/custom-jobs', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  list: () =>
    v2Request<{ requests: CustomJobRequest[] }>('/api/mobile/v2/custom-jobs'),
}

export const v2Inspection = {
  create: (jobId: string, data?: InspectionInput) =>
    v2Request<{ success: boolean; inspectionId: string }>(
      `/api/mobile/v2/jobs/${jobId}/inspection`,
      { method: 'POST', body: JSON.stringify(data || {}) },
    ),
}

export const v2Evidence = {
  create: (jobId: string, data: EvidenceInput) =>
    v2Request<{ success: boolean; evidenceId: string }>(
      `/api/mobile/v2/jobs/${jobId}/evidence`,
      { method: 'POST', body: JSON.stringify(data) },
    ),
}

export const v2ChangeOrder = {
  create: (jobId: string, data: ChangeOrderInput) =>
    v2Request<{ success: boolean; changeOrderId: string }>(
      `/api/mobile/v2/jobs/${jobId}/change-orders`,
      { method: 'POST', body: JSON.stringify(data) },
    ),
}
