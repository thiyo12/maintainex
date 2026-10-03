import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  assertCrmCountryAllowed,
  getCrmCountryCodes,
  guardCrmRequest,
} from '@/lib/crm/security'
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
    const status = (searchParams.get('status') || 'PENDING').toUpperCase()
    if (!VALID_STATUSES.has(status)) {
      return NextResponse.json({ error: 'Invalid photo request status' }, { status: 400 })
    }

    const countries = getCrmCountryCodes(security)
    const where: any = {
      ...(status !== 'ALL' ? { status } : {}),
      ...(countries === null
        ? {}
        : {
            providerIdentity: {
              countryCode: { in: countries.length > 0 ? countries : ['__NONE__'] },
            },
          }),
    }

    const requests = await prisma.providerPhotoChangeRequest.findMany({
      where,
      include: {
        providerIdentity: {
          select: {
            id: true,
            identityType: true,
            subjectId: true,
            currentUserId: true,
            countryCode: true,
            kycStatus: true,
            verifiedDisplayName: true,
            verifiedPhotoUrl: true,
            photoLocked: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    })

    const userIds = [...new Set(
      requests
        .map(item => item.providerIdentity.currentUserId)
        .filter((value): value is string => Boolean(value))
    )]

    const [users, documents] = await Promise.all([
      userIds.length
        ? prisma.user.findMany({
            where: { id: { in: userIds } },
            select: {
              id: true,
              mxId: true,
              name: true,
              email: true,
              identityStatus: true,
              taskerProfile: {
                select: {
                  id: true,
                  mxId: true,
                  verificationStatus: true,
                  isVerified: true,
                  rating: true,
                  completedJobs: true,
                },
              },
            },
          })
        : Promise.resolve([]),
      userIds.length
        ? prisma.identityDocument.findMany({
            where: {
              userId: { in: userIds },
              status: 'APPROVED',
            },
            select: {
              id: true,
              userId: true,
              docType: true,
              side: true,
              fullName: true,
              status: true,
            },
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve([]),
    ])

    const userMap = new Map(users.map(user => [user.id, user]))
    const docsByUser = new Map<string, typeof documents>()
    for (const doc of documents) {
      const current = docsByUser.get(doc.userId) || []
      current.push(doc)
      docsByUser.set(doc.userId, current)
    }

    return NextResponse.json(
      {
        requests: requests.map(item => {
          const userId = item.providerIdentity.currentUserId
          return {
            id: item.id,
            providerIdentityId: item.providerIdentityId,
            requestedPhotoUrl: item.requestedPhotoUrl,
            requestReason: item.requestReason,
            livenessStatus: item.livenessStatus,
            faceMatchStatus: item.faceMatchStatus,
            status: item.status,
            reviewedBy: item.reviewedBy,
            reviewedAt: item.reviewedAt?.toISOString() || null,
            reviewNote: item.reviewNote,
            createdAt: item.createdAt.toISOString(),
            providerIdentity: item.providerIdentity,
            user: userId ? userMap.get(userId) || null : null,
            documents: userId ? docsByUser.get(userId) || [] : [],
          }
        }),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    console.error('CRM verified photo request GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch verified photo requests' }, { status: 500 })
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
    const requestId = typeof body?.requestId === 'string' ? body.requestId.trim() : ''
    const status = typeof body?.status === 'string' ? body.status.toUpperCase() : ''
    const reviewNote =
      typeof body?.reviewNote === 'string' ? body.reviewNote.trim().slice(0, 2000) : ''

    if (!requestId || !['APPROVED', 'REJECTED'].includes(status)) {
      return NextResponse.json({ error: 'Invalid verified photo review payload' }, { status: 400 })
    }
    if (status === 'REJECTED' && !reviewNote) {
      return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 })
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

    const photoRequest = await prisma.providerPhotoChangeRequest.findUnique({
      where: { id: requestId },
      include: {
        providerIdentity: true,
      },
    })
    if (!photoRequest) {
      return NextResponse.json({ error: 'Photo request not found' }, { status: 404 })
    }
    if (!assertCrmCountryAllowed(security, photoRequest.providerIdentity.countryCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (photoRequest.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Photo request has already been reviewed', code: 'ALREADY_REVIEWED' },
        { status: 409 },
      )
    }
    if (
      photoRequest.providerIdentity.identityType !== 'TASKER' ||
      !photoRequest.providerIdentity.currentUserId
    ) {
      return NextResponse.json({ error: 'Unsupported provider identity type' }, { status: 409 })
    }

    const user = await prisma.user.findUnique({
      where: { id: photoRequest.providerIdentity.currentUserId },
      select: {
        id: true,
        name: true,
        identityStatus: true,
        taskerProfile: {
          select: {
            id: true,
            verificationStatus: true,
            isVerified: true,
          },
        },
      },
    })
    if (!user?.taskerProfile) {
      return NextResponse.json({ error: 'Tasker profile not found' }, { status: 404 })
    }

    const identityVerified =
      (user.identityStatus === 'VERIFIED' || user.identityStatus === 'APPROVED') &&
      user.taskerProfile.isVerified &&
      user.taskerProfile.verificationStatus === 'VERIFIED'

    if (status === 'APPROVED' && !identityVerified) {
      return NextResponse.json(
        {
          error: 'Tasker KYC must remain verified before a public identity photo can be approved.',
          code: 'KYC_NOT_VERIFIED',
        },
        { status: 409 },
      )
    }

    const updated = await prisma.$transaction(async tx => {
      const reviewedAt = new Date()
      const requestUpdate = await tx.providerPhotoChangeRequest.update({
        where: { id: requestId },
        data: {
          status,
          reviewedBy: security.adminId,
          reviewedAt,
          reviewNote: reviewNote || null,
          ...(status === 'APPROVED'
            ? {
                faceMatchStatus: 'MATCHED',
                // No automated liveness vendor is wired yet. Do not falsely
                // claim a machine liveness PASS; approval is a governed manual review.
                livenessStatus: 'REVIEW_REQUIRED',
              }
            : {
                faceMatchStatus: 'MISMATCH',
              }),
        },
      })

      if (status === 'APPROVED') {
        await tx.providerIdentity.update({
          where: { id: photoRequest.providerIdentityId },
          data: {
            kycStatus: 'VERIFIED',
            verifiedDisplayName: user.name,
            verifiedPhotoUrl: photoRequest.requestedPhotoUrl,
            photoLocked: true,
            verifiedAt: photoRequest.providerIdentity.verifiedAt || reviewedAt,
          },
        })

        await tx.taskerProfile.update({
          where: { id: user.taskerProfile!.id },
          data: {
            profileImage: photoRequest.requestedPhotoUrl,
          },
        })

        await tx.providerIntegritySignal.create({
          data: {
            providerIdentityId: photoRequest.providerIdentityId,
            userId: user.id,
            signalType: 'VERIFIED_PHOTO_APPROVED',
            severity: 'LOW',
            source: 'CRM_KYC_REVIEW',
            status: 'CONFIRMED',
            reviewedAt,
            reviewedBy: security.adminId,
            resolution: 'APPROVED',
            metadata: JSON.stringify({
              photoChangeRequestId: requestId,
            }),
          },
        })
      }

      await tx.securityAudit.create({
        data: {
          action: status === 'APPROVED' ? 'APPROVE' : 'REJECT',
          category: 'IDENTITY',
          userId: security.adminId,
          userEmail: security.email,
          userRole: security.role,
          entityType: 'ProviderPhotoChangeRequest',
          entityId: requestId,
          entityName: user.name,
          description:
            status === 'APPROVED'
              ? 'Verified tasker public profile photo approved'
              : 'Verified tasker public profile photo rejected',
          oldValue: JSON.stringify({
            status: photoRequest.status,
            verifiedPhotoUrl: photoRequest.providerIdentity.verifiedPhotoUrl,
          }),
          newValue: JSON.stringify({
            status,
            requestedPhotoUrl: photoRequest.requestedPhotoUrl,
            reviewNote: reviewNote || null,
          }),
          ipAddress: security.ipAddress,
          userAgent: security.userAgent || undefined,
          riskLevel: 'HIGH',
          isSuspicious: false,
        },
      })

      return requestUpdate
    })

    return NextResponse.json({
      request: {
        id: updated.id,
        status: updated.status,
        faceMatchStatus: updated.faceMatchStatus,
        livenessStatus: updated.livenessStatus,
        reviewedAt: updated.reviewedAt?.toISOString() || null,
      },
    })
  } catch (error) {
    console.error('CRM verified photo request PATCH error:', error)
    return NextResponse.json({ error: 'Failed to review verified photo request' }, { status: 500 })
  }
}
