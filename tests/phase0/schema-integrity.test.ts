import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const SCHEMA_PATH = path.resolve(__dirname, '../../prisma/schema.prisma')
const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8')

function getFieldBlock(modelName: string): string {
  const modelRegex = new RegExp(`model ${modelName} \\{([^}]+)\\}`, 's')
  const match = schema.match(modelRegex)
  if (!match) throw new Error(`Model ${modelName} not found in schema`)
  return match[1]
}

function getFieldNames(block: string): string[] {
  return block
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('//') && !l.startsWith('@@') && !l.startsWith('@'))
    .map((l) => {
      const parts = l.split(/\s+/)
      return parts[0]
    })
    .filter((f) => f && !['model', 'id'].includes(f))
}

function getIndexes(block: string): string[] {
  return block
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('@@index') || l.startsWith('@@unique'))
}

function getFieldLines(block: string): string[] {
  return block
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('//') && !l.startsWith('@@'))
}

describe('Phase 8 Schema Integrity', () => {
  describe('countryCode fields exist with correct defaults', () => {
    const countryCodeModels = [
      { model: 'User', expected: 'countryCode  String    @default("LK")' },
      { model: 'TaskerProfile', expected: 'countryCode   String  @default("LK")' },
      { model: 'CompanyProfile', expected: 'countryCode       String  @default("LK")' },
      { model: 'MarketplaceJob', expected: 'countryCode       String    @default("LK")' },
      { model: 'Payout', expected: 'countryCode    String    @default("LK")' },
      { model: 'CommissionSettlement', expected: 'countryCode      String    @default("LK")' },
    ]

    for (const { model, expected } of countryCodeModels) {
      it(`${model} has countryCode with default "LK"`, () => {
        const block = getFieldBlock(model)
        const lines = getFieldLines(block)
        const match = lines.find((l) => l.includes('countryCode') && l.includes('String'))
        expect(match).toBeDefined()
        expect(match).toContain('@default("LK")')
      })
    }
  })

  describe('currency fields exist with correct defaults', () => {
    const currencyModels = [
      { model: 'JobEscrow', defaultVal: 'LKR' },
      { model: 'FinancialLedger', defaultVal: 'LKR' },
      { model: 'WalletBalance', defaultVal: 'LKR' },
      { model: 'Payout', defaultVal: 'LKR' },
      { model: 'CommissionSettlement', defaultVal: 'LKR' },
    ]

    for (const { model, defaultVal } of currencyModels) {
      it(`${model} has currency field with default "${defaultVal}"`, () => {
        const block = getFieldBlock(model)
        const lines = getFieldLines(block)
        const match = lines.find((l) => l.includes('currency') && l.includes('String'))
        expect(match).toBeDefined()
        expect(match).toContain(`@default("${defaultVal}")`)
      })
    }
  })

  describe('MarketConfig countryCode is unique', () => {
    it('MarketConfig has unique countryCode', () => {
      const block = getFieldBlock('MarketConfig')
      const lines = getFieldLines(block)
      const match = lines.find((l) => l.includes('countryCode') && l.includes('String'))
      expect(match).toBeDefined()
      expect(match).toContain('@unique')
    })

    it('MarketConfig has defaultCurrency field', () => {
      const block = getFieldBlock('MarketConfig')
      const lines = getFieldLines(block)
      const match = lines.find((l) => l.includes('defaultCurrency') && l.includes('String'))
      expect(match).toBeDefined()
    })
  })

  describe('WalletBalance 3-column unique constraint', () => {
    it('WalletBalance has @@unique([walletType, walletId, currency])', () => {
      const block = getFieldBlock('WalletBalance')
      const indexes = getIndexes(block)
      const uniqueMatch = indexes.find(
        (i) => i.includes('walletType') && i.includes('walletId') && i.includes('currency')
      )
      expect(uniqueMatch).toBeDefined()
    })

    it('WalletBalance has walletId and walletType indexes', () => {
      const block = getFieldBlock('WalletBalance')
      const indexes = getIndexes(block)
      expect(indexes.some((i) => i.includes('walletId'))).toBe(true)
      expect(indexes.some((i) => i.includes('walletType'))).toBe(true)
    })
  })

  describe('countryCode indexes exist on core models', () => {
    const indexedModels = [
      'User',
      'TaskerProfile',
      'CompanyProfile',
      'MarketplaceJob',
      'CommissionSettlement',
      'Payout',
    ]

    for (const model of indexedModels) {
      it(`${model} has @@index([countryCode])`, () => {
        const block = getFieldBlock(model)
        const indexes = getIndexes(block)
        const match = indexes.find((i) => i.includes('countryCode'))
        expect(match).toBeDefined()
      })
    }
  })

  describe('no invalid countryCode index on JobQuote', () => {
    it('JobQuote does NOT have @@index([countryCode])', () => {
      const block = getFieldBlock('JobQuote')
      const indexes = getIndexes(block)
      const match = indexes.find((i) => i.includes('countryCode'))
      expect(match).toBeUndefined()
    })
  })

  describe('PayoutRequest has currency field', () => {
    it('PayoutRequest has currency with default "LKR"', () => {
      const block = getFieldBlock('PayoutRequest')
      const lines = getFieldLines(block)
      const match = lines.find((l) => l.includes('currency') && l.includes('String'))
      expect(match).toBeDefined()
      expect(match).toContain('@default("LKR")')
    })
  })

  describe('all 6 countryCode indexes have correct structure', () => {
    it('User countryCode index', () => {
      const block = getFieldBlock('User')
      const indexes = getIndexes(block)
      expect(indexes.some((i) => i === '@@index([countryCode])')).toBe(true)
    })

    it('TaskerProfile countryCode index', () => {
      const block = getFieldBlock('TaskerProfile')
      const indexes = getIndexes(block)
      expect(indexes.some((i) => i === '@@index([countryCode])')).toBe(true)
    })

    it('CompanyProfile countryCode index', () => {
      const block = getFieldBlock('CompanyProfile')
      const indexes = getIndexes(block)
      expect(indexes.some((i) => i === '@@index([countryCode])')).toBe(true)
    })

    it('MarketplaceJob countryCode index', () => {
      const block = getFieldBlock('MarketplaceJob')
      const indexes = getIndexes(block)
      expect(indexes.some((i) => i === '@@index([countryCode])')).toBe(true)
    })

    it('CommissionSettlement countryCode index', () => {
      const block = getFieldBlock('CommissionSettlement')
      const indexes = getIndexes(block)
      expect(indexes.some((i) => i === '@@index([countryCode])')).toBe(true)
    })

    it('Payout countryCode index', () => {
      const block = getFieldBlock('Payout')
      const indexes = getIndexes(block)
      expect(indexes.some((i) => i === '@@index([countryCode])')).toBe(true)
    })
  })
})
