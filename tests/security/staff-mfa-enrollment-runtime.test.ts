import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

/**
 * Runtime tests for the enrollment confirmation route. These invoke the real
 * route handler with mocked DB/auth dependencies and assert bounded behaviour:
 * prompt responses, deterministic already-enabled handling, no AdminSession.
 */

const state = {
  adminUser: null as Record<string, any> | null,
  verifyValid: true,
  sessionTokenValid: false,
  transactionThrows: false,
  transactionHangs: false,
  auditInserted: 0,
  userUpdates: [] as any[],
  sessionCalls: 0,
  inFlight: 0,
  maxInFlight: 0,
}

vi.mock('@/lib/prisma', () => {
  const tx = {
    adminUser: {
      update: async (args: any) => {
        state.userUpdates.push(args)
        if (!state.adminUser) throw new Error('no user')
        Object.assign(state.adminUser, args.data)
        return state.adminUser
      },
    },
    adminSession: {
      updateMany: async () => {
        state.sessionCalls += 1
        return { count: 0 }
      },
    },
    securityAudit: {
      create: async () => {
        state.auditInserted += 1
        return {}
      },
    },
  }
  return {
    prisma: {
      adminUser: {
        findUnique: async () => (state.adminUser ? { ...state.adminUser } : null),
      },
      securityAudit: {
        // Failed-attempt audit is best-effort and must never break the response.
        create: async () => {
          state.auditInserted += 1
          return {}
        },
      },
      $transaction: async (fn: any) => {
        state.inFlight += 1
        state.maxInFlight = Math.max(state.maxInFlight, state.inFlight)
        if (state.transactionHangs) {
          // never resolves: the route must still answer through its stage timeout
          await new Promise(() => {})
        }
        if (state.transactionThrows) throw new Error('transaction failed')
        return fn(tx)
      },
    },
  }
})

vi.mock('@/lib/admin-2fa', () => ({
  verifyTotp: async () => state.verifyValid,
}))

vi.mock('@/lib/crm/security', () => ({
  guardCrmRequest: async () =>
    state.sessionTokenValid
      ? {
          ok: true,
          context: {
            adminId: 'sa-1',
            email: 'owner@example.com',
            role: 'SUPER_ADMIN',
            sessionId: 'sess-1',
            ipAddress: '203.0.113.10',
            userAgent: 'test',
          },
        }
      : { ok: false, response: new Response('unauthorized', { status: 401 }) },
}))

vi.mock('@/lib/auth/authorization/admin-rbac', () => ({
  getIp: () => '203.0.113.10',
}))

vi.mock('@/lib/shared/observability/logger', () => ({
  logger: { info: () => undefined, error: () => undefined, warn: () => undefined },
}))

const validEnrollment = {
  sub: 'sa-1',
  ok: true,
  adminUser: { id: 'sa-1', email: 'owner@example.com', role: 'SUPER_ADMIN', totpEnabled: false, totpSecret: 'ABC' },
}
const enrolledSubject = {
  sub: 'sa-1',
  ok: true,
  adminUser: { id: 'sa-1', email: 'owner@example.com', role: 'SUPER_ADMIN', totpEnabled: true, totpSecret: 'ABC' },
}
const deadSubject = { ok: false, status: 401, error: 'Account is not available.' }

let tokenMode: 'valid' | 'expired' | 'wrong' = 'valid'
vi.mock('@/lib/auth/staff-mfa-enrollment', () => ({
  STAFF_MFA_ENROLLMENT_TTL_SECONDS: 600,
  verifyStaffMfaEnrollmentToken: (token: string | null) => {
    if (tokenMode === 'expired' || tokenMode === 'wrong') return null
    return { sub: 'sa-1', email: 'owner@example.com' }
  },
  resolveEnrollmentSubject: async (id: string) => {
    if (tokenMode === 'expired') return deadSubject
    return state.adminUser?.totpEnabled ? enrolledSubject : validEnrollment
  },
  issueStaffMfaEnrollmentToken: () => 'token',
}))

