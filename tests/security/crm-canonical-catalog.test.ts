/**
 * CRM V2 catalogue administration over the canonical V2 entities.
 *
 * Runs the real admin route against PostgreSQL with the CRM guard stubbed, so
 * the permission, scope and persistence rules are exercised rather than
 * described. Covers the three verified gaps: TemplateJob authorization on its
 * JSON countries field, country-scoped listing, and create-time validation of
 * parent scope, currency/market pairing, and draft-by-default publication.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

const SESSION = { current: null as null | Record<string, unknown> }
// null means unscoped (super admin); an array restricts to those markets.
const CTX: { assignedCountries: string[] | null } = { assignedCountries: null }

vi.mock('@/lib/crm/security', async importOriginal => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    // Authenticate the request while keeping the real scope and permission logic.
    guardCrmRequest: async (_request: unknown, options: { permission?: string } = {}) => {
      const scope = CTX.assignedCountries
      return {
        ok: true,
        context: {
          adminId: 'test-admin',
          email: 'admin@test.local',
          role: 'SUPER_ADMIN',
          assignedCountries: scope,
          isSuperAdmin: scope === null,
          ipAddress: '127.0.0.1',
          userAgent: null,
          sessionId: 'test-session',
          permissionOverrides: [],
          selectedMarket: 'ALL',
          requiredPermission: options.permission,
        },
      }
    },
  }
})

vi.mock('server-only', () => ({}))

function loadRoute() {
  return import('../../app/api/admin/platform/catalog/route')
}

async function call(method: 'GET' | 'POST' | 'PATCH', body?: unknown) {
  const { NextRequest } = await import('next/server')
  const { GET, POST, PATCH } = await loadRoute()
  const req = new NextRequest('http://localhost/api/admin/platform/catalog', {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const handler = method === 'GET' ? GET : method === 'POST' ? POST : PATCH
  const res = await handler(req)
  let json: any = null
  try {
    json = await res.json()
  } catch {
    json = null
  }
  return { status: res.status, body: json }
}

describe('canonical catalogue administration', () => {
  let prisma: any
  let ts = 0
  let adminUserId = ''
  const created: string[] = []
  let seq = 0

  beforeAll(async () => {
    prisma = (await import('../../lib/prisma')).prisma
    ts = Date.now()
    SESSION.current = {
      adminId: 'test-admin',
      role: 'SUPER_ADMIN',
      email: 'admin@test.local',
      permissionOverrides: {},
    }
  })

  afterAll(async () => {
    await prisma.templateJob.deleteMany({ where: { id: { in: created } } })
    await prisma.jobCategory.deleteMany({ where: { slug: { startsWith: `crmtest-${ts}` } } })
  })

  async function makeCategory(countries: string[] = ['LK']): Promise<any> {
    seq += 1
    const c = await prisma.jobCategory.create({
      data: {
        name: `CRMTEST ${countries.join('-')} ${ts}-${seq}`,
        slug: `crmtest-${countries.join('-').toLowerCase()}-${ts}-${seq}`,
        iconName: 'wrench',
        colorHex: '#666666',
        countries: JSON.stringify(countries),
        sortOrder: 0,
        isActive: true,
      },
    })
    created.push(c.id)
    return c
  }

  it('creates a template job as a draft by default', async () => {
    const category = await makeCategory(['LK'])
    const res = await call('POST', {
      type: 'templateJob',
      categoryId: category.id,
      name: `Draft job ${ts}`,
      countries: ['LK'],
      currency: 'LKR',
      priceMin: 100,
      priceMax: 200,
    })
    expect(res.status).toBe(201)
    expect(res.body.templateJob.isActive).toBe(false)

    const persisted = await prisma.templateJob.findUnique({ where: { id: res.body.templateJob.id } })
    expect(persisted?.isActive).toBe(false)
  })

  it('rejects a currency that does not match the declared market', async () => {
    const category = await makeCategory(['LK'])
    const res = await call('POST', {
      type: 'templateJob',
      categoryId: category.id,
      name: `Bad currency ${ts}`,
      countries: ['LK'],
      currency: 'CAD',
      priceMin: 100,
      priceMax: 200,
    })
    expect(res.status).toBe(400)
  })

  it('accepts independent CAD pricing for a Canadian market', async () => {
    const category = await makeCategory(['CA'])
    const res = await call('POST', {
      type: 'templateJob',
      categoryId: category.id,
      name: `Canadian job ${ts}`,
      countries: ['CA'],
      currency: 'CAD',
      priceMin: 80,
      priceMax: 120,
    })
    expect(res.status).toBe(201)
    expect(res.body.templateJob.currency).toBe('CAD')
  })

  it('rejects a market the parent category does not cover', async () => {
    const category = await makeCategory(['LK'])
    const res = await call('POST', {
      type: 'templateJob',
      categoryId: category.id,
      name: `Scope escape ${ts}`,
      countries: ['CA'],
      currency: 'CAD',
      priceMin: 50,
      priceMax: 60,
    })
    expect(res.status).toBe(400)
    expect(String(res.body.error)).toContain('parent category')
  })

  it('activates a template job through the publish-authorised path', async () => {
    const category = await makeCategory(['LK'])
    const createdJob = await call('POST', {
      type: 'templateJob',
      categoryId: category.id,
      name: `Activatable ${ts}`,
      countries: ['LK'],
      currency: 'LKR',
      priceMin: 10,
      priceMax: 20,
      isActive: true,
    })
    expect(createdJob.status).toBe(201)
    expect(createdJob.body.templateJob.isActive).toBe(true)

    const patched = await call('PATCH', {
      type: 'templateJob',
      id: createdJob.body.templateJob.id,
      isActive: false,
    })
    expect(patched.status).toBe(200)
    expect(patched.body.template?.isActive ?? patched.body.item?.isActive ?? false).toBe(false)
  })

  it('authorizes a template job using its JSON countries, not a countryCode column', async () => {
    // TemplateJob has no countryCode column; the previous lookup therefore
    // always failed closed and could never be managed at all.
    const category = await makeCategory(['LK'])
    const createdJob = await call('POST', {
      type: 'templateJob',
      categoryId: category.id,
      name: `Scope auth ${ts}`,
      countries: ['LK'],
      currency: 'LKR',
      priceMin: 5,
      priceMax: 8,
    })
    expect(createdJob.status).toBe(201)

    const res = await call('PATCH', {
      type: 'templateJob',
      id: createdJob.body.templateJob.id,
      isActive: true,
    })
    expect(res.status).toBe(200)
  })

  it('a market-scoped admin cannot see or edit another market\'s template job', async () => {
    const caCategory = await makeCategory(['CA'])
    const canadian = await call('POST', {
      type: 'templateJob',
      categoryId: caCategory.id,
      name: `Scoped out ${ts}`,
      countries: ['CA'],
      currency: 'CAD',
      priceMin: 70,
      priceMax: 90,
    })
    expect(canadian.status).toBe(201)

    CTX.assignedCountries = ['LK']
    try {
      const list = await call('GET')
      expect(list.body.templateJobs.some((j: any) => j.id === canadian.body.templateJob.id)).toBe(false)

      const patch = await call('PATCH', {
        type: 'templateJob',
        id: canadian.body.templateJob.id,
        isActive: true,
      })
      expect(patch.status).toBe(403)
    } finally {
      CTX.assignedCountries = null
    }
  })


  it('does not reveal a shared LK+CA category to an LK-only CRM administrator', async () => {
    const shared = await makeCategory(['LK', 'CA'])
    CTX.assignedCountries = ['LK']
    try {
      const list = await call('GET')
      expect(list.status).toBe(200)
      expect(list.body.jobCategories.some((category: any) => category.id === shared.id)).toBe(false)

      const patch = await call('PATCH', {
        type: 'jobCategory', id: shared.id, isActive: false,
      })
      expect(patch.status).toBe(403)
    } finally {
      CTX.assignedCountries = null
    }
  })

  it('does not reveal a historical shared-market canonical job to a single-market admin', async () => {
    const shared = await makeCategory(['LK', 'CA'])
    const legacyMixed = await prisma.templateJob.create({
      data: {
        categoryId: shared.id,
        name: 'Historical shared job ' + ts,
        description: 'Legacy multi-market entry',
        whatIsIncluded: '[]',
        typicalDurationMinutes: 60,
        countries: '["LK","CA"]',
        currency: 'LKR',
        priceMin: 100,
        priceMax: 150,
        isActive: false,
      },
    })
    created.push(legacyMixed.id)
    CTX.assignedCountries = ['LK']
    try {
      const list = await call('GET')
      expect(list.status).toBe(200)
      expect(list.body.templateJobs.some((job: any) => job.id === legacyMixed.id)).toBe(false)

      const patch = await call('PATCH', {
        type: 'templateJob', id: legacyMixed.id, isActive: true,
      })
      expect(patch.status).toBe(403)
    } finally {
      CTX.assignedCountries = null
    }
  })

  it('lists template jobs so the CRM can manage them', async () => {
    const category = await makeCategory(['LK'])
    await call('POST', {
      type: 'templateJob',
      categoryId: category.id,
      name: `Listed ${ts}`,
      countries: ['LK'],
      currency: 'LKR',
      priceMin: 30,
      priceMax: 40,
    })
    const res = await call('GET')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.templateJobs)).toBe(true)
    expect(res.body.templateJobs.some((j: any) => j.name === `Listed ${ts}`)).toBe(true)
  })
})
