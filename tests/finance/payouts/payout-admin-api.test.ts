import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { GET } from '@/app/api/admin/financial/payouts/route'
import { PATCH } from '@/app/api/admin/financial/payouts/[id]/route'
import { signAccessToken } from '@/lib/auth/authentication/admin-jwt'
import { requestPayout } from '@/lib/finance/payouts/payout-engine'
import { requiresPostgres } from '../../helpers/test-guard'

const prisma = new PrismaClient()

const ts = Date.now()

describe.skipIf(!requiresPostgres())('Admin payout approval API', () => {
  let financeAdminId: string
  let techAdminId: string
  let financeToken: string
  let techToken: string
  let financeSessionId: string
  let techSessionId: string
  let providerUserId: string
  let providerWalletId: string

  beforeAll(async () => {
    if (!process.env.JWT_SECRET && !process.env.NEXTAUTH_SECRET) {
      process.env.JWT_SECRET = 'payout-admin-api-test-secret'
    }

    const financeAdmin = await prisma.adminUser.create({
      data: {
        email: `fin-payout-api-${ts}@test.com`,
        passwordHash: 'x',
        role: 'FINANCE',
        firstName: 'Fin',
        lastName: 'PayoutApi',
        isActive: true,
        assignedCountries: '["LK"]',
      },
    })
    financeAdminId = financeAdmin.id
    const financeSession = await prisma.adminSession.create({
      data: {
        adminUserId: financeAdmin.id,
        refreshTokenHash: `payout-finance-refresh-${ts}`,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    })
    financeSessionId = financeSession.id
    financeToken = signAccessToken({
      id: financeAdmin.id,
      email: financeAdmin.email,
      role: 'FINANCE',
      firstName: 'Fin',
      lastName: 'PayoutApi',
      assignedCountries: ['LK'],
      sessionId: financeSession.id,
    })

    const techAdmin = await prisma.adminUser.create({
      data: {
        email: `tech-payout-api-${ts}@test.com`,
        passwordHash: 'x',
        role: 'TECHNICAL',
        firstName: 'Tech',
        lastName: 'PayoutApi',
        isActive: true,
        assignedCountries: '["LK"]',
      },
    })
    techAdminId = techAdmin.id
    const techSession = await prisma.adminSession.create({
      data: {
        adminUserId: techAdmin.id,
        refreshTokenHash: `payout-technical-refresh-${ts}`,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    })
    techSessionId = techSession.id
    techToken = signAccessToken({
      id: techAdmin.id,
      email: techAdmin.email,
      role: 'TECHNICAL',
      firstName: 'Tech',
      lastName: 'PayoutApi',
      assignedCountries: ['LK'],
      sessionId: techSession.id,
    })

    const provider = await prisma.user.create({
      data: {
        email: `payout-api-provider-${ts}@test.com`,
        passwordHash: 'x',
        name: 'Payout API Provider',
        role: 'TASKER',
        countryCode: 'LK',
        updatedAt: new Date(),
      },
    })
    providerUserId = provider.id

    const wallet = await prisma.providerWallet.create({
      data: { userId: providerUserId },
    })
    providerWalletId = wallet.id

    await prisma.walletBalance.create({
      data: {
        walletId: providerWalletId,
        walletType: 'PROVIDER',
        balance: 100000n,
        availableBalance: 100000n,
        pendingBalance: 0n,
        currency: 'LKR',
      },
    })
  })

  afterAll(async () => {
    const payouts = await prisma.payout.findMany({ where: { userId: providerUserId } })
    const payoutIds = payouts.map(p => p.id)
    const idemKeys = payouts.flatMap(p => [
      `admin-payout:PROCESSING:${p.id}`,
      `admin-payout:SUCCEEDED:${p.id}`,
      `admin-payout:FAILED:${p.id}`,
      `admin-payout:CANCELLED:${p.id}`,
    ])
    if (payoutIds.length) {
      await prisma.financialLedger.deleteMany({ where: { referenceId: { in: payoutIds } } }).catch(() => {})
      await prisma.payout.deleteMany({ where: { id: { in: payoutIds } } }).catch(() => {})
    }
    await prisma.idempotencyRecord
      .deleteMany({ where: { idempotencyKey: { startsWith: `payout-admin-api-${ts}` } } })
      .catch(() => {})
    if (idemKeys.length) {
      await prisma.idempotencyRecord.deleteMany({ where: { idempotencyKey: { in: idemKeys } } }).catch(() => {})
    }
    for (const pid of payoutIds) {
      await prisma.idempotencyRecord
        .deleteMany({ where: { idempotencyKey: { contains: pid } } })
        .catch(() => {})
    }
    await prisma.walletBalance.deleteMany({ where: { walletId: providerWalletId } }).catch(() => {})
    await prisma.providerWallet.delete({ where: { id: providerWalletId } }).catch(() => {})
    await prisma.user.delete({ where: { id: providerUserId } }).catch(() => {})
    await prisma.adminSession.deleteMany({ where: { id: { in: [financeSessionId, techSessionId] } } }).catch(() => {})
    await prisma.adminUser.deleteMany({ where: { id: { in: [financeAdminId, techAdminId] } } }).catch(() => {})
    await prisma.$disconnect()
  })

  function makeGet(token: string) {
    return new NextRequest('https://test.com/api/admin/financial/payouts', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    })
  }

  function makePatch(token: string, payoutId: string, body: Record<string, unknown>) {
    return new NextRequest(`https://test.com/api/admin/financial/payouts/${payoutId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
  }

  const params = (id: string) => ({ params: Promise.resolve({ id }) })

  it('FINANCE admin can list payouts; TECHNICAL is rejected', async () => {
    const ok = await GET(makeGet(financeToken))
    expect(ok.status).toBe(200)
    const denied = await GET(makeGet(techToken))
    expect(denied.status).toBe(403)
  })

  it('FINANCE admin external payout confirmation creates a governed approval request', async () => {
    const requested = await requestPayout(
      providerUserId, 50000n, 'BANK', '{"account":"test-acc"}',
      `payout-admin-api-${ts}-approve`, 'test'
    )
    expect(requested.ok).toBe(true)
    if (!requested.ok) return
    expect(requested.status).toBe('RESERVED')

    const availableAfterReserve = await prisma.walletBalance.findUnique({
      where: { walletType_walletId_currency: { walletType: 'PROVIDER', walletId: providerWalletId, currency: 'LKR' } },
    })
    expect(availableAfterReserve!.availableBalance).toBe(50000n)

    const res = await PATCH(makePatch(financeToken, requested.payoutId, {
      action: 'CONFIRM_EXTERNAL',
      providerRef: 'BANK-REF-1',
      idempotencyKey: `payout-admin-api-${ts}-confirm-${requested.payoutId}`,
    }), params(requested.payoutId))
    expect(res.status).toBe(202)
    const data = await res.json()
    expect(data.mode).toBe('APPROVAL_REQUIRED')
    expect(data.approval?.id).toBeTruthy()

    const payout = await prisma.payout.findUnique({ where: { id: requested.payoutId } })
    expect(payout!.status).toBe('RESERVED')
  })

  it('FAILED action requires reason; restores reserved funds to provider wallet', async () => {
    const requested = await requestPayout(
      providerUserId, 50000n, 'BANK', '{"account":"test-acc"}',
      `payout-admin-api-${ts}-reject`, 'test'
    )
    expect(requested.ok).toBe(true)
    if (!requested.ok) return

    const missingReason = await PATCH(makePatch(financeToken, requested.payoutId, { action: 'FAILED' }), params(requested.payoutId))
    expect(missingReason.status).toBe(400)

    const before = await prisma.walletBalance.findUnique({
      where: { walletType_walletId_currency: { walletType: 'PROVIDER', walletId: providerWalletId, currency: 'LKR' } },
    })
    expect(before!.availableBalance).toBe(0n)

    const res = await PATCH(makePatch(financeToken, requested.payoutId, {
      action: 'FAILED',
      reason: 'Bank account rejected',
    }), params(requested.payoutId))
    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.code).toBe('STEP_UP_REQUIRED')

    const after = await prisma.walletBalance.findUnique({
      where: { walletType_walletId_currency: { walletType: 'PROVIDER', walletId: providerWalletId, currency: 'LKR' } },
    })
    expect(after!.availableBalance).toBe(0n)
  })

  it('invalid action and unknown payout are rejected', async () => {
    const badAction = await PATCH(makePatch(financeToken, 'nonexistent', { action: 'TELEPORT' }), params('nonexistent'))
    expect(badAction.status).toBe(400)

    const notFound = await PATCH(makePatch(financeToken, 'payout-does-not-exist', {
      action: 'FAILED',
      reason: 'Missing payout record',
    }), params('payout-does-not-exist'))
    expect(notFound.status).toBe(404)
  })
})
