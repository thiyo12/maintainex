import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/admin-auth'

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

    const where: any = {}
    if (status && status !== 'ALL') where.status = status

    const documents = await prisma.identityDocument.findMany({
      where,
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

    const total = await prisma.identityDocument.count({ where })

    const summary = {
      pending: await prisma.identityDocument.count({ where: { status: 'PENDING' } }),
      verified: await prisma.identityDocument.count({ where: { status: 'APPROVED' } }),
      rejected: await prisma.identityDocument.count({ where: { status: 'REJECTED' } }),
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
      select: { userId: true },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const updated = await prisma.identityDocument.update({
      where: { id: documentId },
      data: {
        status,
        reviewNote: reviewNote || null,
        reviewedAt: new Date(),
      },
    })

    if (status === 'APPROVED') {
      const user = await prisma.user.findUnique({
        where: { id: document.userId },
        include: { taskerProfile: true, companyProfile: true },
      })

      if (user?.taskerProfile) {
        await prisma.taskerProfile.update({
          where: { id: user.taskerProfile.id },
          data: {
            verificationStatus: 'VERIFIED',
            verificationNote: 'Documents verified',
            verifiedAt: new Date(),
            isVerified: true,
          },
        })
      }

      if (user?.companyProfile) {
        await prisma.companyProfile.update({
          where: { id: user.companyProfile.id },
          data: {
            verificationStatus: 'VERIFIED',
            verificationNote: 'Documents verified',
            verifiedAt: new Date(),
            isVerified: true,
          },
        })
      }
    }

    if (status === 'REJECTED') {
      const user = await prisma.user.findUnique({
        where: { id: document.userId },
        include: { taskerProfile: true, companyProfile: true },
      })

      if (user?.taskerProfile) {
        await prisma.taskerProfile.update({
          where: { id: user.taskerProfile.id },
          data: {
            verificationStatus: 'REJECTED',
            verificationNote: reviewNote || 'Document rejected',
          },
        })
      }

      if (user?.companyProfile) {
        await prisma.companyProfile.update({
          where: { id: user.companyProfile.id },
          data: {
            verificationStatus: 'REJECTED',
            verificationNote: reviewNote || 'Document rejected',
          },
        })
      }
    }

    return NextResponse.json({ document: updated })
  } catch (error) {
    console.error('KYC PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update KYC document' }, { status: 500 })
  }
}
