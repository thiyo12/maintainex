import { request } from './client'
import { TaskerProfile, Review } from '../lib/types'

// Taskers
export const taskers = {
  list: (params?: string) =>
    request<TaskerProfile[]>(`/api/mobile/taskers${params ? `?${params}` : ''}`),
  get: (id: string) => request<TaskerProfile>(`/api/mobile/taskers/${id}`),
  updateProfile: (data: any) =>
    request<TaskerProfile>('/api/mobile/taskers/profile', { method: 'PUT', body: JSON.stringify(data) }),
  getMyProfile: () =>
    request<TaskerProfile>('/api/mobile/taskers/profile'),
  updateLocation: (data: { latitude: number; longitude: number }) =>
    request<void>('/api/mobile/taskers/location', { method: 'PUT', body: JSON.stringify(data) }),
  setOnline: (isOnline: boolean) =>
    request<void>('/api/mobile/taskers/status', { method: 'PUT', body: JSON.stringify({ isOnline }) }),
  reviews: (taskerId: string) =>
    request<Review[]>(`/api/mobile/taskers/${taskerId}/reviews`),
}
export const skillsApi = {
  list: () => request<any[]>('/api/mobile/taskers/skills'),
  save: (data: any[]) =>
    request<{ saved: number }>('/api/mobile/taskers/skills', { method: 'PUT', body: JSON.stringify({ skills: data }) }),
}
