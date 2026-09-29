import { v2Request } from './v2-client'
import { PriceEstimate, SmartTemplate, SmartPriceEstimate } from './v2-types'

export const v2Pricing = {
  getEstimate: (data: {
    categoryId: string
    categoryName?: string
    description: string
    title?: string
    areaId?: string
    cityId?: string
    countryCode?: string
    urgency?: string
    preferredDate?: string
    preferredTime?: string
    estimatedDuration?: number
    workersCount?: number
    materialHandling?: 'tasker_brings' | 'customer_provides' | 'quote_both'
  }) => v2Request<PriceEstimate>('/api/mobile/v2/pricing/estimate', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  getMaterials: (data: {
    categoryId: string
    description: string
    title?: string
    countryCode?: string
  }) => v2Request<{
    materials: { name: string; quantity: number; unit: string; unitPrice: number; totalPrice: number; source: string }[]
    totalMaterialCost: number
    labourRange: { min: number; max: number }
    currency: string
    symbol: string
    confidence: string
    hasMaterials: boolean
  }>('/api/mobile/v2/pricing/materials', {
    method: 'POST',
    body: JSON.stringify(data),
  }),
}

export const v2SmartBooking = {
  templates: (jobCategoryId?: string) =>
    v2Request<SmartTemplate[]>(
      `/api/mobile/v2/service-templates${jobCategoryId ? `?jobCategoryId=${encodeURIComponent(jobCategoryId)}` : ''}`
    ),
  priceEstimate: (data: {
    templateId: string
    answers: Record<string, any>
    countryCode?: string
    urgency?: string
    durationMinutes?: number
    city?: string
    scheduledFor?: string
  }) =>
    v2Request<SmartPriceEstimate>('/api/mobile/v2/price-estimate', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}
