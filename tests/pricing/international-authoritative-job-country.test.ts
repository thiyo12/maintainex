import { describe, expect, it } from 'vitest'
import { PricingInputError, validatePricingIdentifiers } from '@/lib/pricing/engine'

const categoryId = 'category-1'
const jobId = 'job-1'

function client(countryCode: string) {
  return {
    marketplaceJob: {
      findUnique: async () => ({ categoryId, serviceTemplateId: null, countryCode }),
    },
    jobCategory: {
      findUnique: async () => ({ id: categoryId }),
    },
  } as any
}

describe('authoritative pricing job market', () => {
  it('rejects caller-supplied market different from persisted job', async () => {
    await expect(validatePricingIdentifiers(client('LK'), {
      jobId, categoryId, countryCode: 'CA',
    })).rejects.toThrow(PricingInputError)
  })

  it('resolves job market from the persisted record', async () => {
    await expect(validatePricingIdentifiers(client('CA'), {
      jobId, categoryId,
    })).resolves.toMatchObject({ countryCode: 'CA', categoryId })
  })

  it('allows matching supplied job market', async () => {
    await expect(validatePricingIdentifiers(client('LK'), {
      jobId, categoryId, countryCode: 'LK',
    })).resolves.toMatchObject({ countryCode: 'LK' })
  })
})
