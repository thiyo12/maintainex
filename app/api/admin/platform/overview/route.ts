import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { guardCrmRequest } from '@/lib/crm/security'

const SETTING_KEYS = [
  'platformName',
  'supportEmail',
  'currency',
  'maintenanceMode',
  'commissionRate',
  'weeklySettlementDay',
  'minTaskerStaff',
  'autoApproveKyc',
]

function parseSetting(value: string, type: string) {
  if (type === 'boolean') return value === 'true'
  if (type === 'number') return Number(value)
  return value
}

export async function GET(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'platform:settings:view',
      level: 'read',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const countryFilter = security.isSuperAdmin
      ? {}
      : { countryCode: { in: security.assignedCountries } }

    const seasonalFilter = security.isSuperAdmin
      ? {}
      : { country: { in: security.assignedCountries } }

    const deviceUserFilter = security.isSuperAdmin
      ? {}
      : { user: { countryCode: { in: security.assignedCountries } } }

    const marketFilter = security.isSuperAdmin
      ? {}
      : {
          OR: [
            { countryCode: 'GLOBAL' },
            { countryCode: { in: security.assignedCountries } },
          ],
        }

    const [
      settingsRows,
      activeCategories,
      inactiveCategories,
      activeServices,
      inactiveServices,
      trendingServices,
      activeTemplates,
      inactiveTemplates,
      seasonalOffers,
      activeSeasonalOffers,
      activeFlashOffers,
      marketConfigs,
      deviceGroups,
      activeWishlist,
      recentServices,
      recentTemplates,
      recentSeasonal,
    ] = await Promise.all([
      prisma.settings.findMany({
        where: { key: { in: SETTING_KEYS } },
        orderBy: { key: 'asc' },
      }),
      prisma.category.count({ where: { isActive: true, ...countryFilter } }),
      prisma.category.count({ where: { isActive: false, ...countryFilter } }),
      prisma.service.count({ where: { isActive: true, ...countryFilter } }),
      prisma.service.count({ where: { isActive: false, ...countryFilter } }),
      prisma.service.count({ where: { isTrending: true, isActive: true, ...countryFilter } }),
      prisma.serviceTemplate.count({ where: { isActive: true, ...countryFilter } }),
      prisma.serviceTemplate.count({ where: { isActive: false, ...countryFilter } }),
      prisma.seasonalOffer.count({ where: seasonalFilter }),
      prisma.seasonalOffer.count({ where: { isActive: true, ...seasonalFilter } }),
      prisma.flashOffer.count({
        where: {
          isActive: true,
          expiresAt: { gt: new Date() },
        },
      }),
      prisma.marketConfig.findMany({
        where: marketFilter,
        orderBy: { countryCode: 'asc' },
      }),
      prisma.userDevice.groupBy({
        by: ['platform'],
        where: deviceUserFilter,
        _count: true,
      }),
      prisma.wishlistItem.count({
        where: { status: { in: ['NEW', 'PLANNED', 'IN_PROGRESS'] } },
      }),
      prisma.service.findMany({
        where: countryFilter,
        select: {
          id: true,
          name: true,
          slug: true,
          countryCode: true,
          isActive: true,
          isTrending: true,
          views: true,
          createdAt: true,
          category: { select: { id: true, name: true, slug: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      prisma.serviceTemplate.findMany({
        where: countryFilter,
        select: {
          id: true,
          name: true,
          slug: true,
          countryCode: true,
          isActive: true,
          pricingMode: true,
          priceMin: true,
          priceMax: true,
          currency: true,
          createdAt: true,
          jobCategory: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      prisma.seasonalOffer.findMany({
        where: seasonalFilter,
        select: {
          id: true,
          title: true,
          season: true,
          country: true,
          isActive: true,
          displayOrder: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
    ])

    const settings = Object.fromEntries(
      settingsRows.map(row => [
        row.key,
        {
          value: parseSetting(row.value, row.type),
          type: row.type,
          label: row.label,
          description: row.description,
          groupName: row.groupName,
          updatedBy: row.updatedBy,
          updatedAt: row.updatedAt,
        },
      ])
    )

    return NextResponse.json(
      {
        scope: {
          superAdmin: security.isSuperAdmin,
          countries: security.assignedCountries,
        },
        settings,
        catalog: {
          categories: { active: activeCategories, inactive: inactiveCategories },
          services: {
            active: activeServices,
            inactive: inactiveServices,
            trending: trendingServices,
          },
          serviceTemplates: {
            active: activeTemplates,
            inactive: inactiveTemplates,
          },
          recentServices,
          recentTemplates,
        },
        offers: {
          seasonal: seasonalOffers,
          activeSeasonal: activeSeasonalOffers,
          activeFlash: activeFlashOffers,
          recentSeasonal,
        },
        mobile: {
          marketConfigs: marketConfigs.map(config => ({
            ...config,
            currency: config.defaultCurrency,
            commissionBps: config.commissionRateBps,
            minJobAmountCents: config.minJobAmountCents.toString(),
            maxJobAmountCents: config.maxJobAmountCents.toString(),
          })),
          devices: deviceGroups.map(row => ({
            platform: row.platform,
            count: row._count,
          })),
        },
        backlog: {
          activeWishlist,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    secureConsole.error('CRM platform overview GET error:', error)
    return NextResponse.json({ error: 'Failed to load platform management' }, { status: 500 })
  }
}
