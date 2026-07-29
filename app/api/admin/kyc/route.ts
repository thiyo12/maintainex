import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET: List all KYC submissions with optional status filter
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // PENDING, VERIFIED, REJECTED
    const type = searchParams.get('type') // TASKER, COMPANY
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const where: any = {}
    if (status) where.status = status

    // Get identity documents
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
                rating: true
              }
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
                rating: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    })

    const total = await prisma.identityDocument.count({ where })

    const summary = {
      pending: await prisma.identityDocument.count({ where: { status: 'PENDING' } }),
      verified: await prisma.identityDocument.count({ where: { status: 'APPROVED' } }),
      rejected: await prisma.identityDocument.count({ where: { status: 'REJECTED' } })
    }

    return NextResponse.json({
      documents,
      summary,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('KYC GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch KYC submissions' }, { status: 500 })
  }
}

// POST: Submit new KYC document
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, docType, side, imageUrl } = body

    if (!userId || !docType || !imageUrl) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validate doc type
    const validDocTypes = ['PASSPORT', 'NATIONAL_ID', 'DRIVERS_LICENSE', 'EXPERIENCE_CERT', 'BUSINESS_REG', 'STAFF_PROOF']
    if (!validDocTypes.includes(docType)) {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 })
    }

    const document = await prisma.identityDocument.create({
      data: {
        userId,
        docType,
        side: side || 'FRONT',
        imageUrl,
        status: 'PENDING'
      }
    })

    return NextResponse.json({ document }, { status: 201 })
  } catch (error) {
    console.error('KYC POST error:', error)
    return NextResponse.json({ error: 'Failed to submit KYC document' }, { status: 500 })
  }
}

// PUT: Review KYC document (approve/reject)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { documentId, status, reviewNote, reviewedBy } = body

    if (!documentId || !status || !reviewedBy) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const document = await prisma.identityDocument.update({
      where: { id: documentId },
      data: {
        status,
        reviewNote,
        reviewedBy,
        reviewedAt: new Date()
      }
    })

    // If approved, update user's verification status
    if (status === 'APPROVED') {
      const user = await prisma.user.findUnique({
        where: { id: document.userId },
        include: { taskerProfile: true, companyProfile: true }
      })

      if (user?.taskerProfile) {
        await prisma.taskerProfile.update({
          where: { id: user.taskerProfile.id },
          data: {
            verificationStatus: 'VERIFIED',
            verificationNote: reviewNote || 'All documents verified',
            verifiedBy: reviewedBy,
            verifiedAt: new Date(),
            isVerified: true
          }
        })
      }

      if (user?.companyProfile) {
        await prisma.companyProfile.update({
          where: { id: user.companyProfile.id },
          data: {
            verificationStatus: 'VERIFIED',
            verificationNote: reviewNote || 'All documents verified',
            verifiedBy: reviewedBy,
            verifiedAt: new Date(),
            isVerified: true
          }
        })
      }
    }

    // If rejected, update user's verification status
    if (status === 'REJECTED') {
      const user = await prisma.user.findUnique({
        where: { id: document.userId },
        include: { taskerProfile: true, companyProfile: true }
      })

      if (user?.taskerProfile) {
        await prisma.taskerProfile.update({
          where: { id: user.taskerProfile.id },
          data: {
            verificationStatus: 'REJECTED',
            verificationNote: reviewNote || 'Document rejected'
          }
        })
      }

      if (user?.companyProfile) {
        await prisma.companyProfile.update({
          where: { id: user.companyProfile.id },
          data: {
            verificationStatus: 'REJECTED',
            verificationNote: reviewNote || 'Document rejected'
          }
        })
      }
    }

    return NextResponse.json({ document })
  } catch (error) {
    console.error('KYC PUT error:', error)
    return NextResponse.json({ error: 'Failed to review KYC document' }, { status: 500 })
  }
}
