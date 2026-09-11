import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/admin-auth'
import { getCountryFilter } from '@/lib/admin-rbac'
import { transitionUserKyc } from '@/lib/phase6/kyc-writer'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'USER_MANAGEMENT']

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession(request)
    if (!session || !ALLOWED_ROLES.includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = (page - 1) * limit

    const countryFilter = getCountryFilter(session)

    const where: any = {}
    if (status && status !== 'ALL') where.status = status

    const documents = await prisma.identityDocument.findMany({
      where: { ...where, ...countryFilter },
      include: {
        user: {
          select: {
            id: true,
            mxId: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            taskerProfile: {
              select: {
                id: true,
                mxId: true,
                verificationStatus: true,
                bio: true,
                skills: true,
                experienceProofUrl: true,
                hasDrivingLicense: true,
                drivingLicenseUrl: true,
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
                registrationNo: true,
                taxId: true,
                minStaffCount: true,
                staffCount: true,
                staffProofUrl: true,
                businessRegDocUrl: true,
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
    })

    const total = await prisma.identityDocument.count({ where: { ...where, ...countryFilter } })

    const summary = {
      pending: await prisma.identityDocument.count({ where: { status: 'PENDING', ...countryFilter } }),
      verified: await prisma.identityDocument.count({ where: { status: 'APPROVED', ...countryFilter } }),
      rejected: await prisma.identityDocument.count({ where: { status: 'REJECTED', ...countryFilter } }),
    }

    return NextResponse.json({
      documents,
      summary,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('KYC GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch KYC submissions' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getAdminSession(request)
    if (!session || !ALLOWED_ROLES.includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await request.json()
    const { documentId, status, reviewNote } = body

    if (!documentId || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    if (status === 'REJECTED' && !reviewNote?.trim()) {
      return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 })
    }

    const document = await prisma.identityDocument.findUnique({
      where: { id: documentId },
      select: { userId: true, countryCode: true },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    if (session.role !== 'SUPER_ADMIN') {
      const countryFilter = getCountryFilter(session)
      if (countryFilter.id === '__NONE__') {
        return NextResponse.json({ error: 'No country assigned' }, { status: 403 })
      }
      if (countryFilter.countryCode && !countryFilter.countryCode.in?.includes(document.countryCode || 'LK')) {
        return NextResponse.json({ error: 'Forbidden: document belongs to a different country' }, { status: 403 })
      }
    }

    const action = status === 'APPROVED' ? 'APPROVE' : 'REJECT'
    const result = await transitionUserKyc(prisma, {
      userId: document.userId,
      action,
      documentId,
      reviewNote: reviewNote || undefined,
      reviewedBy: session.adminUserId,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    const updated = await prisma.identityDocument.findUnique({
      where: { id: documentId },
    })

    return NextResponse.json({ document: updated })
  } catch (error) {
    console.error('KYC PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update KYC document' }, { status: 500 })
  }
}
