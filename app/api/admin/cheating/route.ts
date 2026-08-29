import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAdminSession } from '@/lib/admin-auth'

const ALLOWED_ROLES = ['SUPER_ADMIN', 'MANAGER', 'USER_MANAGEMENT']

// GET: List all off-platform deal reports
export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession(request)
    if (!session || !ALLOWED_ROLES.includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // PENDING, CONFIRMED, DISMISSED
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    const where: any = {}
    if (status) where.status = status

    const reports = await prisma.offPlatformDeal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    })

    const total = await prisma.offPlatformDeal.count({ where })

    // Get summary stats
    const pendingCount = await prisma.offPlatformDeal.count({ where: { status: 'PENDING' } })
    const confirmedCount = await prisma.offPlatformDeal.count({ where: { status: 'CONFIRMED' } })

    return NextResponse.json({
      reports,
      summary: {
        pending: pendingCount,
        confirmed: confirmedCount,
        total
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Cheating GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 })
  }
}

// POST: Submit new off-platform deal report
export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession(request)
    if (!session || !ALLOWED_ROLES.includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await request.json()
    const { reporterId, againstUserId, againstUserType, jobId, evidence, evidenceUrls } = body

    if (!reporterId || !againstUserId || !evidence) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const report = await prisma.offPlatformDeal.create({
      data: {
        reporterId,
        againstUserId,
        againstUserType: againstUserType || 'TASKER',
        jobId,
        evidence,
        evidenceUrls: evidenceUrls ? JSON.stringify(evidenceUrls) : null,
        status: 'PENDING'
      }
    })

    return NextResponse.json({ report }, { status: 201 })
  } catch (error) {
    console.error('Cheating POST error:', error)
    return NextResponse.json({ error: 'Failed to submit report' }, { status: 500 })
  }
}

// PUT: Review report (confirm/dismiss)
export async function PUT(request: NextRequest) {
  try {
    const session = await getAdminSession(request)
    if (!session || !ALLOWED_ROLES.includes(session.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await request.json()
    const { reportId, status, action, actionNote, reviewedBy } = body

    if (!reportId || !status || !reviewedBy) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!['CONFIRMED', 'DISMISSED'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const report = await prisma.offPlatformDeal.update({
      where: { id: reportId },
      data: {
        status,
        action: status === 'CONFIRMED' ? (action || 'BAN') : 'NO_ACTION',
        actionNote,
        reviewedBy,
        reviewedAt: new Date()
      }
    })

    // If confirmed and action is BAN, ban the user
    if (status === 'CONFIRMED' && action === 'BAN') {
      await prisma.user.update({
        where: { id: report.againstUserId },
        data: {
          isBanned: true,
          banReason: `Off-platform deal confirmed: ${actionNote || 'Terms violation'}`
        }
      })
    }

    return NextResponse.json({ report })
  } catch (error) {
    console.error('Cheating PUT error:', error)
    return NextResponse.json({ error: 'Failed to review report' }, { status: 500 })
  }
}