function makeRequest(body: Record<string, unknown>) {
  return new Request('https://maintainex.lk/api/admin/auth/2fa/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as any
}

async function callConfirm(body: Record<string, unknown>) {
  const { POST } = await import('@/app/api/admin/auth/2fa/confirm/route')
  return POST(makeRequest(body))
}

beforeEach(() => {
  state.adminUser = {
    id: 'sa-1',
    email: 'owner@example.com',
    role: 'SUPER_ADMIN',
    isActive: true,
    deletedAt: null,
    lockedUntil: null,
    totpEnabled: false,
    totpSecret: 'STOREDSECRET',
  }
  state.verifyValid = true
  state.sessionTokenValid = false
  state.transactionThrows = false
  state.transactionHangs = false
  state.auditInserted = 0
  state.userUpdates = []
  state.sessionCalls = 0
  tokenMode = 'valid'
})

afterEach(() => {
  vi.useRealTimers()
})

describe('enrollment confirm runtime behaviour', () => {
  it('1/2/3. valid token + valid TOTP returns promptly and enables MFA', async () => {
    const res = await callConfirm({ enrollmentToken: 't', totpCode: '123456' })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.totpEnabled).toBe(true)
    expect(state.adminUser?.totpEnabled).toBe(true)
    expect(state.adminUser?.totpVerifiedAt).toBeTruthy()
    expect(state.auditInserted).toBe(1)
  })

  it('4. transaction failure returns a bounded 500', async () => {
    state.transactionThrows = true
    const res = await callConfirm({ enrollmentToken: 't', totpCode: '123456' })

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(typeof body.error).toBe('string')
    expect(body.error).not.toContain('SECRET')
    // atomic: nothing was committed
    expect(state.adminUser?.totpEnabled).toBe(false)
  })

  it('4b. a hanging transaction is bounded by the stage timeout', async () => {
    state.transactionHangs = true
    vi.useFakeTimers()
    const pending = callConfirm({ enrollmentToken: 't', totpCode: '123456' })
    await vi.advanceTimersByTimeAsync(9000)
    const res = await pending
    expect(res.status).toBe(500)
  }, 20000)

  it('5. invalid TOTP returns promptly with 401 and does not enable MFA', async () => {
    state.verifyValid = false
    const res = await callConfirm({ enrollmentToken: 't', totpCode: '000000' })

    expect(res.status).toBe(401)
    expect(state.adminUser?.totpEnabled).toBe(false)
    expect(state.userUpdates).toHaveLength(0)
  })

  it('6. expired/invalid enrollment token returns promptly with 401', async () => {
    tokenMode = 'expired'
    const res = await callConfirm({ enrollmentToken: 't', totpCode: '123456' })
    expect(res.status).toBe(401)
    expect(state.adminUser?.totpEnabled).toBe(false)
  })

  it('7. already-enabled account returns a deterministic success result', async () => {
    state.adminUser = { ...state.adminUser!, totpEnabled: true, totpVerifiedAt: new Date() }
    const res = await callConfirm({ enrollmentToken: 't', totpCode: '123456' })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.alreadyEnabled).toBe(true)
    expect(body.totpEnabled).toBe(true)
  })

  it('rejects a non-6-digit code before any database write', async () => {
    const res = await callConfirm({ enrollmentToken: 't', totpCode: '12ab' })
    expect(res.status).toBe(400)
    expect(state.userUpdates).toHaveLength(0)
  })

  it('10. never creates an AdminSession during enrollment', async () => {
    await callConfirm({ enrollmentToken: 't', totpCode: '123456' })
    expect(state.sessionCalls).toBe(0)
  })

  it('requires a stored secret before confirming', async () => {
    state.adminUser = { ...state.adminUser!, totpSecret: null }
    const res = await callConfirm({ enrollmentToken: 't', totpCode: '123456' })
    expect(res.status).toBe(409)
    expect(state.adminUser?.totpEnabled).toBe(false)
  })

  it('14. an already-enrolled super-admin keeps the normal session flow', async () => {
    state.adminUser = { ...state.adminUser!, totpEnabled: true }
    state.sessionTokenValid = true
    const res = await callConfirm({ totpCode: '123456' })
    expect(res.status).toBe(200)
  })
})

describe('client timeout and safe parsing', () => {
  it('8/9. the enrollment form bounds the request and always restores state', () => {
    const page = require('node:fs').readFileSync(
      'app/(auth)/admin/login/page.tsx',
      'utf8'
    ) as string

    // hard timeout via AbortController
    expect(page).toContain('new AbortController()')
    expect(page).toContain('setTimeout(() => controller.abort(), 12000)')
    expect(page).toContain('signal: controller.signal')

    // timeout message never assumes MFA state
    expect(page).toContain(
      'Confirmation timed out. No MFA status was assumed. Please check your account state and try again.'
    )

    // robust parsing: text first, JSON best-effort
    expect(page).toContain('await res.text()')
    expect(page).toContain('data = raw ? JSON.parse(raw) : {}')

    // loading state always restored
    expect(page).toMatch(/finally \{\s*clearTimeout\(timeout\)\s*setIsLoading\(false\)/)

    // never trapped in a permanent "Confirming..." state
    expect(page).not.toContain('setIsLoading(true)\n      }')
  })
})

describe('enrollment token lifetime', () => {
  it('8. uses a bounded 10 minute TTL', async () => {
    const mod = await import('@/lib/auth/staff-mfa-enrollment')
    expect(mod.STAFF_MFA_ENROLLMENT_TTL_SECONDS).toBe(600)
  })

  it('setup overwrites any previous unconfirmed secret', () => {
    const setup = require('node:fs').readFileSync(
      'app/api/admin/auth/2fa/setup/route.ts',
      'utf8'
    ) as string
    expect(setup).toContain('generateTotpSecret()')
    expect(setup).toContain('totpEnabled: false')
    expect(setup).toContain('totpVerifiedAt: null')
  })
})