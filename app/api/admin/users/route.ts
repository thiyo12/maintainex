import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  assertCrmCountryAllowed,
  crmHasPermission,
  getCrmCountryFilter,
  guardCrmRequest,
} from '@/lib/crm/security'
import { createAuditLog } from '@/lib/crm/audit'
import { transitionCompanyVerification, transitionUserKyc } from '@/lib/phase6/kyc-writer'

const USER_ACTIONS = new Set([
  'suspend',
  'unsuspend',
  'ban',
  'unban',
  'verify_tasker',
  'reject_tasker',
  'verify_company',
  'reject_company',
])

function viewPermission(type: string) {
  if (type === 'tasker') return 'taskers:view'
  if (type === 'company') return 'companies:view'
  return 'users:view'
}

function actionPermission(action: string) {
  if (action === 'suspend' || action === 'unsuspend') return 'users:suspend'
  if (action === 'ban' || action === 'unban') return 'users:ban'
  if (action === 'verify_tasker' || action === 'reject_tasker') return 'taskers:verify'
  if (action === 'verify_company' || action === 'reject_company') return 'companies:verify'
  return null
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'customer'

    if (!['customer', 'tasker', 'company'].includes(type)) {
      return NextResponse.json({ error: 'Invalid user type' }, { status: 400 })
    }

    const guard = await guardCrmRequest(request, {
      permission: viewPermission(type),
      level: 'read',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const search = (searchParams.get('search') || '').trim().slice(0, 120)
    const status = searchParams.get('status') || ''
    const country = (searchParams.get('country') || '').trim().toUpperCase()
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20')))
    const skip = (page - 1) * pageSize

    const where: any = { ...getCrmCountryFilter(security) }

    if (country) {
      if (!security.isSuperAdmin && !security.assignedCountries.includes(country)) {
        return NextResponse.json({ error: 'Forbidden country filter' }, { status: 403 })
      }
      where.countryCode = country
    }

    if (type === 'customer') where.role = 'CUSTOMER'
    if (type === 'tasker') where.role = 'TASKER'
    if (type === 'company') where.role = 'COMPANY'

    if (search) {
      where.OR = [
        { id: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { mxId: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
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
              isOnline: true,
              compositeScore: true,
              completionRate: true,
              avgResponseMin: true,
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
                subscriptionStatus: true,
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

    return NextResponse.json(
      {
        users,
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    console.error('CRM admin users GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      level: 'sensitive',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const body = await request.json()
    const userId = typeof body?.userId === 'string' ? body.userId : ''
    const action = typeof body?.action === 'string' ? body.action : ''
    const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 1000) : null

    if (!userId || userId.length > 128 || !USER_ACTIONS.has(action)) {
      return NextResponse.json({ error: 'Invalid user action payload' }, { status: 400 })
    }

    const permission = actionPermission(action)
    if (!permission || !crmHasPermission(security.role, permission)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        countryCode: true,
        isActive: true,
        isSuspended: true,
        isBanned: true,
        suspensionReason: true,
        banReason: true,
        taskerProfile: {
          select: { id: true, verificationStatus: true, isVerified: true },
        },
        companyProfile: {
          select: { id: true, companyName: true, verificationStatus: true, isVerified: true },
        },
      },
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!assertCrmCountryAllowed(security, targetUser.countryCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (action === 'verify_tasker' || action === 'reject_tasker') {
      if (!targetUser.taskerProfile) {
        return NextResponse.json({ error: 'Tasker profile not found' }, { status: 404 })
      }

      const nextStatus = action === 'verify_tasker' ? 'VERIFIED' : 'REJECTED'
      const transition = await transitionUserKyc(prisma, {
        userId: targetUser.id,
        action: action === 'verify_tasker' ? 'APPROVE' : 'REJECT',
        reviewNote: action === 'reject_tasker' ? reason || undefined : undefined,
        reviewedBy: security.adminId,
      })
      if (!transition.success) {
        return NextResponse.json({ error: transition.error }, { status: 409 })
      }

      await createAuditLog({
        action: 'UPDATE',
        category: 'PROVIDER',
        userId: security.adminId,
        userEmail: security.email,
        userRole: security.role,
        entityType: 'TaskerProfile',
        entityId: targetUser.taskerProfile.id,
        entityName: targetUser.name,
        description: `Tasker verification changed to ${nextStatus}`,
        oldValue: targetUser.taskerProfile,
        newValue: { verificationStatus: nextStatus, reason },
        ipAddress: security.ipAddress,
        userAgent: security.userAgent || undefined,
        riskLevel: action === 'reject_tasker' ? 'MEDIUM' : 'LOW',
      })

      return NextResponse.json({ success: true })
    }

    if (action === 'verify_company' || action === 'reject_company') {
      if (!targetUser.companyProfile) {
        return NextResponse.json({ error: 'Company profile not found' }, { status: 404 })
      }

      const nextStatus = action === 'verify_company' ? 'VERIFIED' : 'REJECTED'
      const transition = await transitionCompanyVerification(prisma, {
        companyId: targetUser.companyProfile.id,
        action: action === 'verify_company' ? 'APPROVE' : 'REJECT',
        reviewNote: action === 'reject_company' ? reason || undefined : undefined,
        reviewedBy: security.adminId,
        actorId: security.adminId,
        actorRole: security.role,
      })
      if (!transition.success) {
        return NextResponse.json({ error: transition.error }, { status: 409 })
      }

      await createAuditLog({
        action: 'UPDATE',
        category: 'COMPANY',
        userId: security.adminId,
        userEmail: security.email,
        userRole: security.role,
        entityType: 'CompanyProfile',
        entityId: targetUser.companyProfile.id,
        entityName: targetUser.companyProfile.companyName,
        description: `Company verification changed to ${nextStatus}`,
        oldValue: targetUser.companyProfile,
        newValue: { verificationStatus: nextStatus, reason },
        ipAddress: security.ipAddress,
        userAgent: security.userAgent || undefined,
        riskLevel: action === 'reject_company' ? 'MEDIUM' : 'LOW',
      })

      return NextResponse.json({ success: true })
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() }

    if (action === 'suspend') {
      updateData.isSuspended = true
      updateData.suspensionReason = reason
    } else if (action === 'unsuspend') {
      updateData.isSuspended = false
      updateData.suspensionReason = null
      updateData.suspendedUntil = null
    } else if (action === 'ban') {
      updateData.isBanned = true
      updateData.banReason = reason
      updateData.isActive = false
    } else if (action === 'unban') {
      updateData.isBanned = false
      updateData.banReason = null
      updateData.isActive = true
    }

    await prisma.user.update({
      where: { id: userId },
      data: updateData,
    })

    await createAuditLog({
      action: 'UPDATE',
      category: 'USER',
      userId: security.adminId,
      userEmail: security.email,
      userRole: security.role,
      entityType: 'User',
      entityId: targetUser.id,
      entityName: targetUser.name,
      description: `CRM account action: ${action}`,
      oldValue: {
        isActive: targetUser.isActive,
        isSuspended: targetUser.isSuspended,
        isBanned: targetUser.isBanned,
        suspensionReason: targetUser.suspensionReason,
        banReason: targetUser.banReason,
      },
      newValue: { action, reason },
      ipAddress: security.ipAddress,
      userAgent: security.userAgent || undefined,
      riskLevel: action === 'ban' || action === 'suspend' ? 'HIGH' : 'MEDIUM',
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('CRM admin user PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
