import { request } from './client'
import { Notification } from '../lib/types'

// Notifications
export const notifications = {
  list: () => request<Notification[]>('/api/mobile/notifications'),
  registerPush: (token: string) =>
    request<void>('/api/mobile/notifications', { method: 'POST', body: JSON.stringify({ token }) }),
  unregisterPush: () =>
    request<void>('/api/mobile/notifications', { method: 'DELETE' }),
  markRead: (id: string) =>
    request<void>(`/api/mobile/notifications/${id}`, { method: 'PUT' }),
  markAllRead: () =>
    request<{ success: boolean; updated: number }>('/api/mobile/notifications', { method: 'PUT' }),
  unreadCount: () =>
    request<{ count: number }>('/api/mobile/notifications/unread-count'),
}
