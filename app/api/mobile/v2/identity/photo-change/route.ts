import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/auth/compatibility/mobile-auth'
import { ensureProviderIdentity } from '@/lib/finance/commissions/provider-balance-service'
import { createWorkItem } from '@/lib/work-queue'

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user || user.role !== 'TASKER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tasker = await prisma.taskerProfile.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })
    if (!tasker) {
      return NextResponse.json({ error: 'Tasker profile not found' }, { status: 404 })
    }

    const identity = await prisma.providerIdentity.findUnique({
      where: {
        identityType_subjectId: {
          identityType: 'TASKER',
          subjectId: tasker.id,
        },
      },
      select: {
        id: true,
        kycStatus: true,
        verifiedPhotoUrl: true,
        photoLocked: true,
      },
    })

    const pendingRequest = identity
      ? await prisma.providerPhotoChangeRequest.findFirst({
          where: { providerIdentityId: identity.id, status: 'PENDING' },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            requestedPhotoUrl: true,
            status: true,
            livenessStatus: true,
            faceMatchStatus: true,
            createdAt: true,
          },
        })
      : null

    return NextResponse.json({
      identityVerified:
        user.identityStatus === 'VERIFIED' || user.identityStatus === 'APPROVED',
      verifiedPhotoUrl: identity?.verifiedPhotoUrl || null,
      photoLocked:
        identity?.photoLocked === true ||
        user.identityStatus === 'VERIFIED' ||
        user.identityStatus === 'APPROVED',
      pendingRequest,
    })
  } catch (error) {
    console.error('Photo change status error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user || user.role !== 'TASKER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    if (user.identityStatus !== 'VERIFIED' && user.identityStatus !== 'APPROVED') {
      return NextResponse.json(
        {
          error: 'Complete identity verification before requesting a verified profile photo.',
          code: 'IDENTITY_NOT_VERIFIED',
        },
        { status: 409 },
      )
    }

    const body = await request.json().catch(() => ({}))
    const requestedPhotoUrl =
      typeof body?.requestedPhotoUrl === 'string'
        ? body.requestedPhotoUrl.trim().slice(0, 2000)
        : ''
    const requestReason =
      typeof body?.requestReason === 'string'
        ? body.requestReason.trim().slice(0, 500)
        : null

    if (!requestedPhotoUrl) {
      return NextResponse.json({ error: 'requestedPhotoUrl is required' }, { status: 400 })
    }

    const result = await prisma.$transaction(async tx => {
      const tasker = await tx.taskerProfile.findUnique({
        where: { userId: user.id },
        select: {
          id: true,
          isVerified: true,
          verificationStatus: true,
          countryCode: true,
        },
      })
      if (!tasker) throw new Error('TASKER_PROFILE_NOT_FOUND')
      if (!tasker.isVerified || tasker.verificationStatus !== 'VERIFIED') {
        throw new Error('TASKER_KYC_NOT_VERIFIED')
      }

      const identity = await ensureProviderIdentity(tx, {
        providerId: user.id,
        providerType: 'INDIVIDUAL',
        countryCode: tasker.countryCode || user.countryCode || 'LK',
      })

      const existing = await tx.providerPhotoChangeRequest.findFirst({
        where: {
          providerIdentityId: identity.id,
          status: 'PENDING',
        },
        orderBy: { createdAt: 'desc' },
      })
      if (existing) {
        return { request: existing, created: false }
      }

      const created = await tx.providerPhotoChangeRequest.create({
        data: {
          providerIdentityId: identity.id,
          requestedPhotoUrl,
          requestReason,
          // No automated liveness/face verifier is claimed here.
          // CRM staff must compare the submitted camera photo against protected KYC evidence.
          livenessStatus: 'REVIEW_REQUIRED',
          faceMatchStatus: 'REVIEW_REQUIRED',
          status: 'PENDING',
        },
      })

      await tx.providerIntegritySignal.create({
        data: {
          providerIdentityId: identity.id,
          userId: user.id,
          signalType: 'VERIFIED_PHOTO_CHANGE_REQUESTED',
          severity: 'LOW',
          source: 'TASKER_APP',
          metadata: JSON.stringify({
            photoChangeRequestId: created.id,
          }),
        },
      })

      return { request: created, created: true }
    })

    if (result.created) {
      await createWorkItem({
        category: 'kyc',
        title: 'Verified tasker photo review',
        description: `${user.name || user.email} requested a new verified public profile photo. Compare the submitted photo with protected KYC evidence before approval.`,
        targetTable: 'ProviderPhotoChangeRequest',
        targetId: result.request.id,
      })
    }

    return NextResponse.json(
      {
        request: {
          id: result.request.id,
          status: result.request.status,
          livenessStatus: result.request.livenessStatus,
          faceMatchStatus: result.request.faceMatchStatus,
          createdAt: result.request.createdAt.toISOString(),
        },
        created: result.created,
      },
      { status: result.created ? 201 : 200 },
    )
  } catch (error) {
    console.error('Photo change request error:', error)
    const message = error instanceof Error ? error.message : ''

    if (message === 'TASKER_PROFILE_NOT_FOUND') {
      return NextResponse.json({ error: 'Tasker profile not found' }, { status: 404 })
    }
    if (message === 'TASKER_KYC_NOT_VERIFIED') {
      return NextResponse.json(
        { error: 'Tasker identity must be fully verified first', code: 'IDENTITY_NOT_VERIFIED' },
        { status: 409 },
      )
    }

    return NextResponse.json({ error: 'Failed to request verified photo change' }, { status: 500 })
  }
}
