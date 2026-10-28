import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseWorkerCount } from '@/lib/domain/worker-count'

describe('Phase 04 — canonical company job workforce count', () => {
  it.each([1, 2, 10, '1', '3', ' 12 '])(
    'accepts positive integral worker-count input: %s', value => {
      expect(parseWorkerCount(value)).toBe(Number(value))
    },
  )

  it.each([
    0, -1, 1.5, NaN, Infinity, true, false, null, undefined, {},
    '', ' ', '0', '-1', '1.5', '1e3', 'abc', '2147483648',
    2_147_483_648, 9_007_199_254_740_992,
  ])('refuses invalid, unsafe or ambiguous worker-count input: %s', value => {
    expect(parseWorkerCount(value)).toBeNull()
  })

  it('validates before create-job pricing and persistence', () => {
    const src = readFileSync(resolve(process.cwd(), 'app/api/mobile/v2/jobs/route.ts'), 'utf8')
    const validate = src.indexOf('const validatedWorkerCount = workersCount == null ? 1 : parseWorkerCount(workersCount)')
    const estimate = src.indexOf('const estimate = await calculatePrice')
    const insert = src.indexOf('prisma.marketplaceJob.create({ data: jobData })')
    expect(validate).toBeGreaterThan(0)
    expect(estimate).toBeGreaterThan(validate)
    expect(insert).toBeGreaterThan(estimate)
    expect(src).toContain('quantity: workersCount,')
    expect(src).toContain('workersCount,\n        status:')
    expect(src).not.toContain('Math.max(1, Number(workersCount))')
  })

  it('rejects invalid edits before opening a database write transaction', () => {
    const src = readFileSync(resolve(process.cwd(), 'app/api/mobile/v2/jobs/[id]/route.ts'), 'utf8')
    const check = src.indexOf('const validatedWorkerCount = parseWorkerCount(data.workersCount)')
    const transaction = src.indexOf('const updated = await prisma.$transaction')
    expect(check).toBeGreaterThan(0)
    expect(transaction).toBeGreaterThan(check)
    expect(src).toContain('data.workersCount = validatedWorkerCount')
  })
})
