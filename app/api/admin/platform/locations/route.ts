import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { LOCATIONS } from '@/lib/locations'
import {
  assertCrmCountryAllowed,
  guardCrmRequest,
  type CrmSecurityContext,
} from '@/lib/crm/security'
import { createAuditLog } from '@/lib/crm/audit'

type LocationType = 'country' | 'state' | 'city' | 'area'

function cleanName(value: unknown, max = 120): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function cleanCode(value: unknown): string {
  return typeof value === 'string'
    ? value.trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2)
    : ''
}

function canAccessMarket(context: CrmSecurityContext, countryCode: string): boolean {
  return context.isSuperAdmin || assertCrmCountryAllowed(context, countryCode)
}

async function entityMarket(type: LocationType, id: string): Promise<string | null> {
  if (type === 'country') {
    const row = await prisma.country.findUnique({ where: { id }, select: { code: true } })
    return row?.code || null
  }

  if (type === 'state') {
    const row = await prisma.state.findUnique({
      where: { id },
      select: { country: { select: { code: true } } },
    })
    return row?.country.code || null
  }

  if (type === 'city') {
    const row = await prisma.city.findUnique({
      where: { id },
      select: { state: { select: { country: { select: { code: true } } } } },
    })
    return row?.state.country.code || null
  }

  const row = await prisma.area.findUnique({
    where: { id },
    select: {
      city: {
        select: {
          state: { select: { country: { select: { code: true } } } },
        },
      },
    },
  })
  return row?.city.state.country.code || null
}

