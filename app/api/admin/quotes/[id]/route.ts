import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  assertCrmCountryAllowed,
  guardCrmRequest,
} from '@/lib/crm/security'
import { evaluateEffectivePermission } from '@/lib/crm/governance'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await guardCrmRequest(request, {
      level: 'read',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const canRead = ['jobs:view', 'commission:view'].some(permission =>
      evaluateEffectivePermission({
        role: security.role,
        permission,
        overrides: security.permissionOverrides,
      }).allowed
    )
    if (!canRead) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    if (!id || id.length > 128) {
      return NextResponse.json({ error: 'Invalid quote ID' }, { status: 400 })
    }

    const quote = await prisma.jobQuote.findUnique({
      where: { id },
      include: {
        lineItems: { orderBy: { sortOrder: 'asc' } },
      },
    })
    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    const job = await prisma.marketplaceJob.findUnique({
      where: { id: quote.jobId },
      select: { id: true, title: true, countryCode: true },
    })
    if (!job) {
      return NextResponse.json({ error: 'Quote job not found' }, { status: 404 })
    }
    if (!assertCrmCountryAllowed(security, job.countryCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let provider: Record<string, unknown> | null = null
    if (quote.providerType === 'COMPANY') {
      const company = await prisma.companyProfile.findUnique({
        where: { id: quote.providerId },
        select: {
          id: true,
          mxId: true,
          companyName: true,
          verificationStatus: true,
          countryCode: true,
        },
      })
      provider = company
        ? {
            id: company.id,
            mxId: company.mxId,
            name: company.companyName,
            providerType: 'COMPANY',
            verificationStatus: company.verificationStatus,
          }
        : null
    } else {
      const user = await prisma.user.findUnique({
        where: { id: quote.providerId },
        select: {
          id: true,
          mxId: true,
          name: true,
          role: true,
          taskerProfile: {
            select: { verificationStatus: true },
          },
        },
      })
      provider = user
        ? {
            id: user.id,
            mxId: user.mxId,
            name: user.name,
            providerType: quote.providerType,
            verificationStatus: user.taskerProfile?.verificationStatus || null,
          }
        : null
    }

    const revisions = await prisma.jobQuote.findMany({
      where: { parentQuoteId: id },
      orderBy: { revisionNumber: 'asc' },
      select: {
        id: true,
        revisionNumber: true,
        status: true,
        price: true,
        currency: true,
        createdAt: true,
        revisionReason: true,
      },
    })

    return NextResponse.json(
      {
        quote: {
          ...quote,
          price: quote.price.toString(),
          subtotalCents: quote.subtotalCents?.toString() || null,
          taxCents: quote.taxCents?.toString() || null,
          totalCents: quote.totalCents?.toString() || null,
          lineItems: quote.lineItems.map(item => ({
            ...item,
            unitAmountCents: item.unitAmountCents.toString(),
            totalAmountCents: item.totalAmountCents.toString(),
          })),
        },
        provider,
        job,
        revisions: revisions.map(item => ({
          ...item,
          price: item.price.toString(),
        })),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('CRM quote detail error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
