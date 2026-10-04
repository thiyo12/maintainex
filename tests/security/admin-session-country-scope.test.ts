import { afterEach, describe, expect, it } from 'vitest'
import { signAccessToken } from '@/lib/auth/authentication/admin-jwt'
import { getAdminSession, verifySimpleToken } from '@/lib/auth/authentication/admin-auth'

const mutableEnv = process.env as Record<string, string | undefined>
const ORIGINAL_JWT_SECRET = mutableEnv.JWT_SECRET
const ORIGINAL_NODE_ENV = mutableEnv.NODE_ENV

afterEach(() => {
  if (ORIGINAL_JWT_SECRET === undefined) delete mutableEnv.JWT_SECRET
  else mutableEnv.JWT_SECRET = ORIGINAL_JWT_SECRET
  if (ORIGINAL_NODE_ENV === undefined) delete mutableEnv.NODE_ENV
  else mutableEnv.NODE_ENV = ORIGINAL_NODE_ENV
})

describe('admin JWT country scope preservation', () => {
  it('preserves assignedCountries and staff identity when decoding the access token', () => {
    mutableEnv.JWT_SECRET = 'crm-country-scope-test-secret-0123456789'

    const token = signAccessToken({
      id: 'admin-country-test',
      email: 'ops@example.com',
      role: 'MANAGER',
      firstName: 'Ops',
      lastName: 'Manager',
      assignedCountries: ['LK', 'CA'],
      sessionId: 'session-country-test',
    })

    const decoded = verifySimpleToken(token)

    expect(decoded).toMatchObject({
      id: 'admin-country-test',
      email: 'ops@example.com',
      role: 'MANAGER',
      firstName: 'Ops',
      lastName: 'Manager',
      assignedCountries: ['LK', 'CA'],
      sessionId: 'session-country-test',
      type: 'access',
    })
  })

  it('preserves assignedCountries through non-production legacy cookie compatibility', async () => {
    mutableEnv.NODE_ENV = 'test'
    mutableEnv.JWT_SECRET = 'crm-country-scope-test-secret-0123456789'

    const token = signAccessToken({
      id: 'admin-cookie-test',
      email: 'finance@example.com',
      role: 'FINANCE',
      firstName: 'Finance',
      lastName: 'Operator',
      assignedCountries: ['LK'],
      sessionId: 'session-cookie-test',
    })

    const session = await getAdminSession({
      headers: { get: () => null },
      cookies: {
        get: (name: string) => name === 'admin_token' ? { value: token } : undefined,
      },
    })

    expect(session).toMatchObject({
      id: 'admin-cookie-test',
      sid: 'session-cookie-test',
      sessionId: 'session-cookie-test',
      email: 'finance@example.com',
      role: 'FINANCE',
      firstName: 'Finance',
      lastName: 'Operator',
      assignedCountries: ['LK'],
      type: 'access',
    })
  })

  it('rejects legacy admin cookie tokens in production', async () => {
    mutableEnv.NODE_ENV = 'production'
    mutableEnv.JWT_SECRET = 'crm-country-scope-test-secret-0123456789'

    const token = signAccessToken({
      id: 'admin-production-legacy',
      email: 'ops@example.com',
      role: 'MANAGER',
      firstName: 'Ops',
      lastName: 'Manager',
      assignedCountries: ['LK'],
      sessionId: 'session-production-legacy',
    })

    const session = await getAdminSession({
      headers: { get: () => null },
      cookies: {
        get: (name: string) => name === 'admin_token' ? { value: token } : undefined,
      },
    })

    expect(session).toBeNull()
  })

  it('does not invent a country scope when the token has none', () => {
    mutableEnv.JWT_SECRET = 'crm-country-scope-test-secret-0123456789'

    const token = signAccessToken({
      id: 'admin-empty-scope',
      email: 'support@example.com',
      role: 'SUPPORT',
      firstName: 'Support',
      lastName: 'Agent',
      assignedCountries: [],
      sessionId: 'session-empty-scope',
    })

    const decoded = verifySimpleToken(token)
    expect(decoded.assignedCountries).toEqual([])
  })
})
