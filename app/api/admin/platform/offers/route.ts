import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assertCrmCountryAllowed, guardCrmRequest } from '@/lib/crm/security'
import { createAuditLog } from '@/lib/crm/audit'

const SEASONS = new Set(['winter', 'spring', 'summer', 'fall', 'general'])
const DISCOUNT_TYPES = new Set(['PERCENTAGE', 'FLAT'])

export async function GET(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'promotions:view',
      level: 'read',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const seasonalWhere = security.isSuperAdmin
      ? {}
      : { country: { in: security.assignedCountries } }

    const [seasonal, flash] = await Promise.all([
      prisma.seasonalOffer.findMany({
        where: seasonalWhere,
        include: {
          _count: { select: { jobs: true } },
        },
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
      }),
      prisma.flashOffer.findMany({
        orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
      }),
    ])

    return NextResponse.json(
      {
        seasonal,
        flash: security.isSuperAdmin ? flash : flash.map(item => ({
          ...item,
          couponCode: null,
        })),
        canManageGlobalFlash: security.isSuperAdmin,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('CRM offers GET error:', error)
    return NextResponse.json({ error: 'Failed to load offers' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'promotions:manage',
      level: 'sensitive',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const body = await request.json().catch(() => ({}))
    const type = typeof body?.type === 'string' ? body.type.toLowerCase() : ''

    if (type === 'seasonal') {
      const title = typeof body?.title === 'string' ? body.title.trim().slice(0, 160) : ''
      const slug = typeof body?.slug === 'string'
        ? body.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 160)
        : title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      const season = typeof body?.season === 'string' ? body.season.toLowerCase() : ''
      const country = typeof body?.country === 'string' ? body.country.toUpperCase() : ''

      if (title.length < 2 || slug.length < 2 || !SEASONS.has(season) || !country) {
        return NextResponse.json({ error: 'Invalid seasonal offer payload' }, { status: 400 })
      }
      if (!assertCrmCountryAllowed(security, country)) {
        return NextResponse.json({ error: 'Forbidden country' }, { status: 403 })
      }

      const offer = await prisma.seasonalOffer.create({
        data: {
          title,
          slug,
          season,
          country,
          description: typeof body?.description === 'string' ? body.description.trim().slice(0, 1500) : null,
          badgeText: typeof body?.badgeText === 'string' ? body.badgeText.trim().slice(0, 80) : null,
          image: typeof body?.image === 'string' ? body.image.trim().slice(0, 1000) : null,
          bgColor: typeof body?.bgColor === 'string' ? body.bgColor.trim().slice(0, 32) : null,
          textColor: typeof body?.textColor === 'string' ? body.textColor.trim().slice(0, 32) : null,
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
        entityType: 'SeasonalOffer',
        entityId: offer.id,
        entityName: offer.title,
        description: 'CRM seasonal offer created',
        newValue: offer,
        ipAddress: security.ipAddress,
        userAgent: security.userAgent || undefined,
        riskLevel: 'MEDIUM',
      })
      return NextResponse.json({ offer }, { status: 201 })
    }

    if (type === 'flash') {
      if (!security.isSuperAdmin) {
        return NextResponse.json({ error: 'SUPER_ADMIN required for global flash offers' }, { status: 403 })
      }

      const title = typeof body?.title === 'string' ? body.title.trim().slice(0, 160) : ''
      const discountType = typeof body?.discountType === 'string' ? body.discountType.toUpperCase() : ''
      const discountValue = Number(body?.discountValue)
      const startsAt = new Date(body?.startsAt)
      const expiresAt = new Date(body?.expiresAt)

      if (
        title.length < 2 ||
        !DISCOUNT_TYPES.has(discountType) ||
        !Number.isFinite(discountValue) ||
        discountValue <= 0 ||
        (discountType === 'PERCENTAGE' && discountValue > 100) ||
        Number.isNaN(startsAt.getTime()) ||
        Number.isNaN(expiresAt.getTime()) ||
        expiresAt <= startsAt
      ) {
        return NextResponse.json({ error: 'Invalid flash offer payload' }, { status: 400 })
      }

      const offer = await prisma.flashOffer.create({
        data: {
          title,
          description: typeof body?.description === 'string' ? body.description.trim().slice(0, 1500) : null,
          discountType,
          discountValue,
          couponCode: typeof body?.couponCode === 'string' ? body.couponCode.trim().slice(0, 80) : null,
          linkUrl: typeof body?.linkUrl === 'string' ? body.linkUrl.trim().slice(0, 1000) : null,
          badgeText: typeof body?.badgeText === 'string' ? body.badgeText.trim().slice(0, 80) : '🔥 FLASH',
          bgColor: typeof body?.bgColor === 'string' ? body.bgColor.trim().slice(0, 32) : '#FFC300',
          textColor: typeof body?.textColor === 'string' ? body.textColor.trim().slice(0, 32) : '#1a1a1a',
          startsAt,
          expiresAt,
          maxClaims: Math.max(1, Math.min(100000, Number(body?.maxClaims || 50))),
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
        entityType: 'FlashOffer',
        entityId: offer.id,
        entityName: offer.title,
        description: 'CRM global flash offer created',
        newValue: { ...offer, couponCode: offer.couponCode ? '[PRESENT]' : null },
        ipAddress: security.ipAddress,
        userAgent: security.userAgent || undefined,
        riskLevel: 'MEDIUM',
      })
      return NextResponse.json({ offer }, { status: 201 })
    }

    return NextResponse.json({ error: 'type must be seasonal or flash' }, { status: 400 })
  } catch (error) {
    console.error('CRM offers POST error:', error)
    return NextResponse.json({ error: 'Failed to create offer' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'promotions:manage',
      level: 'sensitive',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const body = await request.json().catch(() => ({}))
    const type = typeof body?.type === 'string' ? body.type.toLowerCase() : ''
    const id = typeof body?.id === 'string' ? body.id : ''
    const isActive = body?.isActive

    if (!['seasonal', 'flash'].includes(type) || !id || typeof isActive !== 'boolean') {
      return NextResponse.json({ error: 'Invalid offer activation payload' }, { status: 400 })
    }

    if (type === 'seasonal') {
      const current = await prisma.seasonalOffer.findUnique({ where: { id } })
      if (!current) return NextResponse.json({ error: 'Seasonal offer not found' }, { status: 404 })
      if (!assertCrmCountryAllowed(security, current.country)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

      const updated = await prisma.seasonalOffer.update({
        where: { id },
        data: { isActive },
      })
      await createAuditLog({
        action: 'UPDATE',
        category: 'SYSTEM',
        userId: security.adminId,
        userEmail: security.email,
        userRole: security.role,
        entityType: 'SeasonalOffer',
        entityId: id,
        entityName: current.title,
        description: `CRM seasonal offer ${isActive ? 'activated' : 'deactivated'}`,
        oldValue: { isActive: current.isActive },
        newValue: { isActive },
        ipAddress: security.ipAddress,
        userAgent: security.userAgent || undefined,
        riskLevel: 'MEDIUM',
      })
      return NextResponse.json({ offer: updated })
    }

    if (!security.isSuperAdmin) {
      return NextResponse.json({ error: 'SUPER_ADMIN required for global flash offers' }, { status: 403 })
    }

    const current = await prisma.flashOffer.findUnique({ where: { id } })
    if (!current) return NextResponse.json({ error: 'Flash offer not found' }, { status: 404 })

    const updated = await prisma.flashOffer.update({
      where: { id },
      data: { isActive },
    })
    await createAuditLog({
      action: 'UPDATE',
      category: 'SYSTEM',
      userId: security.adminId,
      userEmail: security.email,
      userRole: security.role,
      entityType: 'FlashOffer',
      entityId: id,
      entityName: current.title,
      description: `CRM flash offer ${isActive ? 'activated' : 'deactivated'}`,
      oldValue: { isActive: current.isActive },
      newValue: { isActive },
      ipAddress: security.ipAddress,
      userAgent: security.userAgent || undefined,
      riskLevel: 'MEDIUM',
    })
    return NextResponse.json({ offer: updated })
  } catch (error) {
    console.error('CRM offers PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update offer' }, { status: 500 })
  }
}
