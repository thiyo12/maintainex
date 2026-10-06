import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assertCrmCountryAllowed, guardCrmRequest } from '@/lib/crm/security'
import { serializeBigInts } from '@/lib/crm/benchmark-utils'
import { createAuditLog } from '@/lib/crm/audit'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await guardCrmRequest(request, {
      allowedRoles: ['SUPER_ADMIN'],
      level: 'sensitive',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const { id } = await params
    const existing = await prisma.priceBenchmark.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Benchmark not found' }, { status: 404 })
    if (!assertCrmCountryAllowed(security, existing.countryCode)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (existing.status !== 'APPROVED') {
      return NextResponse.json({ error: `Cannot publish a benchmark with status ${existing.status}. Only APPROVED benchmarks can be published.` }, { status: 409 })
    }

    const geographyWhere =
      existing.geographyLevel === 'CITY' && existing.city
        ? { region: existing.region, city: existing.city }
        : existing.geographyLevel === 'PROVINCE' && existing.region
          ? { region: existing.region, city: null }
          : { region: null, city: null }

    const benchmark = await prisma.$transaction(async tx => {
      await tx.priceBenchmark.updateMany({
        where: {
          serviceTemplateId: existing.serviceTemplateId,
          countryCode: existing.countryCode,
          ...geographyWhere,
          status: 'PUBLISHED',
          id: { not: id },
        },
        data: { status: 'SUPERSEDED', effectiveTo: new Date() },
      })
      return tx.priceBenchmark.update({
        where: { id },
        data: { status: 'PUBLISHED', effectiveFrom: existing.effectiveFrom ?? new Date() },
      })
    })

    await createAuditLog({
      action: 'UPDATE', category: 'FINANCE', userId: security.adminId, userEmail: security.email, userRole: security.role,
      entityType: 'PriceBenchmark', entityId: id, entityName: existing.serviceTemplateId,
      description: 'CRM price benchmark published',
      oldValue: { status: existing.status }, newValue: { status: benchmark.status, effectiveFrom: benchmark.effectiveFrom },
      ipAddress: security.ipAddress, userAgent: security.userAgent || undefined, riskLevel: 'HIGH',
    })
    return NextResponse.json({ benchmark: serializeBigInts(benchmark) })
  } catch (error) {
    secureConsole.error('CRM benchmark publish error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
