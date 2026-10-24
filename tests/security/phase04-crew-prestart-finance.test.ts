import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { assertCrewPrestartFinancialEvidenceInsideTransaction } from '@/lib/domain/company-crew-prestart-finance'

const m = vi.hoisted(() => ({
  presence: vi.fn(), crew: vi.fn(), job: vi.fn(),
  quotes: vi.fn(), escrows: vi.fn(), intents: vi.fn(),
  dispute: vi.fn(), workspace: vi.fn(),
}))
vi.mock('@/lib/domain/company-crew-presence-witness', () => ({
  assertCrewDualWitnessInventoryInsideTransaction: m.presence,
}))
const now = Date.now()
const quote = { id: 'quote-1', price: 10000n, currency: 'LKR' }
const escrow = () => ({
  id: 'escrow-1', quoteId: quote.id, customerId: 'customer',
  providerId: 'company', amount: 10000n, serviceFee: 1000n,
  totalAmount: 11000n, currency: 'LKR', paymentMethod: 'CARD',
  status: 'PROTECTED', heldAt: new Date(now-30000),
  releasedAt: null, refundedAt: null, cashConfirmedAt: null,
})
const intent = () => ({
  id: 'intent-1', jobId: 'job', customerId: 'customer',
  escrowId: 'escrow-1', amount: 11000n, currency: 'LKR',
  status: 'SUCCESS', paidAt: new Date(now-40000),
})
const tx = {
  companyCrewDispatch: { findUnique: m.crew },
  marketplaceJob: { findUnique: m.job },
  jobQuote: { findMany: m.quotes },
  jobEscrow: { findMany: m.escrows },
  paymentIntent: { findMany: m.intents },
  marketplaceDispute: { findUnique: m.dispute },
  jobWorkspace: { findUnique: m.workspace },
}
const request = {
  crewDispatchId: 'crew', expectedVersion: 3,
  actorUserId: 'dispatcher', actorRole: 'DISPATCHER',
}
const review = () => assertCrewPrestartFinancialEvidenceInsideTransaction(tx as any, request)

