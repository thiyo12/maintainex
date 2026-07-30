import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth-utils'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'customer'
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const country = searchParams.get('country') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '20')
    const skip = (page - 1) * pageSize

    const where: any = {}

    if (type === 'customer') {
      where.role = 'CUSTOMER'
    } else if (type === 'tasker') {
      where.role = 'TASKER'
    } else if (type === 'company') {
      where.role = 'COMPANY'
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { mxId: { contains: search } },
        { phone: { contains: search } },
      ]
    }

    if (status === 'active') {
      where.isActive = true
      where.isSuspended = false
      where.isBanned = false
    } else if (status === 'suspended') {
      where.isSuspended = true
      where.isBanned = false
    } else if (status === 'banned') {
      where.isBanned = true
    }

    const includeProfile = type === 'tasker'
      ? {
          taskerProfile: {
            select: {
              id: true,
              mxId: true,
              verificationStatus: true,
              verificationNote: true,
              verifiedAt: true,
              bio: true,
              rating: true,
              completedJobs: true,
              isVerified: true,
              experienceProofUrl: true,
              hasDrivingLicense: true,
              drivingLicenseUrl: true,
              skills: true,
              serviceAreas: true,
              hourlyRate: true,
            },
          },
        }
      : type === 'company'
      ? {
          companyProfile: {
            select: {
              id: true,
              mxId: true,
              companyName: true,
              verificationStatus: true,
              verificationNote: true,
              verifiedAt: true,
              rating: true,
              completedProjects: true,
              isVerified: true,
              businessRegDocUrl: true,
              minStaffCount: true,
              staffCount: true,
              staffProofUrl: true,
              services: true,
              serviceAreas: true,
              registrationNo: true,
              taxId: true,
            },
          },
        }
      : {
          customerProfile: {
            select: {
              id: true,
              customerType: true,
              status: true,
              totalBookings: true,
              totalSpent: true,
              lifetimeValue: true,
              lastBooking: true,
              province: true,
            },
          },
        }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: includeProfile,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.user.count({ where }),
    ])

    return NextResponse.json({
      users,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    console.error('Admin users fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { userId, action, reason } = body

    if (!userId || !action) {
      return NextResponse.json({ error: 'userId and action are required' }, { status: 400 })
    }

    const updateData: any = { updatedAt: new Date() }

    switch (action) {
      case 'suspend':
        updateData.isSuspended = true
        updateData.suspensionReason = reason || null
        break
      case 'unsuspend':
        updateData.isSuspended = false
        updateData.suspensionReason = null
        updateData.suspendedUntil = null
        break
      case 'ban':
        updateData.isBanned = true
        updateData.banReason = reason || null
        updateData.isActive = false
        break
      case 'unban':
        updateData.isBanned = false
        updateData.banReason = null
        updateData.isActive = true
        break
      case 'verify_tasker':
        await prisma.taskerProfile.updateMany({
          where: { userId },
          data: {
            verificationStatus: 'VERIFIED',
            verifiedBy: session.id,
            verifiedAt: new Date(),
            isVerified: true,
          },
        })
        return NextResponse.json({ success: true })
      case 'reject_tasker':
        await prisma.taskerProfile.updateMany({
          where: { userId },
          data: {
            verificationStatus: 'REJECTED',
            verificationNote: reason || null,
            verifiedBy: session.id,
            verifiedAt: new Date(),
          },
        })
        return NextResponse.json({ success: true })
      case 'verify_company':
        await prisma.companyProfile.updateMany({
          where: { userId },
          data: {
            verificationStatus: 'VERIFIED',
            verifiedBy: session.id,
            verifiedAt: new Date(),
            isVerified: true,
          },
        })
        return NextResponse.json({ success: true })
      case 'reject_company':
        await prisma.companyProfile.updateMany({
          where: { userId },
          data: {
            verificationStatus: 'REJECTED',
            verificationNote: reason || null,
            verifiedBy: session.id,
            verifiedAt: new Date(),
          },
        })
        return NextResponse.json({ success: true })
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    await prisma.user.update({
      where: { id: userId },
      data: updateData,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Admin user update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
