import { v2Request } from './v2-client'
import { AvailabilityResult, QualityResult, TrustResult, ScheduleRecommendation, TaskerProfileResult } from './v2-types'

export const v2Availability = {
  get: (providerId?: string) =>
    v2Request<AvailabilityResult>(
      `/api/mobile/v2/availability${providerId ? `?providerId=${providerId}` : ''}`
    ),
  update: (data: {
    monday?: boolean; tuesday?: boolean; wednesday?: boolean;
    thursday?: boolean; friday?: boolean; saturday?: boolean; sunday?: boolean;
    startTime?: string; endTime?: string; isAvailable?: boolean;
  }) => v2Request<{ success: boolean }>('/api/mobile/v2/availability', {
    method: 'PUT', body: JSON.stringify(data),
  }),
}

export const v2Quality = {
  get: (providerId?: string) =>
    v2Request<QualityResult>(
      `/api/mobile/v2/quality${providerId ? `?providerId=${providerId}` : ''}`
    ),
}

export const v2Trust = {
  get: (customerId?: string) =>
    v2Request<TrustResult>(
      `/api/mobile/v2/trust${customerId ? `?customerId=${customerId}` : ''}`
    ),
}

export const v2Schedule = {
  recommend: () =>
    v2Request<{ suggestedJobs: ScheduleRecommendation[]; totalEstimatedEarning: number; totalTravelKm: number }>(
      '/api/mobile/v2/schedule?action=recommend'
    ),
  cluster: () =>
    v2Request<{ clusters: any[] }>('/api/mobile/v2/schedule?action=cluster'),
}

export const v2TaskerProfile = {
  get: () =>
    v2Request<TaskerProfileResult>('/api/mobile/taskers/profile'),
  update: (data: Record<string, any>) =>
    v2Request<{ success: boolean }>('/api/mobile/taskers/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
}
