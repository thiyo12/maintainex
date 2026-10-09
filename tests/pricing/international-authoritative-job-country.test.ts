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

  it('rejects a service template from another country', async () => {
    const db = client('CA')
    db.marketplaceJob.findUnique = async () => ({
      categoryId, serviceTemplateId: 'template-1', countryCode: 'CA',
    })
    db.serviceTemplate = {
      findUnique: async () => ({
        id: 'template-1', jobCategoryId: categoryId, templateJobId: null,
        countryCode: 'LK', currency: 'LKR',
      }),
    }
    await expect(validatePricingIdentifiers(db, {
      jobId, categoryId, serviceTemplateId: 'template-1',
    })).rejects.toThrow('Service template country does not match job country')
  })

  it('rejects an LKR-priced template on a Canadian job even with CA country metadata', async () => {
    const db = client('CA')
    db.marketplaceJob.findUnique = async () => ({
      categoryId, serviceTemplateId: 'template-1', countryCode: 'CA',
    })
    db.serviceTemplate = {
      findUnique: async () => ({
        id: 'template-1', jobCategoryId: categoryId, templateJobId: null,
        countryCode: 'CA', currency: 'LKR',
      }),
    }
    await expect(validatePricingIdentifiers(db, {
      jobId, categoryId, serviceTemplateId: 'template-1',
    })).rejects.toThrow('Service template currency does not match job country')
  })

  it('allows matching supplied job market', async () => {
    await expect(validatePricingIdentifiers(client('LK'), {
      jobId, categoryId, countryCode: 'LK',
    })).resolves.toMatchObject({ countryCode: 'LK' })
  })
})
