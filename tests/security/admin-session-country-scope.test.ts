import { afterEach, describe, expect, it } from 'vitest'
import { signAccessToken } from '@/lib/auth/authentication/admin-jwt'
import { getAdminSession, verifySimpleToken } from '@/lib/auth/authentication/admin-auth'

const ORIGINAL_JWT_SECRET = process.env.JWT_SECRET

afterEach(() => {
  if (ORIGINAL_JWT_SECRET === undefined) delete process.env.JWT_SECRET
  else process.env.JWT_SECRET = ORIGINAL_JWT_SECRET
})

describe('admin JWT country scope preservation', () => {
  it('preserves assignedCountries and staff identity when decoding the access token', () => {
    process.env.JWT_SECRET = 'crm-country-scope-test-secret-0123456789'

    const token = signAccessToken({
      id: 'admin-country-test',
      email: 'ops@example.com',
      role: 'MANAGER',
      firstName: 'Ops',
      lastName: 'Manager',
      assignedCountries: ['LK', 'CA'],
    })

    const decoded = verifySimpleToken(token)

    expect(decoded).toMatchObject({
      id: 'admin-country-test',
      email: 'ops@example.com',
      role: 'MANAGER',
      firstName: 'Ops',
      lastName: 'Manager',
      assignedCountries: ['LK', 'CA'],
      type: 'access',
    })
  })

  it('preserves assignedCountries through cookie-based getAdminSession', async () => {
    process.env.JWT_SECRET = 'crm-country-scope-test-secret-0123456789'

    const token = signAccessToken({
      id: 'admin-cookie-test',
      email: 'finance@example.com',
      role: 'FINANCE',
      firstName: 'Finance',
      lastName: 'Operator',
      assignedCountries: ['LK'],
    })

    const session = await getAdminSession({
      headers: { get: () => null },
      cookies: {
        get: (name: string) => name === 'admin_token' ? { value: token } : undefined,
      },
    })

    expect(session).toMatchObject({
      id: 'admin-cookie-test',
      email: 'finance@example.com',
      role: 'FINANCE',
      firstName: 'Finance',
      lastName: 'Operator',
      assignedCountries: ['LK'],
      type: 'access',
    })
  })

  it('does not invent a country scope when the token has none', () => {
    process.env.JWT_SECRET = 'crm-country-scope-test-secret-0123456789'

    const token = signAccessToken({
      id: 'admin-empty-scope',
      email: 'support@example.com',
      role: 'SUPPORT',
      firstName: 'Support',
      lastName: 'Agent',
      assignedCountries: [],
    })

    const decoded = verifySimpleToken(token)
    expect(decoded.assignedCountries).toEqual([])
  })
})