export async function GET(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'markets:view',
      level: 'read',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const where = security.isSuperAdmin
      ? undefined
      : { code: { in: security.assignedCountries } }

    const databaseCountries = await prisma.country.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        states: {
          orderBy: { name: 'asc' },
          include: {
            cities: {
              orderBy: { name: 'asc' },
              include: {
                areas: { orderBy: { name: 'asc' } },
              },
            },
          },
        },
      },
    })

    const scopedFallback = LOCATIONS.filter(country =>
      security.isSuperAdmin || security.assignedCountries.includes(country.code)
    )
    const databaseCodes = new Set(databaseCountries.map(country => country.code))
    const fallbackCountries = scopedFallback
      .filter(country => !databaseCodes.has(country.code))
      .map(country => ({ ...country, _source: 'static-fallback' as const }))

    const countries = [
      ...databaseCountries.map(country => ({ ...country, _source: 'database' as const })),
      ...fallbackCountries,
    ].sort((a, b) => a.name.localeCompare(b.name))

    const source =
      databaseCountries.length === 0
        ? 'static-fallback'
        : fallbackCountries.length === 0
          ? 'database'
          : 'hybrid'

    return NextResponse.json(
      { source, countries },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('CRM locations GET error:', error)
    return NextResponse.json({ error: 'Failed to load locations' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'markets:manage',
      level: 'sensitive',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const body = await request.json().catch(() => ({}))
    const type = typeof body?.type === 'string' ? body.type : ''

    if (type === 'seed') {
      const countryCode = cleanCode(body?.countryCode)
      const source = LOCATIONS.find(country => country.code === countryCode)
      if (!source) {
        return NextResponse.json({ error: 'Static fallback market not found' }, { status: 404 })
      }
      if (!canAccessMarket(security, countryCode)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      const summary = await prisma.$transaction(async tx => {
        let country = await tx.country.findUnique({ where: { code: source.code } })
        let countriesCreated = 0
        let statesCreated = 0
        let citiesCreated = 0
        let areasCreated = 0

        if (!country) {
          country = await tx.country.create({
            data: { id: source.id, name: source.name, code: source.code },
          })
          countriesCreated += 1
        }

        for (const stateSource of source.states) {
          let state = await tx.state.findFirst({
            where: { countryId: country.id, name: stateSource.name },
          })
          if (!state) {
            state = await tx.state.create({
              data: {
                id: stateSource.id,
                name: stateSource.name,
                countryId: country.id,
              },
            })
            statesCreated += 1
          }

          for (const citySource of stateSource.cities) {
            let city = await tx.city.findFirst({
              where: { stateId: state.id, name: citySource.name },
            })
            if (!city) {
              city = await tx.city.create({
                data: {
                  id: citySource.id,
                  name: citySource.name,
                  stateId: state.id,
                },
              })
              citiesCreated += 1
            }

            for (const areaSource of citySource.areas) {
              const area = await tx.area.findFirst({
                where: { cityId: city.id, name: areaSource.name },
              })
              if (!area) {
                await tx.area.create({
                  data: {
                    id: areaSource.id,
                    name: areaSource.name,
                    cityId: city.id,
                  },
                })
                areasCreated += 1
              }
            }
          }
        }

        return { countriesCreated, statesCreated, citiesCreated, areasCreated }
      })

      await createAuditLog({
        action: 'CREATE',
        category: 'SYSTEM',
        userId: security.adminId,
        userEmail: security.email,
        userRole: security.role,
        entityType: 'LocationHierarchy',
        entityId: countryCode,
        entityName: source.name,
        description: 'CRM static location fallback seeded into canonical database hierarchy',
        newValue: summary,
        ipAddress: security.ipAddress,
        userAgent: security.userAgent || undefined,
        riskLevel: 'MEDIUM',
      })

      return NextResponse.json({ success: true, countryCode, summary }, { status: 201 })
    }

    if (!['country', 'state', 'city', 'area'].includes(type)) {
      return NextResponse.json({ error: 'Invalid location type' }, { status: 400 })
    }

    const name = cleanName(body?.name)
    if (name.length < 2) {
      return NextResponse.json({ error: 'Location name is required' }, { status: 400 })
    }

    let created: any
    let countryCode = ''

    if (type === 'country') {
      if (!security.isSuperAdmin) {
        return NextResponse.json({ error: 'SUPER_ADMIN required to create a country' }, { status: 403 })
      }

      const code = cleanCode(body?.code)
      if (code.length !== 2) {
        return NextResponse.json({ error: 'Two-letter country code is required' }, { status: 400 })
      }

      const existing = await prisma.country.findUnique({ where: { code } })
      if (existing) {
        return NextResponse.json({ error: 'Country code already exists' }, { status: 409 })
      }

      created = await prisma.country.create({ data: { name, code } })
      countryCode = code
    } else if (type === 'state') {
      const countryId = typeof body?.countryId === 'string' ? body.countryId : ''
      const country = await prisma.country.findUnique({ where: { id: countryId } })
      if (!country) return NextResponse.json({ error: 'Country not found' }, { status: 404 })
      if (!canAccessMarket(security, country.code)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      const duplicate = await prisma.state.findFirst({ where: { countryId, name } })
      if (duplicate) return NextResponse.json({ error: 'State/province already exists' }, { status: 409 })

      created = await prisma.state.create({ data: { name, countryId } })
      countryCode = country.code
    } else if (type === 'city') {
      const stateId = typeof body?.stateId === 'string' ? body.stateId : ''
      const state = await prisma.state.findUnique({
        where: { id: stateId },
        include: { country: true },
      })
      if (!state) return NextResponse.json({ error: 'State/province not found' }, { status: 404 })
      if (!canAccessMarket(security, state.country.code)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      const duplicate = await prisma.city.findFirst({ where: { stateId, name } })
      if (duplicate) return NextResponse.json({ error: 'City already exists' }, { status: 409 })

      created = await prisma.city.create({ data: { name, stateId } })
      countryCode = state.country.code
    } else {
      const cityId = typeof body?.cityId === 'string' ? body.cityId : ''
      const city = await prisma.city.findUnique({
        where: { id: cityId },
        include: { state: { include: { country: true } } },
      })
      if (!city) return NextResponse.json({ error: 'City not found' }, { status: 404 })
      if (!canAccessMarket(security, city.state.country.code)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      const duplicate = await prisma.area.findFirst({ where: { cityId, name } })
      if (duplicate) return NextResponse.json({ error: 'Area already exists' }, { status: 409 })

      created = await prisma.area.create({ data: { name, cityId } })
      countryCode = city.state.country.code
    }

    await createAuditLog({
      action: 'CREATE',
      category: 'SYSTEM',
      userId: security.adminId,
      userEmail: security.email,
      userRole: security.role,
      entityType: `Location:${type}`,
      entityId: created.id,
      entityName: created.name,
      description: `CRM ${type} created`,
      newValue: { ...created, countryCode },
      ipAddress: security.ipAddress,
      userAgent: security.userAgent || undefined,
      riskLevel: 'MEDIUM',
    })

    return NextResponse.json({ item: created, countryCode }, { status: 201 })
  } catch (error) {
    console.error('CRM locations POST error:', error)
    return NextResponse.json({ error: 'Failed to create location' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'markets:manage',
      level: 'sensitive',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const body = await request.json().catch(() => ({}))
    const type = typeof body?.type === 'string' ? body.type as LocationType : null
    const id = typeof body?.id === 'string' ? body.id : ''
    const name = cleanName(body?.name)

    if (!type || !['country', 'state', 'city', 'area'].includes(type) || !id || name.length < 2) {
      return NextResponse.json({ error: 'Invalid location update' }, { status: 400 })
    }

    const countryCode = await entityMarket(type, id)
    if (!countryCode) return NextResponse.json({ error: 'Location not found' }, { status: 404 })
    if (!canAccessMarket(security, countryCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (type === 'country' && !security.isSuperAdmin) {
      return NextResponse.json({ error: 'SUPER_ADMIN required to rename a country' }, { status: 403 })
    }

    let oldValue: any
    let updated: any

    if (type === 'country') {
      oldValue = await prisma.country.findUnique({ where: { id } })
      updated = await prisma.country.update({ where: { id }, data: { name } })
    } else if (type === 'state') {
      oldValue = await prisma.state.findUnique({ where: { id } })
      updated = await prisma.state.update({ where: { id }, data: { name } })
    } else if (type === 'city') {
      oldValue = await prisma.city.findUnique({ where: { id } })
      updated = await prisma.city.update({ where: { id }, data: { name } })
    } else {
      oldValue = await prisma.area.findUnique({ where: { id } })
      updated = await prisma.area.update({ where: { id }, data: { name } })
    }

    await createAuditLog({
      action: 'UPDATE',
      category: 'SYSTEM',
      userId: security.adminId,
      userEmail: security.email,
      userRole: security.role,
      entityType: `Location:${type}`,
      entityId: id,
      entityName: oldValue?.name || name,
      description: `CRM ${type} renamed`,
      oldValue: { name: oldValue?.name },
      newValue: { name, countryCode },
      ipAddress: security.ipAddress,
      userAgent: security.userAgent || undefined,
      riskLevel: 'MEDIUM',
    })

    return NextResponse.json({ item: updated, countryCode })
  } catch (error) {
    console.error('CRM locations PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update location' }, { status: 500 })
  }
}
