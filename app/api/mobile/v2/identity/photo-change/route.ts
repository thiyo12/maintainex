import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, assertNotSuspended } from '@/lib/auth/compatibility/mobile-auth'
import { ensureProviderIdentity } from '@/lib/finance/commissions/provider-balance-service'
import { ensureCompanyWorkerIdentity } from '@/lib/identity/job-worker-identity'
import { createWorkItem } from '@/lib/work-queue'

async function resolvePhotoIdentity(userId: string, requestedCompanyId?: string | null) {
  return prisma.$transaction(async tx => {
    const tasker = await tx.taskerProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        isVerified: true,
        verificationStatus: true,
        countryCode: true,
      },
    })

    if (tasker?.isVerified && tasker.verificationStatus === 'VERIFIED') {
      const identity = await ensureProviderIdentity(tx, {
        providerId: userId,
        providerType: 'INDIVIDUAL',
        countryCode: tasker.countryCode || 'LK',
      })
      return { identity, identityType: 'TASKER' as const, companyId: null }
    }

    const memberships = await tx.teamMember.findMany({
      where: {
        userId,
        status: 'ACTIVE',
        ...(requestedCompanyId ? { companyId: requestedCompanyId } : {}),
      },
      select: {
        id: true,
        companyId: true,
      },
      orderBy: { joinedAt: 'asc' },
    })

    if (memberships.length === 0) {
      throw new Error('PROVIDER_IDENTITY_NOT_ELIGIBLE')
    }
    if (!requestedCompanyId && memberships.length > 1) {
      throw new Error('COMPANY_CONTEXT_REQUIRED')
    }

    const membership = memberships[0]
    const resolved = await ensureCompanyWorkerIdentity(tx, {
      companyId: membership.companyId,
      userId,
    })
    if (!resolved) throw new Error('COMPANY_WORKER_IDENTITY_NOT_FOUND')

    return {
      identity: resolved.identity,
      identityType: 'COMPANY_WORKER' as const,
      companyId: membership.companyId,
    }
  })
}

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const companyId = new URL(request.url).searchParams.get('companyId')
    const resolved = await resolvePhotoIdentity(user.id, companyId)
    const identity = resolved.identity

    const pendingRequest = await prisma.providerPhotoChangeRequest.findFirst({
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

    return NextResponse.json({
      identityType: resolved.identityType,
      companyId: resolved.companyId,
      identityVerified:
        user.identityStatus === 'VERIFIED' || user.identityStatus === 'APPROVED',
      verifiedPhotoUrl: identity.verifiedPhotoUrl || null,
      photoLocked: true,
      pendingRequest,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message === 'COMPANY_CONTEXT_REQUIRED') {
      return NextResponse.json(
        {
          error: 'Select the company you are updating your worker identity for.',
          code: 'COMPANY_CONTEXT_REQUIRED',
        },
        { status: 409 },
      )
    }
    if (message === 'PROVIDER_IDENTITY_NOT_ELIGIBLE') {
      return NextResponse.json(
        { error: 'No eligible tasker or company-worker identity found' },
        { status: 404 },
      )
    }
    console.error('Photo change status error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
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
    const companyId =
      typeof body?.companyId === 'string' && body.companyId.trim()
        ? body.companyId.trim()
        : null

    if (!requestedPhotoUrl) {
      return NextResponse.json({ error: 'requestedPhotoUrl is required' }, { status: 400 })
    }

    const resolved = await resolvePhotoIdentity(user.id, companyId)

    const result = await prisma.$transaction(async tx => {
      const identity = await tx.providerIdentity.findUnique({
        where: { id: resolved.identity.id },
      })
      if (!identity) throw new Error('PROVIDER_IDENTITY_NOT_FOUND')
      if (identity.kycStatus !== 'VERIFIED') {
        throw new Error('PROVIDER_KYC_NOT_VERIFIED')
      }

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
          // CRM staff compare the camera photo against protected KYC evidence.
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
          source: resolved.identityType === 'COMPANY_WORKER' ? 'COMPANY_WORKER_APP' : 'TASKER_APP',
          metadata: JSON.stringify({
            photoChangeRequestId: created.id,
            companyId: resolved.companyId,
            identityType: resolved.identityType,
          }),
        },
      })

      return { request: created, created: true }
    })

    if (result.created) {
      await createWorkItem({
        category: 'kyc',
        title: 'Verified worker photo review',
        description: `${user.name || user.email} requested a new verified public worker photo. Compare the submitted camera photo with protected KYC evidence before approval.`,
        targetTable: 'ProviderPhotoChangeRequest',
        targetId: result.request.id,
      })
    }

    return NextResponse.json(
      {
        identityType: resolved.identityType,
        companyId: resolved.companyId,
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

    if (message === 'COMPANY_CONTEXT_REQUIRED') {
      return NextResponse.json(
        {
          error: 'Select the company you are updating your worker identity for.',
          code: 'COMPANY_CONTEXT_REQUIRED',
        },
        { status: 409 },
      )
    }
    if (
      message === 'PROVIDER_KYC_NOT_VERIFIED' ||
      message === 'PROVIDER_IDENTITY_NOT_ELIGIBLE'
    ) {
      return NextResponse.json(
        {
          error: 'Provider identity must be fully verified before a public worker photo can be reviewed.',
          code: 'IDENTITY_NOT_VERIFIED',
        },
        { status: 409 },
      )
    }

    return NextResponse.json({ error: 'Failed to request verified photo change' }, { status: 500 })
  }
}
