import { v2Request } from './v2-client'

export const v2Team = {
  list: () =>
    v2Request<{ members: any[]; pendingInvites: any[] }>('/api/mobile/company/team'),
  invite: (data: { name: string; email?: string; phone?: string; role?: string }) =>
    v2Request<{ success: boolean; invite: any }>('/api/mobile/company/team/invite', { method: 'POST', body: JSON.stringify(data) }),
  acceptInvite: (token: string) =>
    v2Request<{ success: boolean; teamMember: any }>('/api/mobile/company/team/accept', { method: 'POST', body: JSON.stringify({ token }) }),
  remove: (memberId: string) =>
    v2Request<{ success: boolean }>(`/api/mobile/company/team/${memberId}`, { method: 'DELETE' }),
  getMember: (memberId: string) =>
    v2Request<any>(`/api/mobile/company/team/${memberId}`),
}

export const v2Subscription = {
  getPlans: () =>
    v2Request<any[]>('/api/mobile/v2/subscription-plans'),
  getStatus: () =>
    v2Request<{ commissionRate: number; subscriptionStatus: string; subscriptionExpiresAt: string | null; activeSubscription: any | null }>('/api/mobile/company/subscription'),
  subscribe: (planId: string, autoRenew?: boolean) =>
    v2Request<{ success: boolean; subscription: any }>('/api/mobile/company/subscription', { method: 'POST', body: JSON.stringify({ planId, autoRenew }) }),
  cancel: () =>
    v2Request<{ success: boolean }>('/api/mobile/company/subscription', { method: 'DELETE' }),
}
