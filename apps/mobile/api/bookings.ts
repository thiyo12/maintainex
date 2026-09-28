import { request } from './client'
import { Booking, QuickBooking, QuickBookingInput } from '../lib/types'

// Bookings
export const bookings = {
  create: (data: any) =>
    request<{ booking: Booking }>('/api/mobile/bookings', { method: 'POST', body: JSON.stringify(data) }),
  list: (params?: string) =>
    request<Booking[]>(`/api/mobile/bookings${params ? `?${params}` : ''}`),
  get: (id: string) => request<Booking>(`/api/mobile/bookings/${id}`),
}

export const quickBookings = {
  create: (data: QuickBookingInput) =>
    request<QuickBooking>('/api/mobile/quick-bookings', { method: 'POST', body: JSON.stringify(data) }),
  get: (id: string) =>
    request<QuickBooking>(`/api/mobile/quick-bookings/${id}`),
}
