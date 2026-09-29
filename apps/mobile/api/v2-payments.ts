import { v2Request } from './v2-client'
import { V2PaymentStatus } from './v2-types'

export const v2Payments = {
  start: (jobId: string) =>
    v2Request<{
      success: boolean
      paymentIntentId: string
      checkoutUrl: string
      merchantOrderId: string
    }>(`/api/mobile/v2/jobs/${jobId}/payment`, { method: 'POST' }),

  status: (jobId: string) =>
    v2Request<{ payment: V2PaymentStatus | null }>(`/api/mobile/v2/jobs/${jobId}/payment`),
}
