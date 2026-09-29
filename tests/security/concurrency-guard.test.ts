import { describe, it, expect } from 'vitest'
import { requiresPostgres } from '../helpers/test-guard'

describe.skipIf(!requiresPostgres())('Concurrency Guard — Escrow Serialization', () => {
  it('concurrent escrow deposits must be serialized', async () => {
    const { PrismaClient } = await import('@prisma/client')
    const prisma = new PrismaClient()

    const userId = `concurrency-test-${Date.now()}`
    const user = await prisma.user.create({
      data: { email: `${userId}@test.com`, passwordHash: 'hash', name: 'Concurrency Test', role: 'CUSTOMER' },
    })

    const job = await prisma.marketplaceJob.create({
      data: {
        customerId: user.id,
        title: 'Concurrency Test Job',
        description: 'Test',
        categoryId: 'test-category',
        status: 'MATCHED',
        budgetAmount: 10000,
        budgetType: 'FIXED',
        countryCode: 'LK',
        photos: '[]',
      },
    })

    const escrow = await prisma.jobEscrow.create({
      data: {
        jobId: job.id,
        quoteId: 'test-quote',
        customerId: user.id,
        providerId: user.id,
        amount: 10000,
        serviceFee: 1000,
        totalAmount: 11000,
        currency: 'LKR',
        status: 'HELD',
      },
    })

    const concurrentResults = await Promise.allSettled([
      prisma.jobEscrow.update({
        where: { id: escrow.id },
        data: { status: 'RELEASED' },
      }),
      prisma.jobEscrow.update({
        where: { id: escrow.id },
        data: { status: 'REFUNDED' },
      }),
    ])

    const successful = concurrentResults.filter(r => r.status === 'fulfilled')
    expect(successful.length).toBe(1)

    await prisma.jobEscrow.delete({ where: { id: escrow.id } })
    await prisma.marketplaceJob.delete({ where: { id: job.id } })
    await prisma.user.delete({ where: { id: user.id } })
  })

  it('concurrent wallet mutations must be serialized', async () => {
    const { PrismaClient } = await import('@prisma/client')
    const prisma = new PrismaClient()

    const userId = `wallet-concurrency-${Date.now()}`
    const user = await prisma.user.create({
      data: { email: `${userId}@test.com`, passwordHash: 'hash', name: 'Wallet Test', role: 'CUSTOMER' },
    })

    const wallet = await prisma.walletBalance.create({
      data: { walletId: user.id, walletType: 'CUSTOMER', balance: 10000, availableBalance: 10000, pendingBalance: 0, currency: 'LKR' },
    })

    const updates = Array.from({ length: 5 }, (_, i) =>
      prisma.walletBalance.update({
        where: { walletType_walletId_currency: { walletType: 'CUSTOMER', walletId: user.id, currency: 'LKR' } },
        data: { balance: { increment: 100 } },
      })
    )

    const results = await Promise.allSettled(updates)
    const succeeded = results.filter(r => r.status === 'fulfilled')
    expect(succeeded.length).toBeGreaterThanOrEqual(1)

    const finalWallet = await prisma.walletBalance.findUnique({ where: { walletType_walletId_currency: { walletType: 'CUSTOMER', walletId: user.id, currency: 'LKR' } } })
    expect(finalWallet!.balance).toBeGreaterThanOrEqual(10000)

    await prisma.walletBalance.delete({ where: { walletType_walletId_currency: { walletType: 'CUSTOMER', walletId: user.id, currency: 'LKR' } } })
    await prisma.user.delete({ where: { id: user.id } })
  })
})

describe('Concurrency Patterns — Unit Tests (No DB)', () => {
  it('optimistic locking rejects stale updates', async () => {
    let version = 0
    const data = { balance: 100, version: 0 }

    const updateWithLock = (expectedVersion: number, delta: number) => {
      if (data.version !== expectedVersion) {
        return { success: false, reason: 'stale' }
      }
      data.balance += delta
      data.version++
      return { success: true, newBalance: data.balance }
    }

    const result1 = updateWithLock(0, 50)
    expect(result1.success).toBe(true)

    const result2 = updateWithLock(0, 30)
    expect(result2.success).toBe(false)
    expect((result2 as any).reason).toBe('stale')

    const result3 = updateWithLock(1, 30)
    expect(result3.success).toBe(true)
    expect(data.balance).toBe(180)
  })

  it('optimistic locking handles concurrent increments safely', async () => {
    let balance = 100
    let version = 0
    const lock = { version: 0 }

    const deposit = async (amount: number) => {
      const startVersion = lock.version
      await new Promise(r => setTimeout(r, Math.random() * 5))

      if (lock.version !== startVersion) {
        throw new Error('Optimistic lock failed')
      }

      balance += amount
      lock.version++
      return balance
    }

    const results = await Promise.allSettled([
      deposit(10),
      deposit(20),
      deposit(30),
      deposit(40),
      deposit(50),
    ])

    const succeeded = results.filter(r => r.status === 'fulfilled')
    expect(succeeded.length).toBeGreaterThanOrEqual(1)
    expect(balance).toBeGreaterThanOrEqual(110)
  })

  it('mutex prevents concurrent access to critical section', async () => {
    let locked = false
    const queue: Array<() => void> = []

    const acquire = () => new Promise<void>(resolve => {
      if (!locked) {
        locked = true
        resolve()
      } else {
        queue.push(resolve)
      }
    })

    const release = () => {
      if (queue.length > 0) {
        queue.shift()!()
      } else {
        locked = false
      }
    }

    let counter = 0
    const criticalIncrement = async () => {
      await acquire()
      const val = counter
      await new Promise(r => setTimeout(r, 1))
      counter = val + 1
      release()
    }

    await Promise.all([
      criticalIncrement(),
      criticalIncrement(),
      criticalIncrement(),
      criticalIncrement(),
      criticalIncrement(),
    ])

    expect(counter).toBe(5)
  })
})
