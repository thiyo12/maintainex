import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest'
import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { readFileSync } from 'fs'
import { resolve } from 'path'

vi.mock('@/lib/prisma', () => {
  const p: Record<string, any> = {}
  p.user = { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() }
  p.oTP = { create: vi.fn(), findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn(), count: vi.fn() }
  p.securityAudit = { create: vi.fn() }
  p.customerProfile = { upsert: vi.fn() }
  p.taskerProfile = { upsert: vi.fn(), updateMany: vi.fn() }
  p.taskerSkill = { upsert: vi.fn() }
  p.templateJob = { findFirst: vi.fn() }
  p.companyProfile = { upsert: vi.fn() }
  p.teamMember = { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() }
  p.$transaction = vi.fn(async (fn: (tx: any) => Promise<any>) => fn(p))
  return { prisma: p }
})

vi.mock('@/lib/auth/marketplace-session', () => ({
  createMarketplaceAuthSession: vi.fn(),
  buildAuthResponse: vi.fn(),
}))

vi.mock('@/lib/email', () => ({ sendOtpEmail: vi.fn() }))
vi.mock('@/lib/sms', () => ({ sendOtpSms: vi.fn() }))
vi.mock('@/lib/demo-marketplace', () => ({ provisionInteractiveDemoMarketplace: vi.fn(async () => undefined) }))

import { POST } from '@/app/api/mobile/auth/otp-login/route'
import { prisma } from '@/lib/prisma'
import { sendOtpSms } from '@/lib/sms'
import { sendOtpEmail } from '@/lib/email'
import { createMarketplaceAuthSession, buildAuthResponse } from '@/lib/auth/marketplace-session'
import { INTERACTIVE_TEST_PHONES } from '@/lib/test-cert'

const db = prisma as any
const originalAllowTestOtp = process.env.ALLOW_TEST_OTP

let HASH_ZERO: string
let HASH_RANDOM: string

beforeAll(async () => {
  HASH_ZERO = await bcrypt.hash('000000', 10)
  HASH_RANDOM = await bcrypt.hash('123456', 10)
})

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('https://test.com/api/mobile/auth/otp-login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': '203.0.113.10',
      'user-agent': 'vitest',
    },
    body: JSON.stringify(body),
  })
}

function demoUser(role: 'CUSTOMER' | 'TASKER' | 'COMPANY') {
  return {
    id: `demo-${role.toLowerCase()}`,
    email: `demo.${role.toLowerCase()}@maintainex-test.lk`,
    name: 'MaintainEX Demo',
    phone: INTERACTIVE_TEST_PHONES[role],
    phoneVerified: true,
    role,
    countryCode: 'US',
    isActive: true,
    isSuspended: false,
    isBanned: false,
    identityStatus: role === 'TASKER' ? 'VERIFIED' : 'NOT_SUBMITTED',
  }
}

const ordinaryUser = {
  id: 'ord-1',
  email: 'ordinary@example.com',
  name: 'Ordinary User',
  phone: '+12025550999',
  phoneVerified: true,
  role: 'CUSTOMER',
  countryCode: 'US',
  isActive: true,
  isSuspended: false,
  isBanned: false,
}

const fakeSession = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  accessTokenExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
  sessionExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  user: {
    id: 'u1',
    email: 'demo.tasker@maintainex-test.lk',
    name: 'MaintainEX Demo Tasker',
    phone: INTERACTIVE_TEST_PHONES.TASKER,
    role: 'TASKER',
    isActive: true,
    createdAt: new Date(),
  },
}

function resetMocks() {
  vi.clearAllMocks()
  db.user.findFirst.mockResolvedValue(null)
  db.user.findUnique.mockResolvedValue(null)
  db.user.create.mockResolvedValue({})
  db.user.update.mockResolvedValue({})
  db.oTP.create.mockResolvedValue({})
  db.oTP.findFirst.mockResolvedValue(null)
  db.oTP.update.mockResolvedValue({})
  db.oTP.updateMany.mockResolvedValue({ count: 1 })
  db.oTP.count.mockResolvedValue(0)
  db.securityAudit.create.mockResolvedValue({})
  db.customerProfile.upsert.mockResolvedValue({})
  db.taskerProfile.upsert.mockResolvedValue({ id: 'tp1', userId: 'u1' })
  db.taskerProfile.updateMany.mockResolvedValue({})
  db.taskerSkill.upsert.mockResolvedValue({})
  db.templateJob.findFirst.mockResolvedValue(null)
  db.companyProfile.upsert.mockResolvedValue({ id: 'cp1', userId: 'u1' })
  db.teamMember.findFirst.mockResolvedValue(null)
  db.teamMember.create.mockResolvedValue({})
  db.teamMember.update.mockResolvedValue({})
  vi.mocked(sendOtpSms).mockResolvedValue({ delivered: true, provider: 'twilio', messageId: 'm1' } as any)
  vi.mocked(sendOtpEmail).mockResolvedValue(true)
  vi.mocked(createMarketplaceAuthSession).mockResolvedValue(fakeSession as any)
  vi.mocked(buildAuthResponse).mockImplementation((s: any): any => ({
    accessToken: s.accessToken,
    refreshToken: s.refreshToken,
    user: s.user,
  }))
}

