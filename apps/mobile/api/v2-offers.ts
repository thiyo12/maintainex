import { v2Request } from './v2-client'

// Offer Program API — for managing promotional offers that taskers/companies can opt into
// TODO: Replace with dedicated endpoints (/api/mobile/v2/offer-templates, /api/mobile/offer-enrollments, /api/mobile/offer-bookings)
export const offerProgram = {
  listTemplates: () =>
    v2Request<{ offers: any[] }>('/api/mobile/v2/jobs?category=offers'),

  enroll: (variant: 'tasker' | 'company', id: string) =>
    v2Request<{ success: boolean }>('/api/mobile/quick-bookings', {
      method: 'POST',
      body: JSON.stringify({ variant, id }),
    }),

  unenroll: (variant: 'tasker' | 'company') =>
    v2Request<{ success: boolean }>('/api/mobile/quick-bookings', {
      method: 'POST',
      body: JSON.stringify({ action: 'unenroll', variant }),
    }),

  createBooking: (data: {
    jobId: string
    taskerId: string
    date: string
    timeSlot: string
    address: string
    district: string
    notes?: string
  }) =>
    v2Request<{ id: string; status: string }>('/api/mobile/quick-bookings', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}
