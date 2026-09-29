import { request } from './client'
// Earnings & Payouts
export const earnings = {
  get: () => request<any>('/api/mobile/earnings'),
  withdraw: (amount: number) =>
    request<any>('/api/mobile/withdraw', { method: 'POST', body: JSON.stringify({ amount }) }),
}
