import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assertCrmCountryAllowed, guardCrmRequest } from '@/lib/crm/security'
import { serializeBigInts } from '@/lib/crm/benchmark-utils'
import { createAuditLog } from '@/lib/crm/audit'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await guardCrmRequest(request, {
      allowedRoles: ['SUPER_ADMIN', 'FINANCE'],
      level: 'sensitive',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const { id } = await params
    const existing = await prisma.priceBenchmark.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'Benchmark not found' }, { status: 404 })
    if (!assertCrmCountryAllowed(security, existing.countryCode)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (existing.status !== 'PUBLISHED') {
      return NextResponse.json({ error: `Cannot supersede a benchmark with status ${existing.status}. Only PUBLISHED benchmarks can be superseded.` }, { status: 409 })
    }

    const [superseded, newBenchmark] = await prisma.$transaction([
      prisma.priceBenchmark.update({
        where: { id },
        data: { status: 'SUPERSEDED', effectiveTo: new Date() },
      }),
      prisma.priceBenchmark.create({
        data: {
          serviceTemplateId: existing.serviceTemplateId,
          countryCode: existing.countryCode,
          region: existing.region,
          city: existing.city,
          currency: existing.currency,
          pricingMode: existing.pricingMode,
          sampleSize: 0,
          medianAmountCents: existing.medianAmountCents,
          lowerPercentileCents: existing.lowerPercentileCents,
          upperPercentileCents: existing.upperPercentileCents,
          minimumObservedCents: existing.minimumObservedCents,
          maximumObservedCents: existing.maximumObservedCents,
          sourceType: existing.sourceType,
          sourceReference: existing.sourceReference,
          methodologyNote: existing.methodologyNote,
          geographyLevel: existing.geographyLevel,
          status: 'DRAFT',
          version: existing.version + 1,
          createdBy: security.adminId,
          supersededFromId: id,
        },
      }),
    ])

    await createAuditLog({
      action: 'UPDATE', category: 'FINANCE', userId: security.adminId, userEmail: security.email, userRole: security.role,
      entityType: 'PriceBenchmark', entityId: id, entityName: existing.serviceTemplateId,
      description: 'CRM published benchmark superseded and replacement draft created',
      oldValue: { status: existing.status, version: existing.version },
      newValue: { status: superseded.status, newBenchmarkId: newBenchmark.id, newVersion: newBenchmark.version },
      ipAddress: security.ipAddress, userAgent: security.userAgent || undefined, riskLevel: 'HIGH',
    })

    return NextResponse.json({
      superseded: serializeBigInts(superseded),
      newBenchmark: serializeBigInts(newBenchmark),
      message: `Benchmark superseded. New draft v${newBenchmark.version} created.`,
    })
  } catch (error) {
    console.error('CRM benchmark supersede error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
