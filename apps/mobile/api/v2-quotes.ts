import { v2Request } from './v2-client'
import { V2Quote } from './v2-types'

export const v2Quotes = {
  submit: (data: { jobId: string; providerType: string; price: number; estimatedCompletionTime?: string; message?: string; companyId?: string }) =>
    v2Request<{ quote: V2Quote }>('/api/mobile/v2/quotes', { method: 'POST', body: JSON.stringify(data) }),
  list: (jobId: string, companyId?: string) =>
    v2Request<{ quotes: V2Quote[] }>(
      `/api/mobile/v2/quotes?jobId=${encodeURIComponent(jobId)}${companyId ? `&companyId=${encodeURIComponent(companyId)}` : ''}`
    ),
  revise: (
    quoteId: string,
    data: {
      price: number
      estimatedCompletionTime: string
      message?: string
      revisionReason: string
      companyId?: string
    }
  ) =>
    v2Request<{ success: boolean; newQuoteId: string; revisionNumber: number }>(
      `/api/mobile/v2/quotes/${quoteId}/revision`,
      { method: 'POST', body: JSON.stringify(data) },
    ),
}