describe('Phase04 prestart finance/workspace evidence is never live authorization', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    m.presence.mockResolvedValue({
      crewDispatchId: 'crew', crewVersion: 3, membersWithDualWitnesses: 3,
      dualAttestationsCollected: true, physicalPresenceVerified: false,
    })
    m.crew.mockResolvedValue({
      jobId: 'job', companyId: 'company', status: 'FORMING',
      version: 3, requiredWorkersCount: 3,
    })
    m.job.mockResolvedValue({
      id: 'job', customerId: 'customer',
      status: 'QUOTE_ACCEPTED', workersCount: 3,
    })
    m.quotes.mockResolvedValue([quote])
    m.escrows.mockResolvedValue([escrow()])
    m.intents.mockResolvedValue([intent()])
    m.dispute.mockResolvedValue(null)
    m.workspace.mockResolvedValue(null)
  })

  it('checks all-member live witness gate first, exact quote and settled protected funding, but never starts work', async () => {
    expect(await review()).toEqual({
      crewDispatchId: 'crew', crewVersion: 3, workersCount: 3,
      financialEvidenceComplete: true, independentPhysicalPresenceVerified: false,
      groupArrivalEnabled: false, workStartEnabled: false, paymentExecutionEnabled: false,
    })
    expect(m.presence).toHaveBeenCalledWith(tx, request)
    expect(m.quotes).toHaveBeenCalledWith({
      where: { jobId: 'job', providerId: 'company', providerType: 'COMPANY', status: 'ACCEPTED' },
      select: { id: true, price: true, currency: true },
    })
    expect(tx.companyCrewDispatch).not.toHaveProperty('update')
    expect(tx.jobWorkspace).not.toHaveProperty('create')
    expect(tx.jobEscrow).not.toHaveProperty('update')
    expect(tx.paymentIntent).not.toHaveProperty('create')
  })

  it('does not evaluate finance after denied actor/roster/photo/PIN/witness barrier', async () => {
    m.presence.mockRejectedValue(new Error('Crew member photo confirmation withdrawn'))
    await expect(review()).rejects.toThrow('photo confirmation')
    expect(m.crew).not.toHaveBeenCalled()
    expect(m.escrows).not.toHaveBeenCalled()
  })

  it('refuses changed crew epoch, status or missing member', async () => {
    for (const value of [
      { version: 2 }, { status: 'READY' },
      { requiredWorkersCount: 2 }, { requiredWorkersCount: 13 },
    ]) {
      m.crew.mockResolvedValue({
        jobId: 'job', companyId: 'company', status: 'FORMING',
        version: 3, requiredWorkersCount: 3, ...value,
      })
      await expect(review()).rejects.toThrow('Crew changed')
    }
  })

  it('refuses unfunded, missing, duplicate, stale and mismatched quote/escrow/intent', async () => {
    const cases: Array<[string, 'escrow'|'intent'|'quote', Record<string,unknown>]> = [
      ['pending escrow', 'escrow', { status: 'PENDING' }],
      ['refunded escrow', 'escrow', { status: 'REFUNDED', refundedAt: new Date() }],
      ['on-hold escrow', 'escrow', { status: 'ON_HOLD' }],
      ['cash promise', 'escrow', { paymentMethod: 'CASH' }],
      ['wrong quote', 'escrow', { quoteId: 'other' }],
      ['wrong customer', 'escrow', { customerId: 'other' }],
      ['wrong provider', 'escrow', { providerId: 'other' }],
      ['overstated amount', 'escrow', { amount: 12000n }],
      ['inconsistent fees', 'escrow', { totalAmount: 12000n }],
      ['negative fee', 'escrow', { serviceFee: -10n }],
      ['wrong currency', 'escrow', { currency: 'CAD' }],
      ['released escrow', 'escrow', { releasedAt: new Date() }],
      ['cash confirmed', 'escrow', { cashConfirmedAt: new Date() }],
      ['no protected timestamp', 'escrow', { heldAt: null }],
      ['future protected timestamp', 'escrow', { heldAt: new Date(now+60000) }],
      ['nonpositive quote', 'quote', { price: 0n }],
      ['wrong quote currency', 'quote', { currency: 'CAD' }],
      ['failed intent', 'intent', { status: 'FAILED' }],
      ['refunded intent', 'intent', { status: 'REFUNDED' }],
      ['wrong payment escrow', 'intent', { escrowId: 'another' }],
      ['wrong customer intent', 'intent', { customerId: 'another' }],
      ['wrong intent amount', 'intent', { amount: 11001n }],
      ['wrong intent currency', 'intent', { currency: 'CAD' }],
      ['missing paidAt', 'intent', { paidAt: null }],
      ['future paidAt', 'intent', { paidAt: new Date(now+60000) }],
    ]
    for (const [_label, type, change] of cases) {
      m.quotes.mockResolvedValue([{ ...quote }])
      m.escrows.mockResolvedValue([escrow()])
      m.intents.mockResolvedValue([intent()])
      if (type === 'quote') m.quotes.mockResolvedValue([{ ...quote, ...change }])
      if (type === 'escrow') m.escrows.mockResolvedValue([{ ...escrow(), ...change }])
      if (type === 'intent') m.intents.mockResolvedValue([{ ...intent(), ...change }])
      await expect(review()).rejects.toThrow('protected and settled')
    }
  })

  it('refuses missing or duplicate quote/escrow/intent even if one appears funded', async () => {
    for (const f of [m.quotes, m.escrows, m.intents]) {
      f.mockResolvedValue([])
      await expect(review()).rejects.toThrow('incomplete or conflicting')
      f.mockResolvedValue(f === m.quotes ? [quote, quote] :
        f === m.escrows ? [escrow(), escrow()] : [intent(), intent()])
      await expect(review()).rejects.toThrow('incomplete or conflicting')
      f.mockResolvedValue(f === m.quotes ? [quote] :
        f === m.escrows ? [escrow()] : [intent()])
    }
  })

  it('refuses a pre-existing workspace, dispute, or stale booking status', async () => {
    m.workspace.mockResolvedValue({ id: 'work' })
    await expect(review()).rejects.toThrow('conflicting')
    m.workspace.mockResolvedValue(null)
    m.dispute.mockResolvedValue({ id: 'dispute' })
    await expect(review()).rejects.toThrow('conflicting')
    m.dispute.mockResolvedValue(null)
    m.job.mockResolvedValue({ id: 'job', customerId: 'customer', status: 'IN_PROGRESS', workersCount: 3 })
    await expect(review()).rejects.toThrow('conflicting')
  })

  it('never exposes unfinished finance gate through live routes or bypasses crew checkout stop', () => {
    const src = (p:string) => readFileSync(resolve(process.cwd(),p),'utf8')
    const gate = src('lib/domain/company-crew-prestart-finance.ts')
    for (const field of [
      'independentPhysicalPresenceVerified: false',
      'groupArrivalEnabled: false', 'workStartEnabled: false',
      'paymentExecutionEnabled: false',
    ]) expect(gate).toContain(field)
    expect(src('lib/finance/payments/payment-service.ts')).toContain("code: 'CREW_PAYMENT_NOT_ENABLED'")
    for (const path of [
      'app/api/mobile/v2/jobs/[id]/crew-witness/route.ts',
      'app/api/mobile/v2/jobs/[id]/payment/route.ts',
      'app/api/mobile/worker/crew/route.ts',
    ]) expect(src(path)).not.toContain('assertCrewPrestartFinancialEvidenceInsideTransaction')
  })
})
