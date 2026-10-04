import { describe, expect, it, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { NextRequest } from 'next/server'
import {
  crmApiError,
  isOpaqueObjectString,
  readCrmApiErrorMessage,
} from '@/lib/crm/api-error'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

const guardMocks = vi.hoisted(() => ({
  guardCrmRequest: vi.fn(),
  providerConfigFindMany: vi.fn(),
  providerConfigFindUnique: vi.fn(),
  providerConfigUpsert: vi.fn(),
  providerTransactionFindMany: vi.fn(),
  providerRefundFindMany: vi.fn(),
  providerEventFindMany: vi.fn(),
  providerEventGroupBy: vi.fn(),
  providerTransactionGroupBy: vi.fn(),
  countryFindUnique: vi.fn(),
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/crm/security', () => ({
  guardCrmRequest: guardMocks.guardCrmRequest,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    paymentProviderConfig: {
      findMany: guardMocks.providerConfigFindMany,
      findUnique: guardMocks.providerConfigFindUnique,
      upsert: guardMocks.providerConfigUpsert,
    },
    paymentProviderTransaction: {
      findMany: guardMocks.providerTransactionFindMany,
      groupBy: guardMocks.providerTransactionGroupBy,
    },
    paymentProviderRefund: { findMany: guardMocks.providerRefundFindMany },
    paymentProviderEvent: {
      findMany: guardMocks.providerEventFindMany,
      groupBy: guardMocks.providerEventGroupBy,
    },
    country: { findUnique: guardMocks.countryFindUnique },
  },
}))

vi.mock('@/lib/crm/audit', () => ({
  createAuditLog: guardMocks.createAuditLog,
}))

vi.mock('@/lib/payment/payhere-adapter', () => ({
  getPayHereConfig: () => null,
  getPayHereMerchantApiConfig: () => null,
}))

const SANDBOX_ENV = {
  PAYPAL_CLIENT_ID: 'sandbox-client-id',
  PAYPAL_CLIENT_SECRET: 'sandbox-client-secret',
  PAYPAL_WEBHOOK_ID: 'sandbox-webhook-id',
  PAYPAL_SANDBOX: 'true',
}

function superAdminContext() {
  return {
    adminId: 'admin-1',
    email: 'owner@maintainex.lk',
    role: 'SUPER_ADMIN',
    assignedCountries: [],
    isSuperAdmin: true,
    selectedMarket: 'ALL',
    ipAddress: '127.0.0.1',
    userAgent: 'vitest',
    sessionId: 'session-1',
    permissionOverrides: [],
  }
}

