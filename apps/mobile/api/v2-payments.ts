import { v2Request } from './v2-client'
import { V2PaymentOptions, V2PaymentStatus } from './v2-types'

export const v2Payments = {
  start: (jobId: string) =>
    v2Request<{
      success: boolean
      paymentIntentId: string
      checkoutUrl: string
      merchantOrderId: string
      gateway: string
    }>(`/api/mobile/v2/jobs/${jobId}/payment`, { method: 'POST' }),

  status: (jobId: string) =>
    v2Request<{ payment: V2PaymentStatus | null; options: V2PaymentOptions }>(`/api/mobile/v2/jobs/${jobId}/payment`),

  // Canonical availability contract. Online payment is only offered when the
  // deployment actually has a configured provider, so a cash-only deployment
  // never shows an online option the server would reject.
  availability: () =>
    v2Request<{
      onlinePaymentAvailable: boolean
      provider: 'PAYPAL' | null
      reason: 'not_configured' | 'available'
      cashAvailable: boolean
    }>('/api/mobile/v2/payments/availability'),
}
