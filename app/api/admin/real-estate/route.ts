import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assertCrmCountryAllowed, guardCrmRequest } from '@/lib/crm/security'
import { createAuditLog } from '@/lib/crm/audit'
import { evaluateEffectivePermission } from '@/lib/crm/governance/permissions'
import { safeParseJsonArr } from '@/lib/db-utils'

const LISTING_STATUSES = new Set(['draft', 'pending', 'approved', 'rejected', 'published'])
const MODERATION_ACTIONS = new Set(['approve', 'reject', 'feature', 'unfeature'])

function normalizeCountry(value: string | null): string | null {
  if (!value || value === 'ALL') return null
  const normalized = value.trim().toUpperCase()
  return /^[A-Z]{2}$/.test(normalized) ? normalized : ''
}

export async function GET(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'real_estate:view',
      level: 'read',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const { searchParams } = new URL(request.url)
    const requestedCountry = normalizeCountry(searchParams.get('country'))
    if (requestedCountry === '') {
      return NextResponse.json({ error: 'Invalid market' }, { status: 400 })
    }
    if (requestedCountry && !assertCrmCountryAllowed(security, requestedCountry)) {
      return NextResponse.json({ error: 'Forbidden market' }, { status: 403 })
    }

    const requestedStatus = searchParams.get('status')
    const status = requestedStatus && requestedStatus !== 'ALL' && LISTING_STATUSES.has(requestedStatus)
      ? requestedStatus
      : null
    const q = searchParams.get('q')?.trim().slice(0, 120) || ''

    const scopeWhere: any = requestedCountry
      ? { countryCode: requestedCountry }
      : security.isSuperAdmin
        ? {}
        : { countryCode: { in: security.assignedCountries } }

    const listingWhere: any = { ...scopeWhere }
    if (status) listingWhere.status = status
    if (q) {
      listingWhere.OR = [
        { title: { contains: q } },
        { district: { contains: q } },
        { city: { contains: q } },
        { area: { contains: q } },
      ]
    }

    const now = new Date()
    const [
      listings,
      total,
      pending,
      approved,
      rejected,
      featured,
      activeBoosts,
    ] = await Promise.all([
      prisma.realEstateListing.findMany({
        where: listingWhere,
        orderBy: [{ createdAt: 'desc' }],
        take: 200,
      }),
      prisma.realEstateListing.count({ where: scopeWhere }),
      prisma.realEstateListing.count({ where: { ...scopeWhere, status: 'pending' } }),
      prisma.realEstateListing.count({
        where: { ...scopeWhere, status: { in: ['approved', 'published'] } },
      }),
      prisma.realEstateListing.count({ where: { ...scopeWhere, status: 'rejected' } }),
      prisma.realEstateListing.count({ where: { ...scopeWhere, isFeatured: true } }),
      prisma.realEstateListing.count({
        where: { ...scopeWhere, boostExpiresAt: { gt: now } },
      }),
    ])

    const sellerIds = [...new Set(listings.map(item => item.postedBy))]
    const sellers = sellerIds.length
      ? await prisma.user.findMany({
          where: { id: { in: sellerIds } },
          select: {
            id: true,
            mxId: true,
            name: true,
            countryCode: true,
            isActive: true,
            isSuspended: true,
            isBanned: true,
          },
        })
      : []
    const sellerMap = new Map(sellers.map(seller => [seller.id, seller]))

    const listingIds = listings.map(item => item.id)
    const inquiries = listingIds.length
      ? await prisma.propertyInquiry.findMany({
          where: { listingId: { in: listingIds } },
          orderBy: { createdAt: 'desc' },
          take: 100,
        })
      : []

    const inquiryUserIds = [...new Set(inquiries.flatMap(item => [item.buyerId, item.sellerId]))]
    const inquiryUsers = inquiryUserIds.length
      ? await prisma.user.findMany({
          where: { id: { in: inquiryUserIds } },
          select: { id: true, mxId: true, name: true },
        })
      : []
    const inquiryUserMap = new Map(inquiryUsers.map(user => [user.id, user]))
    const listingMap = new Map(listings.map(item => [item.id, item]))

    const canManage = evaluateEffectivePermission({
      role: security.role,
      permission: 'real_estate:manage',
      permissionClass: 'SENSITIVE',
      overrides: security.permissionOverrides,
    }).allowed

    return NextResponse.json(
      {
        metrics: {
          total,
          pending,
          approved,
          rejected,
          featured,
          activeBoosts,
        },
        listings: listings.map(item => {
          const seller = sellerMap.get(item.postedBy)
          return {
            id: item.id,
            postedBy: item.postedBy,
            seller: seller
              ? {
                  mxId: seller.mxId,
                  name: seller.name,
                  countryCode: seller.countryCode,
                  accountState: seller.isBanned
                    ? 'BANNED'
                    : seller.isSuspended
                      ? 'SUSPENDED'
                      : seller.isActive
                        ? 'ACTIVE'
                        : 'INACTIVE',
                }
              : null,
            title: item.title,
            description: item.description,
            propertyType: item.propertyType,
            purpose: item.purpose,
            price: item.priceLkr,
            countryCode: item.countryCode,
            district: item.district,
            city: item.city,
            area: item.area,
            address: item.address,
            bedrooms: item.bedrooms,
            bathrooms: item.bathrooms,
            areaSqft: item.areaSqft || item.propertySize,
            photos: safeParseJsonArr(item.photos),
            status: item.status,
            rejectionReason: item.rejectionReason,
            isFeatured: item.isFeatured,
            boostTier: item.boostTier,
            boostExpiresAt: item.boostExpiresAt,
            views: item.views,
            saves: item.saves,
            inquiries: item.inquiries,
            hasContact: Boolean(item.contactPhone || item.contactName),
            reviewedBy: item.reviewedBy,
            reviewedAt: item.reviewedAt,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
          }
        }),
        inquiries: inquiries.map(item => {
          const listing = listingMap.get(item.listingId)
          const buyer = inquiryUserMap.get(item.buyerId)
          const seller = inquiryUserMap.get(item.sellerId)
          return {
            id: item.id,
            listingId: item.listingId,
            listingTitle: listing?.title || 'Unknown listing',
            countryCode: listing?.countryCode || null,
            buyer: buyer ? { mxId: buyer.mxId, name: buyer.name } : null,
            seller: seller ? { mxId: seller.mxId, name: seller.name } : null,
            type: item.type,
            status: item.status,
            hasMessage: Boolean(item.message),
            createdAt: item.createdAt,
          }
        }),
        canManage,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('CRM real estate GET error:', error)
    return NextResponse.json({ error: 'Failed to load real-estate operations' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'real_estate:manage',
      level: 'sensitive',
      requireCountryScope: true,
      permissionClass: 'SENSITIVE',
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const body = await request.json().catch(() => ({}))
    const id = typeof body?.id === 'string' ? body.id.trim() : ''
    const action = typeof body?.action === 'string' ? body.action.trim().toLowerCase() : ''
    const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 1200) : ''

    if (!id || id.length > 128 || !MODERATION_ACTIONS.has(action)) {
      return NextResponse.json({ error: 'Invalid moderation request' }, { status: 400 })
    }

    const current = await prisma.realEstateListing.findUnique({ where: { id } })
    if (!current) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
    }
    if (!assertCrmCountryAllowed(security, current.countryCode)) {
      return NextResponse.json({ error: 'Forbidden market' }, { status: 403 })
    }

    const data: Record<string, unknown> = {}
    let auditAction = 'PROPERTY_UPDATE'
    let description = 'CRM property moderation updated'
    let riskLevel: 'MEDIUM' | 'HIGH' = 'HIGH'

    if (action === 'approve') {
      if (!['pending', 'rejected'].includes(current.status)) {
        return NextResponse.json({ error: 'Only pending or rejected listings can be approved' }, { status: 409 })
      }
      data.status = 'approved'
      data.rejectionReason = null
      data.reviewedBy = security.adminId
      data.reviewedAt = new Date()
      auditAction = 'PROPERTY_APPROVE'
      description = 'CRM property listing approved'
    } else if (action === 'reject') {
      if (reason.length < 3) {
        return NextResponse.json({ error: 'A rejection reason is required' }, { status: 400 })
      }
      if (current.status === 'draft') {
        return NextResponse.json({ error: 'Draft listings must be submitted before moderation' }, { status: 409 })
      }
      data.status = 'rejected'
      data.rejectionReason = reason
      data.reviewedBy = security.adminId
      data.reviewedAt = new Date()
      data.isFeatured = false
      auditAction = 'PROPERTY_REJECT'
      description = 'CRM property listing rejected'
    } else if (action === 'feature') {
      if (!['approved', 'published'].includes(current.status)) {
        return NextResponse.json({ error: 'Only public listings can be featured' }, { status: 409 })
      }
      data.isFeatured = true
      auditAction = 'PROPERTY_FEATURE'
      description = 'CRM property listing featured'
      riskLevel = 'MEDIUM'
    } else if (action === 'unfeature') {
      data.isFeatured = false
      auditAction = 'PROPERTY_FEATURE'
      description = 'CRM property listing unfeatured'
      riskLevel = 'MEDIUM'
    }

    const updated = await prisma.realEstateListing.update({
      where: { id },
      data,
    })

    await createAuditLog({
      action: auditAction,
      category: 'REAL_ESTATE',
      userId: security.adminId,
      userEmail: security.email,
      userRole: security.role,
      entityType: 'RealEstateListing',
      entityId: current.id,
      entityName: current.title,
      description,
      oldValue: {
        status: current.status,
        isFeatured: current.isFeatured,
        rejectionReason: current.rejectionReason,
      },
      newValue: {
        status: updated.status,
        isFeatured: updated.isFeatured,
        rejectionReason: updated.rejectionReason,
      },
      ipAddress: security.ipAddress,
      userAgent: security.userAgent || undefined,
      sessionId: security.sessionId,
      riskLevel,
    })

    return NextResponse.json({
      listing: {
        id: updated.id,
        status: updated.status,
        isFeatured: updated.isFeatured,
        rejectionReason: updated.rejectionReason,
        reviewedAt: updated.reviewedAt,
      },
    })
  } catch (error) {
    console.error('CRM real estate PATCH error:', error)
    return NextResponse.json({ error: 'Failed to moderate listing' }, { status: 500 })
  }
}
