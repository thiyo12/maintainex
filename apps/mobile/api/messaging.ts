import { request } from './client'
// Conversations & Messages
export const conversations = {
  list: () =>
    request<{ id: string; jobId?: string | null; otherUser: { id: string; name: string; profileImage?: string } | null; lastMessage: any; unreadCount: number; updatedAt: string }[]>('/api/mobile/conversations'),
  create: (data: { participantId: string; jobId?: string; initialMessage?: string }) =>
    request<{ id: string; existing: boolean }>('/api/mobile/conversations', { method: 'POST', body: JSON.stringify(data) }),
  get: (id: string) =>
    request<{ id: string; jobId?: string | null; job?: { id: string; title: string; ref: string; status?: string } | null; participants: any[]; messages: any[] }>(`/api/mobile/conversations/${id}`),
  sendMessage: (conversationId: string, text: string) =>
    request<any>(`/api/mobile/conversations/${conversationId}/messages`, { method: 'POST', body: JSON.stringify({ text }) }),
  getMessages: (conversationId: string, after?: string) =>
    request<any[]>(`/api/mobile/conversations/${conversationId}/messages${after ? `?after=${after}` : ''}`),
}
