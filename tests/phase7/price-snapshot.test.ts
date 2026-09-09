/**
 * Phase 7 — Price Snapshot DB Tests
 *
 * Tests createPriceSnapshot(), getPriceSnapshot(), isSnapshotStillValid()
 * from lib/pricing/snapshot.ts.
 *
 * Requires VPS PostgreSQL with PriceSnapshot table.
 * Run on VPS only.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import {
  createPriceSnapshot,
  getPriceSnapshot,
  isSnapshotStillValid,
} from '@/lib/pricing/snapshot'
import { PriceSnapshotData } from '@/lib/pricing/types'

const prisma = new PrismaClient()

describe('Phase 7 — Price Snapshot (DB)', () => {
  let testJobId: string
  let snapshotId: string

  beforeAll(async () => {
    try {
    const ts = Date.now()
    const job = await prisma.marketplaceJob.create({
      data: {
        customerId: 'snap-test-customer',
        title: `Snapshot Test Job ${ts}`,
        description: 'Test',
        categoryId: 'snap-test-cat',
        photos: '[]',
        budgetType: 'FIXED',
        budgetAmount: 25000n,
        status: 'OPEN',
      },
    })
    testJobId = job.id
    } catch { /* DB unavailable locally */ }
  })

  afterAll(async () => {
    await prisma.priceSnapshot.deleteMany({ where: { jobId: testJobId } })
    await prisma.marketplaceJob.delete({ where: { id: testJobId } }).catch(() => {})
  })

  // ── createPriceSnapshot ──────────────────────────────────────────

  it('createPriceSnapshot creates record with correct BigInt fields', async () => {
    const data: PriceSnapshotData = {
      jobId: testJobId,
      pricingVersion: 'v1',
      currency: 'LKR',
      baseAmount: 500_000n,
      urgencyAmount: 125_000n,
      serviceModifiers: 4_000n,
      platformFeeBps: 1000,
      platformFeeAmount: 62_900n,
      providerGross: 629_000n,
      customerTotal: 691_900n,
      ruleIds: ['urgency_urgent', 'service_modifiers'],
    }

    snapshotId = await createPriceSnapshot(prisma, data)
    expect(snapshotId).toBeTruthy()
    expect(typeof snapshotId).toBe('string')

    const stored = await prisma.priceSnapshot.findUnique({ where: { id: snapshotId } })
    expect(stored).toBeTruthy()
    expect(stored!.jobId).toBe(testJobId)
    expect(stored!.baseAmount).toBe(500_000n)
    expect(stored!.urgencyAmount).toBe(125_000n)
    expect(stored!.serviceModifiers).toBe(4_000n)
    expect(stored!.platformFeeAmount).toBe(62_900n)
    expect(stored!.providerGross).toBe(629_000n)
    expect(stored!.customerTotal).toBe(691_900n)
  })

  // ── getPriceSnapshot ─────────────────────────────────────────────

  it('getPriceSnapshot retrieves latest snapshot for job', async () => {
    // Create a second snapshot for the same job
    const data2: PriceSnapshotData = {
      jobId: testJobId,
      pricingVersion: 'v1',
      currency: 'LKR',
      baseAmount: 600_000n,
      urgencyAmount: 0n,
      serviceModifiers: 0n,
      platformFeeBps: 1000,
      platformFeeAmount: 60_000n,
      providerGross: 600_000n,
      customerTotal: 660_000n,
      ruleIds: ['urgency_normal'],
    }
    await createPriceSnapshot(prisma, data2)

    const snapshot = await getPriceSnapshot(prisma, testJobId)
    expect(snapshot).not.toBeNull()
    // The latest snapshot should have baseAmount 600_000n
    expect(snapshot!.baseAmount).toBe(600_000n)
    expect(snapshot!.urgencyAmount).toBe(0n)
  })

  it('getPriceSnapshot returns null for non-existent job', async () => {
    const snapshot = await getPriceSnapshot(prisma, 'non-existent-job-id-12345')
    expect(snapshot).toBeNull()
  })

  // ── isSnapshotStillValid ─────────────────────────────────────────

  it('isSnapshotStillValid returns true when version matches', async () => {
    const snapshot: PriceSnapshotData = {
      jobId: testJobId,
      pricingVersion: 'v1',
      currency: 'LKR',
      baseAmount: 500_000n,
      urgencyAmount: 0n,
      serviceModifiers: 0n,
      platformFeeBps: 1000,
      platformFeeAmount: 50_000n,
      providerGross: 500_000n,
      customerTotal: 550_000n,
      ruleIds: ['urgency_normal'],
    }

    expect(isSnapshotStillValid(snapshot, 'v1')).toBe(true)
  })

  it('isSnapshotStillValid returns false when version differs', async () => {
    const snapshot: PriceSnapshotData = {
      jobId: testJobId,
      pricingVersion: 'v1',
      currency: 'LKR',
      baseAmount: 500_000n,
      urgencyAmount: 0n,
      serviceModifiers: 0n,
      platformFeeBps: 1000,
      platformFeeAmount: 50_000n,
      providerGross: 500_000n,
      customerTotal: 550_000n,
      ruleIds: ['urgency_normal'],
    }

    expect(isSnapshotStillValid(snapshot, 'v2')).toBe(false)
  })

  // ── BigInt precision ─────────────────────────────────────────────

  it('Snapshot preserves all BigInt precision (no Float rounding)', async () => {
    const preciseAmount = 999_999_999n // ~10M LKR
    const data: PriceSnapshotData = {
      jobId: testJobId,
      pricingVersion: 'v1',
      currency: 'LKR',
      baseAmount: preciseAmount,
      urgencyAmount: preciseAmount,
      serviceModifiers: preciseAmount,
      platformFeeBps: 1000,
      platformFeeAmount: preciseAmount,
      providerGross: preciseAmount * 3n,
      customerTotal: preciseAmount * 4n,
      ruleIds: [],
    }

    const id = await createPriceSnapshot(prisma, data)
    const snapshot = await getPriceSnapshot(prisma, testJobId)

    // Latest snapshot should be the one we just created
    expect(snapshot!.baseAmount).toBe(preciseAmount)
    expect(snapshot!.urgencyAmount).toBe(preciseAmount)
    expect(snapshot!.serviceModifiers).toBe(preciseAmount)
    expect(snapshot!.providerGross).toBe(preciseAmount * 3n)
    expect(snapshot!.customerTotal).toBe(preciseAmount * 4n)
  })

  // ── ruleIds stored as JSON ───────────────────────────────────────

  it('ruleIds stored as JSON array and parsed back correctly', async () => {
    const rules = ['urgency_emergency', 'service_modifiers', 'duration_modifier']
    const data: PriceSnapshotData = {
      jobId: testJobId,
      pricingVersion: 'v1',
      currency: 'LKR',
      baseAmount: 100_000n,
      urgencyAmount: 50_000n,
      serviceModifiers: 3_000n,
      platformFeeBps: 1000,
      platformFeeAmount: 15_300n,
      providerGross: 153_000n,
      customerTotal: 168_300n,
      ruleIds: rules,
    }

    const id = await createPriceSnapshot(prisma, data)
    const snapshot = await getPriceSnapshot(prisma, testJobId)

    expect(snapshot!.ruleIds).toEqual(rules)
  })
})
