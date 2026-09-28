import { v2Request } from './v2-client'

export const v2Wallet = {
  get: (role: string) =>
    v2Request<{ wallet: any; transactions: any[] }>(`/api/mobile/v2/wallet?role=${role}`),
  topUp: (amount: number) =>
    v2Request<{ success: boolean; paymentUrl?: string; orderId?: string; method?: string }>('/api/mobile/v2/wallet/topup', { method: 'POST', body: JSON.stringify({ amount }) }),
  withdraw: (amount: number) =>
    v2Request<{ success: boolean; balance: number }>('/api/mobile/v2/wallet', { method: 'POST', body: JSON.stringify({ amount, action: 'WITHDRAW' }) }),
  withdrawPayout: (amount: number) =>
    v2Request<{ id: string; amount: number; status: string; createdAt: string }>('/api/mobile/withdraw', { method: 'POST', body: JSON.stringify({ amount }) }),
}
