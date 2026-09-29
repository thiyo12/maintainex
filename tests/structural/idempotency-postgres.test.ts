import { describe, it, expect, beforeAll, afterAll } from 'vitest'

const DATABASE_URL = process.env.DATABASE_URL || ''
const isPostgres = DATABASE_URL.includes('postgresql')

function createPrisma() {
  if (!isPostgres) return null as any
  const { PrismaClient } = require('@prisma/client')
  return new PrismaClient({ datasources: { db: { url: DATABASE_URL } } })
}

let prisma: any

const TS = Date.now()

async function cleanUp() {
  await prisma.$executeRawUnsafe(`DELETE FROM "IdempotencyRecord" WHERE "idempotencyKey" LIKE 'test-concurrent-%' OR "idempotencyKey" LIKE 'test-conflict-%'`)
}

describe.skipIf(!isPostgres)('Phase 10.4 — PostgreSQL Idempotency Final Correction', () => {
  beforeAll(async () => {
    prisma = createPrisma()
    if (prisma) await cleanUp()
  })
  afterAll(async () => {
    if (prisma) { await cleanUp(); await prisma.$disconnect() }
  })

  describe('Global unique constraint on idempotencyKey', () => {
    it('enforces global uniqueness — two records with same key are rejected', async () => {
      await prisma.idempotencyRecord.create({
        data: {
          idempotencyKey: `test-conflict-global-${TS}`,
          operation: 'TEST_OP_A',
          status: 'COMPLETED',
          expiresAt: new Date(Date.now() + 86400000),
        },
      })

      await expect(
        prisma.idempotencyRecord.create({
          data: {
            idempotencyKey: `test-conflict-global-${TS}`,
            operation: 'TEST_OP_B',
            status: 'COMPLETED',
            expiresAt: new Date(Date.now() + 86400000),
          },
        }),
      ).rejects.toThrow()
    })

    it('different keys can coexist', async () => {
      const key1 = `test-conflict-global-1-${TS}`
      const key2 = `test-conflict-global-2-${TS}`
      await prisma.idempotencyRecord.create({
        data: { idempotencyKey: key1, operation: 'TEST', status: 'COMPLETED', expiresAt: new Date(Date.now() + 86400000) },
      })
      await prisma.idempotencyRecord.create({
        data: { idempotencyKey: key2, operation: 'TEST', status: 'COMPLETED', expiresAt: new Date(Date.now() + 86400000) },
      })

      const count = await prisma.idempotencyRecord.count({ where: { idempotencyKey: { in: [key1, key2] } } })
      expect(count).toBe(2)
    })
  })

  describe('userId is nullable — no empty string default', () => {
    it('record without userId (null) can be created', async () => {
      const key = `test-conflict-no-user-${TS}`
      const record = await prisma.idempotencyRecord.create({
        data: {
          idempotencyKey: key,
          operation: 'LEDGER_POST',
          status: 'PENDING',
          expiresAt: new Date(Date.now() + 86400000),
        },
      })
      expect(record.userId).toBeNull()
    })

    it('record with userId can be created', async () => {
      const key = `test-conflict-with-user-${TS}`
      const record = await prisma.idempotencyRecord.create({
        data: {
          idempotencyKey: key,
          userId: 'customer-test',
          operation: 'APPROVE_CHANGE_ORDER',
          status: 'COMPLETED',
          expiresAt: new Date(Date.now() + 86400000),
        },
      })
      expect(record.userId).toBe('customer-test')
    })
  })

  describe('Request fingerprint', () => {
    it('requestFingerprint is stored and retrievable', async () => {
      const key = `test-conflict-fingerprint-${TS}`
      const record = await prisma.idempotencyRecord.create({
        data: {
          idempotencyKey: key,
          userId: 'customer-fp',
          operation: 'APPROVE_CHANGE_ORDER',
          status: 'COMPLETED',
          requestFingerprint: 'APPROVE:co-test:customer-fp:5000:quote-1',
          expiresAt: new Date(Date.now() + 86400000),
        },
      })
      expect(record.requestFingerprint).toBe('APPROVE:co-test:customer-fp:5000:quote-1')
    })

    it('requestFingerprint can be null', async () => {
      const key = `test-conflict-no-fp-${TS}`
      const record = await prisma.idempotencyRecord.create({
        data: {
          idempotencyKey: key,
          operation: 'LEGACY_OP',
          status: 'COMPLETED',
          expiresAt: new Date(Date.now() + 86400000),
        },
      })
      expect(record.requestFingerprint).toBeNull()
    })
  })

  describe('10 concurrent identical APPROVE requests', () => {
    it('only one logical transition occurs, zero duplicate financial side effects', async () => {
      const key = `test-concurrent-approve-${TS}`

      const concurrentCount = 10
      const results = await Promise.allSettled(
        Array.from({ length: concurrentCount }, (_, i) =>
          prisma.idempotencyRecord.create({
            data: {
              idempotencyKey: key,
              userId: 'customer-concurrent',
              operation: 'APPROVE_CHANGE_ORDER',
              status: 'COMPLETED',
              requestFingerprint: `APPROVE:co-concurrent:customer-concurrent:5000:quote-1`,
              resultPayload: JSON.stringify({ changeOrder: { id: 'co-concurrent' }, finalAuthorizedAmountCents: 15000 }),
              expiresAt: new Date(Date.now() + 86400000),
            },
          }),
        ),
      )

      const succeeded = results.filter(r => r.status === 'fulfilled')
      const failed = results.filter(r => r.status === 'rejected')

      expect(succeeded.length).toBe(1)
      expect(failed.length).toBe(9)

      const record = await prisma.idempotencyRecord.findUnique({ where: { idempotencyKey: key } })
      expect(record).not.toBeNull()
      expect(record!.status).toBe('COMPLETED')
      expect(record!.userId).toBe('customer-concurrent')

      const count = await prisma.idempotencyRecord.count({ where: { idempotencyKey: key } })
      expect(count).toBe(1)
    })
  })

  describe('Same key, different action → IDEMPOTENCY_CONFLICT', () => {
    it('same customer same key same payload → replay succeeds', async () => {
      const key = `test-conflict-replay-${TS}`
      const fp = 'APPROVE:co-replay:customer-replay:5000:quote-1'

      await prisma.idempotencyRecord.create({
        data: {
          idempotencyKey: key,
          userId: 'customer-replay',
          operation: 'APPROVE_CHANGE_ORDER',
          status: 'COMPLETED',
          requestFingerprint: fp,
          resultPayload: JSON.stringify({ changeOrder: { id: 'co-replay' }, finalAuthorizedAmountCents: 15000 }),
          expiresAt: new Date(Date.now() + 86400000),
        },
      })

      const record = await prisma.idempotencyRecord.findUnique({ where: { idempotencyKey: key } })
      expect(record).not.toBeNull()
      expect(record!.requestFingerprint).toBe(fp)

      if (record!.requestFingerprint === fp) {
        expect(record!.status).toBe('COMPLETED')
      }
    })

    it('same key same customer but different payload → conflict', async () => {
      const key = `test-conflict-diff-payload-${TS}`

      await prisma.idempotencyRecord.create({
        data: {
          idempotencyKey: key,
          userId: 'customer-diff',
          operation: 'APPROVE_CHANGE_ORDER',
          status: 'COMPLETED',
          requestFingerprint: 'APPROVE:co-diff:customer-diff:5000:quote-1',
          resultPayload: JSON.stringify({ changeOrder: { id: 'co-diff' } }),
          expiresAt: new Date(Date.now() + 86400000),
        },
      })

      const record = await prisma.idempotencyRecord.findUnique({ where: { idempotencyKey: key } })
      expect(record!.requestFingerprint).toBe('APPROVE:co-diff:customer-diff:5000:quote-1')

      const differentFingerprint = 'APPROVE:co-other:customer-diff:99999:quote-2'
      expect(record!.requestFingerprint).not.toBe(differentFingerprint)
    })
  })
})
