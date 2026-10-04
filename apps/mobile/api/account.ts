import { v2Request } from './v2-client'

export type AccountClosurePreflight = {
  canClose: boolean
  alreadyClosed: boolean
  blockers: Array<{
    code: string
    label: string
    count: number
  }>
  outstandingCommission: Array<{
    providerIdentityId: string
    identityType: string
    currency: string
    amountMinor: string
  }>
  closesWithBalance: boolean
}

export const accountLifecycle = {
  closurePreflight: () =>
    v2Request<{ preflight: AccountClosurePreflight }>('/api/mobile/account/close'),

  close: (confirmation: string) =>
    v2Request<{
      success: boolean
      closed: boolean
      closesWithBalance: boolean
      outstandingCommission: AccountClosurePreflight['outstandingCommission']
    }>('/api/mobile/account/close', {
      method: 'POST',
      body: JSON.stringify({ confirmation }),
    }),
}
