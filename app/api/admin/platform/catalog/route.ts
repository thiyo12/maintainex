import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  assertCrmCountryAllowed,
  guardCrmRequest,
} from '@/lib/crm/security'
import { createAuditLog } from '@/lib/crm/audit'

const ENTITY_TYPES = new Set(['category', 'service', 'template'])

export async function GET(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'settings:view',
      level: 'read',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const countryFilter = security.isSuperAdmin
      ? {}
      : { countryCode: { in: security.assignedCountries } }

    const [categories, services, templates, jobCategories] = await Promise.all([
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

    const allowedJobCategories = security.isSuperAdmin
      ? jobCategories
      : jobCategories.filter(category =>
          security.assignedCountries.some(country =>
            category.countries.includes(country)
          )
        )

    return NextResponse.json(
      { categories, services, templates, jobCategories: allowedJobCategories },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('CRM catalog GET error:', error)
    return NextResponse.json({ error: 'Failed to load catalog' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'settings:edit',
      level: 'sensitive',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const body = await request.json().catch(() => ({}))
    const type = typeof body?.type === 'string' ? body.type : ''
    if (!['category', 'service'].includes(type)) {
      return NextResponse.json({ error: 'type must be category or service' }, { status: 400 })
    }

    const countryCode = typeof body?.countryCode === 'string'
      ? body.countryCode.trim().toUpperCase()
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
          isActive: body?.isActive !== false,
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
        isActive: body?.isActive !== false,
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
    console.error('CRM catalog POST error:', error)
    return NextResponse.json({ error: 'Failed to create catalog item' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'settings:edit',
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
    } else {
      oldValue = await prisma.serviceTemplate.findUnique({ where: { id } })
      if (!oldValue) return NextResponse.json({ error: 'Service template not found' }, { status: 404 })
      if (!assertCrmCountryAllowed(security, oldValue.countryCode)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      updated = await prisma.serviceTemplate.update({ where: { id }, data: { isActive } })
    }

    await createAuditLog({
      action: 'UPDATE',
      category: 'SYSTEM',
      userId: security.adminId,
      userEmail: security.email,
      userRole: security.role,
      entityType: type === 'category' ? 'Category' : type === 'service' ? 'Service' : 'ServiceTemplate',
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
    console.error('CRM catalog PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update catalog item' }, { status: 500 })
  }
}
