import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  assertCrmCountryAllowed,
  getCrmCountryFilter,
  guardCrmRequest,
} from '@/lib/crm/security'
import { createAuditLog } from '@/lib/crm/audit'
import {
  evaluateEffectivePermission,
  getPermissionCatalogEntry,
} from '@/lib/crm/governance'
import { transitionCompanyVerification, transitionUserKyc } from '@/lib/phase6/kyc-writer'
import { banUser, reactivateCompany, reactivateUser, suspendCompany, suspendUser, unbanUser } from '@/lib/domain/admin-suspension'
import type { AdminSession } from '@/lib/admin-types'
import {
  crmAccountActionRequiresReason,
  getCrmAccountActionPermission,
  type CrmAccountAction,
} from '@/lib/crm/account-action-permissions'

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
  return 'customers:view'
}

function canLivePermission(
  security: {
    role: AdminSession['role']
    permissionOverrides: Array<{ permission: string; effect: 'ALLOW' | 'DENY' }>
  },
  permission: string
): boolean {
  const entry = getPermissionCatalogEntry(permission)
  return evaluateEffectivePermission({
    role: security.role,
    permission,
    permissionClass: entry?.class,
    overrides: security.permissionOverrides,
  }).allowed
}

function listActionCapabilities(
  type: string,
  security: {
    role: AdminSession['role']
    permissionOverrides: Array<{ permission: string; effect: 'ALLOW' | 'DENY' }>
  }
) {
  if (type === 'tasker') {
    return {
      suspend: canLivePermission(security, 'taskers:status:manage'),
      ban: canLivePermission(security, 'taskers:ban'),
      verify: canLivePermission(security, 'taskers:verify'),
    }
  }
  if (type === 'company') {
    return {
      suspend: canLivePermission(security, 'companies:status:manage'),
      ban: canLivePermission(security, 'companies:ban'),
      verify: canLivePermission(security, 'companies:verify'),
    }
  }
  return {
    suspend: canLivePermission(security, 'customers:status:manage'),
    ban: canLivePermission(security, 'users:ban'),
    verify: false,
  }
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
      if (!assertCrmCountryAllowed(security, country)) {
        return NextResponse.json({ error: 'Forbidden market filter' }, { status: 403 })
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
        actions: listActionCapabilities(type, security),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    secureConsole.error('CRM admin users GET error:', error)
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
    const action = typeof body?.action === 'string' ? body.action as CrmAccountAction : '' as CrmAccountAction
    const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 1000) : null

    if (!userId || userId.length > 128 || !USER_ACTIONS.has(action)) {
      return NextResponse.json({ error: 'Invalid user action payload' }, { status: 400 })
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

    const permission = getCrmAccountActionPermission(action, targetUser.role)
    const canonicalPermission =
      (action === 'suspend' || action === 'unsuspend')
        ? targetUser.role === 'TASKER'
          ? 'taskers:status:manage'
          : targetUser.role === 'COMPANY'
            ? 'companies:status:manage'
            : 'customers:status:manage'
        : permission

    if (!canonicalPermission || !canLivePermission(security, canonicalPermission)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (
      crmAccountActionRequiresReason(action) &&
      (!reason || reason.length < 3)
    ) {
      return NextResponse.json(
        { error: 'A reason of at least 3 characters is required for this action' },
        { status: 400 }
      )
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

    const adminSession: AdminSession = {
      id: security.adminId,
      email: security.email,
      role: security.role,
      firstName: '',
      lastName: '',
      assignedCountries: security.assignedCountries,
      authType: 'adminUser',
    }

    if ((action === 'suspend' || action === 'unsuspend') && targetUser.role === 'COMPANY') {
      if (!targetUser.companyProfile) {
        return NextResponse.json({ error: 'Company profile not found' }, { status: 404 })
      }

      if (action === 'suspend') {
        await suspendCompany(prisma, {
          companyProfileId: targetUser.companyProfile.id,
          reason: reason!,
          scope: 'ALL',
          session: adminSession,
          ipAddress: security.ipAddress,
        })
      } else {
        await reactivateCompany(prisma, {
          companyProfileId: targetUser.companyProfile.id,
          reason: reason || 'Reactivated by admin',
          session: adminSession,
          ipAddress: security.ipAddress,
        })
      }

      return NextResponse.json({ success: true })
    }

    if ((action === 'suspend' || action === 'unsuspend') && targetUser.role !== 'COMPANY') {
      if (action === 'suspend') {
        await suspendUser(prisma, {
          userId: targetUser.id,
          reason: reason!,
          scope: 'ALL',
          session: adminSession,
          ipAddress: security.ipAddress,
        })
      } else {
        await reactivateUser(prisma, {
          userId: targetUser.id,
          reason: reason || 'Reactivated by admin',
          session: adminSession,
          ipAddress: security.ipAddress,
        })
      }

      return NextResponse.json({ success: true })
    }

    if (action === 'ban' || action === 'unban') {
      if (action === 'ban') {
        await banUser(prisma, {
          userId: targetUser.id,
          reason: reason!,
          session: adminSession,
          ipAddress: security.ipAddress,
        })
      } else {
        await unbanUser(prisma, {
          userId: targetUser.id,
          reason: reason || 'Unbanned by admin',
          session: adminSession,
          ipAddress: security.ipAddress,
        })
      }

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unsupported account action' }, { status: 400 })
  } catch (error) {
    secureConsole.error('CRM admin user PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