beforeEach(() => {
  process.env.ALLOW_TEST_OTP = 'true'
  resetMocks()
})

afterEach(() => {
  if (originalAllowTestOtp === undefined) delete process.env.ALLOW_TEST_OTP
  else process.env.ALLOW_TEST_OTP = originalAllowTestOtp
})

describe('OTP demo rate-limit bypass — source guard', () => {
  const src = readFileSync(
    resolve(__dirname, '../../app/api/mobile/auth/otp-login/route.ts'),
    'utf-8'
  )

  it('send limit is only reached when interactiveRole is null', () => {
    const guardIdx = src.indexOf('if (!interactiveRole)')
    const callIdx = src.indexOf('await checkOtpSendLimit(phone, ip)')
    expect(guardIdx).toBeGreaterThan(-1)
    expect(callIdx).toBeGreaterThan(guardIdx)
    expect(src.split('checkOtpSendLimit').length - 1).toBe(2)
  })

  it('verify limit stays unconditional (not bypassed for demo accounts)', () => {
    expect(src).toContain('await checkOtpVerifyLimit(user.id)')
    expect(src.indexOf('await checkOtpVerifyLimit(user.id)')).toBeGreaterThan(
      src.indexOf('if (!code)')
    )
  })

  it('demo sends invalidate prior unused LOGIN OTPs before creating a new one', () => {
    const guardIdx = src.indexOf('if (interactiveRole)')
    const invalidateIdx = src.indexOf('await prisma.oTP.updateMany', guardIdx)
    const createIdx = src.indexOf('await prisma.oTP.create', invalidateIdx)
    expect(guardIdx).toBeGreaterThan(-1)
    expect(invalidateIdx).toBeGreaterThan(guardIdx)
    expect(createIdx).toBeGreaterThan(invalidateIdx)
  })
})

describe('Interactive demo OTP send bypass', () => {
  it.each(['CUSTOMER', 'TASKER', 'COMPANY'] as const)(
    'demo %s phone succeeds even when phone and IP limits are exhausted',
    async (role) => {
      db.user.create.mockResolvedValue(demoUser(role))
      db.oTP.count.mockResolvedValue(10)

      const res = await POST(makeRequest({ phone: INTERACTIVE_TEST_PHONES[role] }))
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body).toMatchObject({ success: true, channel: 'test', testMode: true })
      expect(db.oTP.count).not.toHaveBeenCalled()
      expect(db.oTP.create).toHaveBeenCalledTimes(1)
      expect(db.oTP.updateMany).toHaveBeenCalledWith({
        where: { userId: expect.any(String), purpose: 'LOGIN', isUsed: false },
        data: { isUsed: true },
      })
      expect(sendOtpSms).not.toHaveBeenCalled()
      expect(sendOtpEmail).not.toHaveBeenCalled()
      const created = db.oTP.create.mock.calls[0][0]
      expect(await bcrypt.compare('000000', created.data.codeHash)).toBe(true)
    }
  )

  it('repeated demo OTP requests all succeed (no cooldown, no hourly cap)', async () => {
    db.user.create.mockResolvedValue(demoUser('TASKER'))
    db.oTP.count.mockResolvedValue(10)

    for (let i = 0; i < 3; i++) {
      const res = await POST(makeRequest({ phone: INTERACTIVE_TEST_PHONES.TASKER }))
      expect(res.status).toBe(200)
    }

    expect(db.oTP.count).not.toHaveBeenCalled()
    expect(db.oTP.updateMany).toHaveBeenCalledTimes(3)
    expect(db.oTP.create).toHaveBeenCalledTimes(3)
    expect(sendOtpSms).not.toHaveBeenCalled()
  })

  it('bypass is inactive when ALLOW_TEST_OTP is not true (demo phone gets 429)', async () => {
    process.env.ALLOW_TEST_OTP = 'false'
    db.user.findFirst.mockResolvedValue(demoUser('TASKER'))
    db.oTP.count.mockResolvedValue(3)

    const res = await POST(makeRequest({ phone: INTERACTIVE_TEST_PHONES.TASKER }))
    const body = await res.json()

    expect(res.status).toBe(429)
    expect(body.error).toContain('Too many codes sent')
    expect(db.oTP.count).toHaveBeenCalled()
    expect(db.user.create).not.toHaveBeenCalled()
    expect(db.oTP.create).not.toHaveBeenCalled()
  })
})

