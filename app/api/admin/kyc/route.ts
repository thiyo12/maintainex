import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  assertCrmCountryAllowed,
  getCrmCountryFilter,
  guardCrmRequest,
} from '@/lib/crm/security'
import { transitionUserKyc } from '@/lib/phase6/kyc-writer'
import { evaluateEffectivePermission } from '@/lib/crm/governance'

const VALID_STATUSES = new Set(['ALL', 'PENDING', 'APPROVED', 'REJECTED'])

export async function GET(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'kyc:view',
      level: 'read',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const { searchParams } = new URL(request.url)
    const status = (searchParams.get('status') || 'ALL').toUpperCase()
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')))
    const skip = (page - 1) * limit

    if (!VALID_STATUSES.has(status)) {
      return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 })
    }

    const countryFilter = getCrmCountryFilter(security)
    const where: any = { ...countryFilter }
    if (status !== 'ALL') where.status = status

    const [documents, total, pending, verified, rejected] = await Promise.all([
      prisma.identityDocument.findMany({
        where,
        select: {
          id: true,
          userId: true,
          docType: true,
          side: true,
          fullName: true,
          status: true,
          reviewNote: true,
          reviewedBy: true,
          reviewedAt: true,
          countryCode: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              mxId: true,
              name: true,
              email: true,
              role: true,
              taskerProfile: {
                select: {
                  id: true,
                  mxId: true,
                  verificationStatus: true,
                  hasDrivingLicense: true,
                  completedJobs: true,
                  rating: true,
                },
              },
              companyProfile: {
                select: {
                  id: true,
                  mxId: true,
                  companyName: true,
                  verificationStatus: true,
                  staffCount: true,
                  completedProjects: true,
                  rating: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      prisma.identityDocument.count({ where }),
      prisma.identityDocument.count({ where: { status: 'PENDING', ...countryFilter } }),
      prisma.identityDocument.count({ where: { status: 'APPROVED', ...countryFilter } }),
      prisma.identityDocument.count({ where: { status: 'REJECTED', ...countryFilter } }),
    ])

    return NextResponse.json(
      {
        documents,
        summary: { pending, verified, rejected },
        pagination: {
          page,
          limit,
          total,
          pages: Math.max(1, Math.ceil(total / limit)),
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('CRM KYC GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch KYC submissions' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'kyc:view',
      level: 'sensitive',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const body = await request.json().catch(() => ({}))
    const documentId = typeof body?.documentId === 'string' ? body.documentId : ''
    const status = typeof body?.status === 'string' ? body.status.toUpperCase() : ''
    const reviewNote = typeof body?.reviewNote === 'string'
      ? body.reviewNote.trim().slice(0, 2000)
      : undefined

    if (!documentId || !['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json({ error: 'Invalid KYC action payload' }, { status: 400 })
    }

    const requiredPermission = status === 'APPROVED' ? 'kyc:approve' : 'kyc:reject'
    const permission = evaluateEffectivePermission({
      role: security.role,
      permission: requiredPermission,
      permissionClass: 'SENSITIVE',
      overrides: security.permissionOverrides,
    })
    if (!permission.allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (status === 'REJECTED' && !reviewNote) {
      return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 })
    }

    const document = await prisma.identityDocument.findUnique({
      where: { id: documentId },
      select: {
        userId: true,
        countryCode: true,
      },
    })
    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }
    if (!assertCrmCountryAllowed(security, document.countryCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const action = status === 'APPROVED' ? 'APPROVE' : 'REJECT'
    const result = await transitionUserKyc(prisma, {
      userId: document.userId,
      action,
      documentId,
      reviewNote,
      reviewedBy: security.adminId,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    const updated = await prisma.identityDocument.findUnique({
      where: { id: documentId },
    })

    return NextResponse.json({ document: updated })
  } catch (error) {
    console.error('CRM KYC PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update KYC document' }, { status: 500 })
  }
}
