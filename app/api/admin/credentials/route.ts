import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCrmCountryCodes, guardCrmRequest } from '@/lib/crm/security'

export async function GET(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'credentials:read',
      level: 'read',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const { searchParams } = new URL(request.url)
    const status = (searchParams.get('status') || 'PENDING').toUpperCase()
    const holderType = (searchParams.get('holderType') || '').toUpperCase()
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20')))
    const skip = (page - 1) * pageSize

    if (!['ALL', 'PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 })
    }
    if (holderType && !['INDIVIDUAL', 'COMPANY'].includes(holderType)) {
      return NextResponse.json({ error: 'Invalid holder type' }, { status: 400 })
    }

    const filters: any[] = []
    if (status !== 'ALL') filters.push({ verificationStatus: status })
    if (holderType) filters.push({ holderType })

    const scopedCountryCodes = getCrmCountryCodes(security)
    if (scopedCountryCodes !== null) {
      const [users, companies] = await Promise.all([
        prisma.user.findMany({
          where: { countryCode: { in: scopedCountryCodes } },
          select: { id: true },
        }),
        prisma.companyProfile.findMany({
          where: { countryCode: { in: scopedCountryCodes } },
          select: { id: true },
        }),
      ])

      filters.push({
        OR: [
          { holderType: 'INDIVIDUAL', holderId: { in: users.map(user => user.id) } },
          { holderType: 'COMPANY', holderId: { in: companies.map(company => company.id) } },
        ],
      })
    }

    const where: any = filters.length ? { AND: filters } : {}

    const [credentials, total] = await Promise.all([
      prisma.certification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.certification.count({ where }),
    ])

    return NextResponse.json(
      {
        credentials,
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('CRM credentials GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