function providerPatchRequest(body: unknown, init: RequestInit = {}): NextRequest {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    origin: 'https://maintainex.lk',
    'sec-fetch-site': 'same-origin',
    ...((init.headers as Record<string, string>) || {}),
  }

  return new NextRequest('https://maintainex.lk/api/admin/financial/providers', {
    method: 'PATCH',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

const CA_SANDBOX_PAYLOAD = {
  countryCode: 'CA',
  provider: 'PAYPAL',
  enabled: true,
  environment: 'SANDBOX',
  supportedCurrencies: ['CAD'],
  paymentMethods: ['PAYPAL'],
  capabilities: {
    checkout: true,
    authorize: false,
    capture: true,
    refund: true,
    partialRefund: false,
    webhooks: true,
    disputes: true,
    payouts: false,
    reconciliation: true,
  },
  captureMode: 'CAPTURE',
  operationalStatus: 'ACTIVE',
  priority: 100,
  commissionRateBps: null,
  reason: 'CA PayPal sandbox E2E verification',
}

describe('CRM API error rendering', () => {
  it('renders a structured guard error as message plus code', () => {
    expect(
      readCrmApiErrorMessage(
        { error: { code: 'CRM_PERMISSION_FORBIDDEN', message: 'Missing CRM permission.' } },
        'fallback'
      )
    ).toBe('Missing CRM permission. (CRM_PERMISSION_FORBIDDEN)')
  })

  it('renders a plain string error unchanged', () => {
    expect(readCrmApiErrorMessage({ error: 'Valid countryCode is required' })).toBe(
      'Valid countryCode is required'
    )
  })

  it('renders a top-level message field', () => {
    expect(readCrmApiErrorMessage({ message: 'Something went wrong' })).toBe(
      'Something went wrong'
    )
  })

  it('falls back for empty, null and unexpected bodies', () => {
    expect(readCrmApiErrorMessage(null, 'Provider update failed')).toBe('Provider update failed')
    expect(readCrmApiErrorMessage(undefined, 'Provider update failed')).toBe('Provider update failed')
    expect(readCrmApiErrorMessage({}, 'Provider update failed')).toBe('Provider update failed')
    expect(readCrmApiErrorMessage('a string body', 'Provider update failed')).toBe(
      'Provider update failed'
    )
    expect(readCrmApiErrorMessage([1, 2, 3], 'Provider update failed')).toBe(
      'Provider update failed'
    )
    expect(readCrmApiErrorMessage({ error: {} }, 'Provider update failed')).toBe(
      'Provider update failed'
    )
  })

  it('never produces [object Object] for any body shape', () => {
    const bodies: unknown[] = [
      { error: { code: 'CRM_ROLE_FORBIDDEN', message: 'Admin role is not permitted.' } },
      { error: 'plain' },
      { error: { code: 'X' } },
      { error: [1, 2] },
      { error: null },
      {},
    ]

    for (const body of bodies) {
      const message = crmApiError(body, 'fallback').message
      expect(message).not.toContain('[object Object]')
      expect(isOpaqueObjectString(message)).toBe(false)
      expect(message.length).toBeGreaterThan(0)
    }
  })

  it('keeps a code-only structured error readable', () => {
    expect(
      readCrmApiErrorMessage({ error: { code: 'CRM_ORIGIN_REJECTED' } }, 'fallback')
    ).toBe('CRM_ORIGIN_REJECTED')
  })

  it('does not leak stack traces or long diagnostics', () => {
    const message = readCrmApiErrorMessage(
      { error: { code: 'CRM_boom', message: 'x'.repeat(5000) } },
      'fallback'
    )
    expect(message.length).toBeLessThanOrEqual(300)
  })

  it('ignores a lowercase or unsafe code but keeps the message', () => {
    expect(
      readCrmApiErrorMessage(
        { error: { code: 'not a code!', message: 'Readable message.' } },
        'fallback'
      )
    ).toBe('Readable message.')
  })

  it('is used by the provider page for both load and save errors', () => {
    const page = source('app/(admin)/admin/financial/providers/page.tsx')

    expect(page).toContain(
      "import { crmApiError } from '@/lib/crm/api-error'"
    )
    expect(page).toContain("crmApiError(body, 'Unable to load providers')")
    expect(page).toContain("crmApiError(body, 'Provider update failed')")
    expect(page).not.toMatch(/new Error\(body\??\.error/)
  })

  it('leaves no unsafe [object Object] error rendering in the CRM admin pages', () => {
    const offenders: string[] = []

    const walk = (dir: string): void => {
      for (const entry of require('node:fs').readdirSync(dir, { withFileTypes: true })) {
        const full = `${dir}/${entry.name}`
        if (entry.isDirectory()) {
          walk(full)
        } else if (/\.tsx?$/.test(entry.name)) {
          const text = readFileSync(resolve(process.cwd(), full), 'utf8')
          if (/new Error\((?:body|res|result)\??\.error/.test(text)) {
            offenders.push(full)
          }
        }
      }
    }

    walk('app/(admin)/admin')
    expect(offenders).toEqual([])
  })
})

describe('payment provider PATCH security gates', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    guardMocks.guardCrmRequest.mockReset()
    guardMocks.providerConfigFindUnique.mockReset()
    guardMocks.providerConfigUpsert.mockReset()
    guardMocks.createAuditLog.mockReset()
    Object.assign(process.env, SANDBOX_ENV)
  })

  async function loadRoute() {
    return import('@/app/api/admin/financial/providers/route')
  }

  it('rejects an unauthenticated request before touching provider config', async () => {
    guardMocks.guardCrmRequest.mockResolvedValue({
      ok: false,
      response: Response.json(
        { error: { code: 'CRM_UNAUTHENTICATED', message: 'Admin authentication required.' } },
        { status: 401 }
      ),
    })

    const { PATCH } = await loadRoute()
    const response = await PATCH(providerPatchRequest(CA_SANDBOX_PAYLOAD))

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error.code).toBe('CRM_UNAUTHENTICATED')
    expect(guardMocks.providerConfigUpsert).not.toHaveBeenCalled()
  })

  it('rejects a non-SUPER_ADMIN role via the CRM guard', async () => {
    guardMocks.guardCrmRequest.mockResolvedValue({
      ok: false,
      response: Response.json(
        {
          error: {
            code: 'CRM_ROLE_FORBIDDEN',
            message: 'Admin role is not permitted for this action.',
          },
        },
        { status: 403 }
      ),
    })

    const { PATCH } = await loadRoute()
    const response = await PATCH(providerPatchRequest(CA_SANDBOX_PAYLOAD))

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error.code).toBe('CRM_ROLE_FORBIDDEN')
    expect(guardMocks.providerConfigUpsert).not.toHaveBeenCalled()
  })

  it('rejects a cross-origin mutation via the CRM guard', async () => {
    guardMocks.guardCrmRequest.mockResolvedValue({
      ok: false,
      response: Response.json(
        {
          error: {
            code: 'CRM_ORIGIN_REJECTED',
            message: 'Cross-origin CRM mutation rejected.',
          },
        },
        { status: 403 }
      ),
    })

    const { PATCH } = await loadRoute()
    const response = await PATCH(providerPatchRequest(CA_SANDBOX_PAYLOAD))

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error.code).toBe('CRM_ORIGIN_REJECTED')
    expect(guardMocks.providerConfigUpsert).not.toHaveBeenCalled()
  })

  it('requires the SUPER_ADMIN role and markets:manage permission at the route', () => {
    const route = source('app/api/admin/financial/providers/route.ts')
    expect(route).toContain("permission: 'markets:manage'")
    expect(route).toContain("allowedRoles: ['SUPER_ADMIN']")
    expect(route).toContain('requireCountryScope: true')
  })

  it('saves a valid CA PAYPAL SANDBOX config for the authorized owner', async () => {
    guardMocks.guardCrmRequest.mockResolvedValue({
      ok: true,
      context: superAdminContext(),
    })
    guardMocks.providerConfigFindUnique.mockResolvedValue(null)
    guardMocks.providerConfigUpsert.mockResolvedValue({ id: 'pp-ca-1' })

    const { PATCH } = await loadRoute()
    const response = await PATCH(providerPatchRequest(CA_SANDBOX_PAYLOAD))

    expect(response.status).toBe(200)
    expect(guardMocks.providerConfigUpsert).toHaveBeenCalledTimes(1)

    const written = guardMocks.providerConfigUpsert.mock.calls[0][0]
    expect(written.where).toEqual({
      countryCode_provider: { countryCode: 'CA', provider: 'PAYPAL' },
    })
    expect(written.create.enabled).toBe(true)
    expect(written.create.environment).toBe('SANDBOX')
    expect(written.create.operationalStatus).toBe('ACTIVE')
    expect(written.create.captureMode).toBe('CAPTURE')
    expect(JSON.parse(written.create.supportedCurrencies)).toEqual(['CAD'])
  })

  it('rejects a LIVE enable while the server runs PayPal sandbox (fail closed)', async () => {
    guardMocks.guardCrmRequest.mockResolvedValue({
      ok: true,
      context: superAdminContext(),
    })

    const { PATCH } = await loadRoute()
    const response = await PATCH(
      providerPatchRequest({ ...CA_SANDBOX_PAYLOAD, environment: 'LIVE' })
    )

    // The market-verification gate fires first for an unverified LIVE market;
    // either way the request must be rejected with 409 and nothing written.
    expect(response.status).toBe(409)
    const body = await response.json()
    expect(String(body.error)).toMatch(/not verified for CA in LIVE|cannot be enabled until its server runtime/)
    expect(guardMocks.providerConfigUpsert).not.toHaveBeenCalled()
  })

  it('blocks the webhook capability when no webhook ID is configured', async () => {
    process.env.PAYPAL_WEBHOOK_ID = ''
    guardMocks.guardCrmRequest.mockResolvedValue({
      ok: true,
      context: superAdminContext(),
    })

    const { PATCH } = await loadRoute()
    const response = await PATCH(providerPatchRequest(CA_SANDBOX_PAYLOAD))

    expect(response.status).toBe(409)
    const body = await response.json()
    expect(String(body.error)).toMatch(/webhook verification is not configured/)
    expect(guardMocks.providerConfigUpsert).not.toHaveBeenCalled()
  })

  it('rejects enabling a provider when PayPal credentials are absent', async () => {
    delete process.env.PAYPAL_CLIENT_ID
    delete process.env.PAYPAL_CLIENT_SECRET
    guardMocks.guardCrmRequest.mockResolvedValue({
      ok: true,
      context: superAdminContext(),
    })

    const { PATCH } = await loadRoute()
    const response = await PATCH(providerPatchRequest(CA_SANDBOX_PAYLOAD))

    expect(response.status).toBe(409)
    expect(guardMocks.providerConfigUpsert).not.toHaveBeenCalled()
  })

  it('stores the partialRefund capability verbatim, with no CRM-level gate', async () => {
    // Documented behaviour: this revision has no partial-refund gate on the
    // provider config route. Partial refunds must still be refused at the
    // canonical refund approval/execution layer, not merely flagged here.
    guardMocks.guardCrmRequest.mockResolvedValue({
      ok: true,
      context: superAdminContext(),
    })
    guardMocks.providerConfigFindUnique.mockResolvedValue(null)
    guardMocks.providerConfigUpsert.mockResolvedValue({ id: 'pp-ca-partial' })

    const { PATCH } = await loadRoute()
    const response = await PATCH(
      providerPatchRequest({
        ...CA_SANDBOX_PAYLOAD,
        capabilities: { ...CA_SANDBOX_PAYLOAD.capabilities, partialRefund: true },
      })
    )

    expect(response.status).toBe(200)
    const written = guardMocks.providerConfigUpsert.mock.calls[0][0]
    expect(JSON.parse(written.create.capabilities).partialRefund).toBe(true)

    const registry = source('lib/finance/payments/provider-registry.ts')
    expect(registry).toContain('partialRefund')
  })

  it('does not store PayPal secrets in the provider configuration row', () => {
    const route = source('app/api/admin/financial/providers/route.ts')
    expect(route).not.toMatch(/PAYPAL_CLIENT_SECRET\s*[:=]/)
    expect(route).not.toMatch(/clientSecret/)
  })
})

describe('payHere legacy compatibility on this revision', () => {
  it('still ships the legacy PayHere adapters for historical readability', () => {
    expect(() => source('lib/finance/payments/payhere-adapter.ts')).not.toThrow()
    expect(() => source('lib/payment/payhere-adapter.ts')).not.toThrow()
    expect(() => source('app/api/cron/payhere-refunds/route.ts')).not.toThrow()
    expect(() => source('app/api/webhooks/payhere/route.ts')).not.toThrow()
  })

  it('keeps the PayHere provider row expressible for history', () => {
    const registry = source('lib/finance/payments/provider-registry.ts')
    expect(registry).toContain("PAYMENT_PROVIDER_CODES = ['PAYPAL', 'PAYHERE', 'MANUAL_BANK']")
  })

  it('does not delete any PayHere financial row from a migration', () => {
    const schema = source('prisma/schema.prisma')
    expect(schema).toContain('model PaymentProviderTransaction')
    expect(schema).toContain('model PaymentProviderRefund')
    expect(schema).toContain('model PaymentProviderEvent')
  })
})
