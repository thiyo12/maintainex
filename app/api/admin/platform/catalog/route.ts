import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  assertCrmCountriesAllowed,
  assertCrmCountryAllowed,
  getCrmCountryCodes,
  getCrmCountryFilter,
  guardCrmRequest,
  type CrmSecurityContext,
} from '@/lib/crm/security'
import { createAuditLog } from '@/lib/crm/audit'
import { parseNonNegativeMajorUnitPrice } from '@/lib/shared/money/money'
import { evaluateEffectivePermission, getPermissionCatalogEntry } from '@/lib/crm/governance'

// 'jobCategory' and 'templateJob' are the canonical V2 entities that
// /api/catalog, the website and the mobile apps actually read. The legacy
// 'category' and 'service' records are retained for existing callers.
const ENTITY_TYPES = new Set([
  'category',
  'service',
  'template',
  'jobCategory',
  'templateJob',
])

function canPublishCatalog(security: CrmSecurityContext): boolean {
  const entry = getPermissionCatalogEntry('catalog:publish')
  return evaluateEffectivePermission({
    role: security.role,
    permission: 'catalog:publish',
    permissionClass: entry?.class,
    overrides: security.permissionOverrides,
  }).allowed
}

export async function GET(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'catalog:view',
      level: 'read',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const countryFilter = getCrmCountryFilter(security)

    const [categories, services, templates, templateJobs, jobCategories] = await Promise.all([
      prisma.category.findMany({
        where: countryFilter,
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          countryCode: true,
          displayOrder: true,
          isActive: true,
          createdAt: true,
          _count: { select: { services: true } },
        },
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      }),
      prisma.service.findMany({
        where: countryFilter,
        select: {
          id: true,
          name: true,
          slug: true,
          shortDescription: true,
          price: true,
          duration: true,
          countryCode: true,
          displayOrder: true,
          views: true,
          isTrending: true,
          isActive: true,
          createdAt: true,
          category: { select: { id: true, name: true, slug: true } },
        },
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      }),
      prisma.serviceTemplate.findMany({
        where: countryFilter,
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          countryCode: true,
          pricingMode: true,
          priceMin: true,
          priceMax: true,
          currency: true,
          defaultDurationMinutes: true,
          benchmarkEligible: true,
          isActive: true,
          sortOrder: true,
          createdAt: true,
          jobCategory: { select: { id: true, name: true, slug: true } },
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      prisma.templateJob.findMany({
        select: {
          id: true,
          categoryId: true,
          name: true,
          description: true,
          currency: true,
          priceMin: true,
          priceMax: true,
          countries: true,
          isPopular: true,
          isCompanyOnly: true,
          isActive: true,
          typicalDurationMinutes: true,
        },
        orderBy: [{ name: 'asc' }],
      }),
      prisma.jobCategory.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          iconName: true,
          colorHex: true,
          countries: true,
          sortOrder: true,
          isActive: true,
          _count: {
            select: {
              jobs: true,
              serviceTemplates: true,
            },
          },
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
    ])

    const scopedCountryCodes = getCrmCountryCodes(security)
    // Read scope must match write scope. A market-limited CRM operator must
    // never see an entity that also covers a country outside their grant.
    // JSON substring/any-country matches are insufficient authorization.
    const allowedJobCategories = scopedCountryCodes === null
      ? jobCategories
      : jobCategories.filter(category => assertCrmCountriesAllowed(security, category.countries))

    const allowedTemplateJobs = scopedCountryCodes === null
      ? templateJobs
      : templateJobs.filter(job => assertCrmCountriesAllowed(security, job.countries))

    return NextResponse.json(
      {
        categories,
        services,
        templates,
        templateJobs: allowedTemplateJobs,
        jobCategories: allowedJobCategories,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    secureConsole.error('CRM catalog GET error:', error)
    return NextResponse.json({ error: 'Failed to load catalog' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'catalog:edit',
      level: 'sensitive',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const body = await request.json().catch(() => ({}))
    const type = typeof body?.type === 'string' ? body.type : ''
    if (!['category', 'service', 'jobCategory', 'templateJob'].includes(type)) {
      return NextResponse.json({ error: 'type must be category, service, jobCategory or templateJob' }, { status: 400 })
    }

    // Canonical V2 items are private drafts unless explicitly published.
    // Legacy types retain their pre-existing activation behavior.
    const requestedActive = (type === 'jobCategory' || type === 'templateJob')
      ? body?.isActive === true
      : body?.isActive !== false
    if (requestedActive && !canPublishCatalog(security)) {
      return NextResponse.json(
        { error: 'Publishing permission is required to create an active catalog item' },
        { status: 403 }
      )
    }

    // Canonical V2 catalogue entities. These are what /api/catalog, the website
    // and the mobile apps actually read, so CRM V2 must be able to create them.
    if (type === 'jobCategory' || type === 'templateJob') {
      const rawCountries: unknown[] = Array.isArray(body?.countries) ? body.countries : []
      const countries = rawCountries.filter((c): c is string => typeof c === 'string')
      if (countries.length === 0) {
        return NextResponse.json({ error: 'countries is required' }, { status: 400 })
      }
      // No unsupported launch markets may be attached to canonical catalogue entries.
      if (countries.some(country => !['LK', 'CA'].includes(country.trim().toUpperCase()))) {
        return NextResponse.json({ error: 'countries must only contain LK or CA' }, { status: 400 })
      }
      if (!assertCrmCountriesAllowed(security, JSON.stringify(countries))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 200) : ''
      if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })
      const slug = typeof body?.slug === 'string'
        ? body.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 120)
        : name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      const countriesJson = JSON.stringify(countries.map(c => c.toUpperCase()))
      // Activation requires the publish permission; creation does not publish.
      const publishAllowed = canPublishCatalog(security)
      const explicitlyActive = body?.isActive === true
      const isActive = publishAllowed && explicitlyActive

      if (type === 'jobCategory') {
        const created = await prisma.jobCategory.create({
          data: {
            name,
            slug,
            iconName: typeof body?.iconName === 'string' ? body.iconName.trim().slice(0, 60) : 'wrench',
            colorHex: typeof body?.colorHex === 'string' ? body.colorHex.trim().slice(0, 20) : '#666666',
            countries: countriesJson,
            sortOrder: Number.isFinite(Number(body?.sortOrder)) ? Math.floor(Number(body.sortOrder)) : 0,
            isActive,
          },
        })
        await createAuditLog({
          action: 'CREATE',
          category: 'SYSTEM',
          userId: security.adminId,
          userEmail: security.email,
          userRole: security.role,
          entityType: 'JobCategory',
          entityId: created.id,
          entityName: created.name,
          description: 'CRM canonical job category created',
          newValue: created,
          ipAddress: security.ipAddress,
          userAgent: security.userAgent || undefined,
          riskLevel: 'MEDIUM',
        })
        return NextResponse.json({ jobCategory: created }, { status: 201 })
      }

      const categoryId = typeof body?.categoryId === 'string' ? body.categoryId : ''
      if (!categoryId) {
        return NextResponse.json({ error: 'categoryId is required' }, { status: 400 })
      }
      const parent = await prisma.jobCategory.findUnique({ where: { id: categoryId } })
      if (!parent) {
        return NextResponse.json({ error: 'Job category not found' }, { status: 400 })
      }
      if (!assertCrmCountriesAllowed(security, parent.countries)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      let parentCountries: string[] = []
      try {
        const parsedParent: unknown = JSON.parse(parent.countries)
        if (Array.isArray(parsedParent)) {
          parentCountries = parsedParent.filter((c): c is string => typeof c === 'string').map(c => c.toUpperCase())
        }
      } catch {
        parentCountries = []
      }
      // A job may not claim a market its parent category does not cover.
      const outsideParent = countries
        .map(c => c.toUpperCase())
        .filter(c => !parentCountries.includes(c))
      if (outsideParent.length > 0) {
        return NextResponse.json(
          { error: `Country scope exceeds the parent category: ${outsideParent.join(', ')}` },
          { status: 400 }
        )
      }

      // Phase 05 — neither implied FX conversion nor sub-cent rounding.
      // Validate currency BEFORE parsing independently entered local prices.
      const currency = typeof body?.currency === 'string'
        ? body.currency.trim().toUpperCase().slice(0, 8)
        : ''
      const priceMin = parseNonNegativeMajorUnitPrice(body?.priceMin ?? 0, currency as 'LKR' | 'CAD')
      const priceMax = parseNonNegativeMajorUnitPrice(body?.priceMax ?? body?.priceMin ?? 0, currency as 'LKR' | 'CAD')
      if (priceMin === null || priceMax === null || priceMax < priceMin) {
        return NextResponse.json({ error: 'Invalid price range: use non-negative prices to 2 decimal places' }, { status: 400 })
      }

      // Price currency must match the market it is quoted in. Independent
      // Sri Lankan and Canadian pricing: never one derived from the other.
      const MARKET_CURRENCY: Record<string, string> = { LK: 'LKR', CA: 'CAD' }
      const declaredMarkets = countries.map(c => c.toUpperCase())
      if (currency !== 'LKR' && currency !== 'CAD') {
        return NextResponse.json(
          { error: 'currency must be LKR for Sri Lanka or CAD for Canada' },
          { status: 400 }
        )
      }
      const mismatchedMarket = declaredMarkets.find(m => MARKET_CURRENCY[m] !== currency)
      if (mismatchedMarket) {
        return NextResponse.json(
          { error: `currency ${currency} does not match market ${mismatchedMarket}` },
          { status: 400 }
        )
      }

      // Publication is a separate, explicit decision. Creating an item never
      // publishes it; only an administrator holding the publish permission who
      // explicitly asks for an active item gets one.
      const created = await prisma.templateJob.create({
        data: {
          categoryId,
          name,
          description: typeof body?.description === 'string' ? body.description.trim().slice(0, 5000) : '',
          whatIsIncluded: typeof body?.whatIsIncluded === 'string' ? body.whatIsIncluded.trim().slice(0, 5000) : '',
          typicalDurationMinutes: Number.isFinite(Number(body?.typicalDurationMinutes))
            ? Math.floor(Number(body.typicalDurationMinutes))
            : 0,
          priceMin,
          priceMax,
          currency,
          isPopular: Boolean(body?.isPopular),
          isCompanyOnly: Boolean(body?.isCompanyOnly),
          countries: countriesJson,
          isActive,
        },
      })
      await createAuditLog({
        action: 'CREATE',
        category: 'SYSTEM',
        userId: security.adminId,
        userEmail: security.email,
        userRole: security.role,
        entityType: 'TemplateJob',
        entityId: created.id,
        entityName: created.name,
        description: 'CRM canonical template job created',
        newValue: created,
        ipAddress: security.ipAddress,
        userAgent: security.userAgent || undefined,
        riskLevel: 'MEDIUM',
      })
      return NextResponse.json({ templateJob: created }, { status: 201 })
    }

    const countryCode = typeof body?.countryCode === 'string'
      ? body.countryCode.trim().toUpperCase()
      : security.selectedMarket && security.selectedMarket !== 'ALL'
        ? security.selectedMarket
        : security.assignedCountries[0] || 'LK'
    if (!assertCrmCountryAllowed(security, countryCode)) {
      return NextResponse.json({ error: 'Forbidden country' }, { status: 403 })
    }

    if (type === 'category') {
      const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 120) : ''
      const slug = typeof body?.slug === 'string'
        ? body.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 120)
        : name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      if (name.length < 2 || slug.length < 2) {
        return NextResponse.json({ error: 'Category name and slug are required' }, { status: 400 })
      }

      const category = await prisma.category.create({
        data: {
          name,
          slug,
          description: typeof body?.description === 'string' ? body.description.trim().slice(0, 1000) : null,
          countryCode,
          displayOrder: Number.isFinite(Number(body?.displayOrder)) ? Number(body.displayOrder) : 0,
          isActive: requestedActive,
        },
      })

      await createAuditLog({
        action: 'CREATE',
        category: 'SYSTEM',
        userId: security.adminId,
        userEmail: security.email,
        userRole: security.role,
        entityType: 'Category',
        entityId: category.id,
        entityName: category.name,
        description: 'CRM website category created',
        newValue: category,
        ipAddress: security.ipAddress,
        userAgent: security.userAgent || undefined,
        riskLevel: 'MEDIUM',
      })
      return NextResponse.json({ category }, { status: 201 })
    }

    const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 120) : ''
    const categoryId = typeof body?.categoryId === 'string' ? body.categoryId : ''
    if (name.length < 2 || !categoryId) {
      return NextResponse.json({ error: 'Service name and category are required' }, { status: 400 })
    }

    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true, countryCode: true },
    })
    if (!category || category.countryCode !== countryCode) {
      return NextResponse.json({ error: 'Category not found in selected country' }, { status: 400 })
    }

    const price = Number(body?.price || 0)
    const duration = Number(body?.duration || 0)
    if (!Number.isFinite(price) || price < 0 || !Number.isFinite(duration) || duration < 0) {
      return NextResponse.json({ error: 'Invalid service price or duration' }, { status: 400 })
    }

    const service = await prisma.service.create({
      data: {
        name,
        slug: typeof body?.slug === 'string'
          ? body.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 120)
          : name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        description: typeof body?.description === 'string' ? body.description.trim().slice(0, 5000) : '',
        shortDescription: typeof body?.shortDescription === 'string' ? body.shortDescription.trim().slice(0, 300) : null,
        categoryId,
        price,
        duration: Math.floor(duration),
        features: JSON.stringify(Array.isArray(body?.features) ? body.features.slice(0, 50) : []),
        countryCode,
        displayOrder: Number.isFinite(Number(body?.displayOrder)) ? Number(body.displayOrder) : 0,
        isTrending: Boolean(body?.isTrending),
        isActive: requestedActive,
      },
      include: { category: true },
    })

    await createAuditLog({
      action: 'CREATE',
      category: 'SYSTEM',
      userId: security.adminId,
      userEmail: security.email,
      userRole: security.role,
      entityType: 'Service',
      entityId: service.id,
      entityName: service.name,
      description: 'CRM website service created',
      newValue: service,
      ipAddress: security.ipAddress,
      userAgent: security.userAgent || undefined,
      riskLevel: 'MEDIUM',
    })

    return NextResponse.json({ service }, { status: 201 })
  } catch (error) {
    secureConsole.error('CRM catalog POST error:', error)
    return NextResponse.json({ error: 'Failed to create catalog item' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'catalog:publish',
      level: 'sensitive',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const body = await request.json().catch(() => ({}))
    const type = typeof body?.type === 'string' ? body.type : ''
    const id = typeof body?.id === 'string' ? body.id : ''
    const isActive = body?.isActive

    if (!ENTITY_TYPES.has(type) || !id || typeof isActive !== 'boolean') {
      return NextResponse.json({ error: 'Invalid activation payload' }, { status: 400 })
    }

    let oldValue: any
    let updated: any

    if (type === 'category') {
      oldValue = await prisma.category.findUnique({ where: { id } })
      if (!oldValue) return NextResponse.json({ error: 'Category not found' }, { status: 404 })
      if (!assertCrmCountryAllowed(security, oldValue.countryCode)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      updated = await prisma.category.update({ where: { id }, data: { isActive } })
    } else if (type === 'service') {
      oldValue = await prisma.service.findUnique({ where: { id } })
      if (!oldValue) return NextResponse.json({ error: 'Service not found' }, { status: 404 })
      if (!assertCrmCountryAllowed(security, oldValue.countryCode)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      updated = await prisma.service.update({ where: { id }, data: { isActive } })
    } else if (type === 'template') {
      oldValue = await prisma.serviceTemplate.findUnique({ where: { id } })
      if (!oldValue) return NextResponse.json({ error: 'Service template not found' }, { status: 404 })
      if (!assertCrmCountryAllowed(security, oldValue.countryCode)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      updated = await prisma.serviceTemplate.update({ where: { id }, data: { isActive } })
    } else if (type === 'jobCategory') {
      oldValue = await prisma.jobCategory.findUnique({ where: { id } })
      if (!oldValue) return NextResponse.json({ error: 'Job category not found' }, { status: 404 })
      if (!assertCrmCountriesAllowed(security, oldValue.countries)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      updated = await prisma.jobCategory.update({ where: { id }, data: { isActive } })
    } else {
      oldValue = await prisma.templateJob.findUnique({ where: { id } })
      if (!oldValue) return NextResponse.json({ error: 'Template job not found' }, { status: 404 })
      // TemplateJob stores its markets as a JSON list, not a countryCode column.
      if (!assertCrmCountriesAllowed(security, oldValue.countries)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      updated = await prisma.templateJob.update({ where: { id }, data: { isActive } })
    }

    await createAuditLog({
      action: 'UPDATE',
      category: 'SYSTEM',
      userId: security.adminId,
      userEmail: security.email,
      userRole: security.role,
      entityType: type === 'category' ? 'Category'
        : type === 'service' ? 'Service'
        : type === 'jobCategory' ? 'JobCategory'
        : type === 'templateJob' ? 'TemplateJob'
        : 'ServiceTemplate',
      entityId: id,
      entityName: oldValue.name,
      description: `CRM catalog item ${isActive ? 'activated' : 'deactivated'}`,
      oldValue: { isActive: oldValue.isActive },
      newValue: { isActive },
      ipAddress: security.ipAddress,
      userAgent: security.userAgent || undefined,
      riskLevel: 'MEDIUM',
    })

    return NextResponse.json({ item: updated })
  } catch (error) {
    secureConsole.error('CRM catalog PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update catalog item' }, { status: 500 })
  }
}