describe('Ordinary numbers remain rate limited (real checkOtpSendLimit)', () => {
  beforeEach(() => {
    db.user.findFirst.mockResolvedValue(ordinaryUser)
  })

  it('blocks the 4th send to the same number within an hour (3/phone/hour)', async () => {
    db.oTP.count.mockResolvedValue(3)

    const res = await POST(makeRequest({ phone: '+12025550999' }))
    const body = await res.json()

    expect(res.status).toBe(429)
    expect(body.error).toContain('Too many codes sent to this number')
    expect(db.oTP.create).not.toHaveBeenCalled()
    expect(sendOtpSms).not.toHaveBeenCalled()
  })

  it('blocks when the same IP exhausted 5 sends within an hour (5/IP/hour)', async () => {
    db.oTP.count.mockResolvedValueOnce(0).mockResolvedValueOnce(5)

    const res = await POST(makeRequest({ phone: '+12025550999' }))
    const body = await res.json()

    expect(res.status).toBe(429)
    expect(body.error).toContain('Too many requests from your device')
    expect(db.oTP.create).not.toHaveBeenCalled()
    expect(sendOtpSms).not.toHaveBeenCalled()
  })

  it('blocks a second send within 1 minute of the previous one (1-min cooldown)', async () => {
    db.oTP.count.mockResolvedValue(0)
    db.oTP.findFirst.mockResolvedValue({ id: 'recent-otp' })

    const res = await POST(makeRequest({ phone: '+12025550999' }))
    const body = await res.json()

    expect(res.status).toBe(429)
    expect(body.error).toContain('Please wait 1 minute')
    expect(db.oTP.create).not.toHaveBeenCalled()
    expect(sendOtpSms).not.toHaveBeenCalled()
  })

  it('within limits an ordinary number gets a real SMS with a random code (not 000000)', async () => {
    db.oTP.count.mockResolvedValue(0)
    db.oTP.findFirst.mockResolvedValue(null)

    const res = await POST(makeRequest({ phone: '+12025550999' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toMatchObject({ success: true, channel: 'sms', testMode: false })
    expect(sendOtpSms).toHaveBeenCalledWith('+12025550999', expect.any(String), 'US')
    const created = db.oTP.create.mock.calls[0][0]
    expect(await bcrypt.compare('000000', created.data.codeHash)).toBe(false)
  })
})

describe('OTP verify brute-force protection (cases 1-8)', () => {
  it('case 1: 000000 is rejected for an ordinary number (+12025550999)', async () => {
    db.user.findFirst.mockResolvedValue(ordinaryUser)
    db.oTP.findFirst.mockResolvedValue({ id: 'otp1', attempts: 0, codeHash: HASH_RANDOM, isUsed: false })

    const res = await POST(makeRequest({ phone: '+12025550999', code: '000000' }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('Invalid code. Please try again.')
    expect(db.oTP.update).toHaveBeenCalledWith({
      where: { id: 'otp1' },
      data: { attempts: { increment: 1 } },
    })
    expect(createMarketplaceAuthSession).not.toHaveBeenCalled()
  })

  it('case 2: any wrong code is rejected and increments the attempt counter', async () => {
    db.user.findFirst.mockResolvedValue(ordinaryUser)
    db.oTP.findFirst.mockResolvedValue({ id: 'otp1', attempts: 2, codeHash: HASH_RANDOM, isUsed: false })

    const res = await POST(makeRequest({ phone: '+12025550999', code: '999999' }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('Invalid code. Please try again.')
    expect(db.oTP.update).toHaveBeenCalledWith({
      where: { id: 'otp1' },
      data: { attempts: { increment: 1 } },
    })
    expect(createMarketplaceAuthSession).not.toHaveBeenCalled()
  })

  it('case 3: demo account with a non-000000 code is rejected', async () => {
    db.user.create.mockResolvedValue(demoUser('TASKER'))
    db.oTP.findFirst.mockResolvedValue({ id: 'otp1', attempts: 0, codeHash: HASH_ZERO, isUsed: false })

    const res = await POST(makeRequest({ phone: INTERACTIVE_TEST_PHONES.TASKER, code: '999999' }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('Invalid code. Please try again.')
    expect(db.oTP.update).toHaveBeenCalledWith({
      where: { id: 'otp1' },
      data: { attempts: { increment: 1 } },
    })
    expect(createMarketplaceAuthSession).not.toHaveBeenCalled()
  })

  it('case 4: demo account verifying with 000000 succeeds (ALLOW_TEST_OTP=true)', async () => {
    db.user.create.mockResolvedValue(demoUser('TASKER'))
    db.oTP.findFirst.mockResolvedValue({ id: 'otp1', attempts: 0, codeHash: HASH_ZERO, isUsed: false })

    const res = await POST(makeRequest({ phone: INTERACTIVE_TEST_PHONES.TASKER, code: '000000' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.accessToken).toBe('access-token')
    expect(body.token).toBe('access-token')
    expect(db.user.create).toHaveBeenCalled()
    expect(db.oTP.updateMany).toHaveBeenCalledWith({
      where: { id: 'otp1', isUsed: false },
      data: { isUsed: true },
    })
    expect(createMarketplaceAuthSession).toHaveBeenCalled()
  })

  it('case 4b: valid OTP replay loses the atomic consume race and creates no session', async () => {
    db.user.findFirst.mockResolvedValue(ordinaryUser)
    db.oTP.findFirst.mockResolvedValue({ id: 'otp1', attempts: 0, codeHash: HASH_RANDOM, isUsed: false })
    db.oTP.updateMany.mockResolvedValue({ count: 0 })

    const res = await POST(makeRequest({ phone: '+12025550999', code: '123456' }))
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.error).toContain('already used')
    expect(createMarketplaceAuthSession).not.toHaveBeenCalled()
  })

  it('case 5: verify limit is NOT bypassed for demo accounts (attempts >= 5 → 429)', async () => {
    db.user.create.mockResolvedValue(demoUser('TASKER'))
    db.oTP.findFirst.mockResolvedValue({ id: 'otp1', attempts: 5, codeHash: HASH_ZERO, isUsed: false })

    const res = await POST(makeRequest({ phone: INTERACTIVE_TEST_PHONES.TASKER, code: '000000' }))
    const body = await res.json()

    expect(res.status).toBe(429)
    expect(body.error).toContain('Too many wrong attempts')
    expect(createMarketplaceAuthSession).not.toHaveBeenCalled()
  })

  it('case 6: 5th wrong attempt invalidates the OTP and records OTP_BRUTE_FORCE', async () => {
    db.user.findFirst.mockResolvedValue(ordinaryUser)
    db.oTP.findFirst.mockResolvedValue({ id: 'otp1', attempts: 4, codeHash: HASH_RANDOM, isUsed: false })
    db.oTP.update.mockResolvedValue({ id: 'otp1', attempts: 5, isUsed: false })

    const res = await POST(makeRequest({ phone: '+12025550999', code: '999999' }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('Invalid code. Please try again.')
    expect(db.oTP.update).toHaveBeenCalledWith({
      where: { id: 'otp1' },
      data: { attempts: { increment: 1 } },
    })
    expect(db.oTP.update).toHaveBeenCalledWith({ where: { id: 'otp1' }, data: { isUsed: true } })
    expect(db.securityAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'OTP_BRUTE_FORCE' }),
      })
    )
    expect(createMarketplaceAuthSession).not.toHaveBeenCalled()
  })

  it('case 7: no valid (unexpired) OTP on record → 400 request a new code', async () => {
    db.user.findFirst.mockResolvedValue(ordinaryUser)
    db.oTP.findFirst.mockResolvedValue(null)

    const res = await POST(makeRequest({ phone: '+12025550999', code: '123456' }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('No valid code found. Request a new one.')
    expect(createMarketplaceAuthSession).not.toHaveBeenCalled()
  })

  it('case 8: 000000 rejected when ALLOW_TEST_OTP is not true (demo phone included)', async () => {
    process.env.ALLOW_TEST_OTP = 'false'
    db.user.findFirst.mockResolvedValue(demoUser('TASKER'))
    db.oTP.findFirst.mockResolvedValue({ id: 'otp1', attempts: 0, codeHash: HASH_RANDOM, isUsed: false })

    const res = await POST(makeRequest({ phone: INTERACTIVE_TEST_PHONES.TASKER, code: '000000' }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error).toBe('Invalid code. Please try again.')
    expect(db.user.create).not.toHaveBeenCalled()
    expect(createMarketplaceAuthSession).not.toHaveBeenCalled()
  })
})
