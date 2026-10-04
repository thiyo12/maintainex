import { logger } from '@/lib/shared/observability/logger'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assertCrmCountryAllowed, guardCrmRequest } from '@/lib/crm/security'
import { reviewCredential, type CredentialReviewStatus } from '@/lib/domain/credential-review'
import type { AdminSession } from '@/lib/admin-types'

const VALID_STATUSES: CredentialReviewStatus[] = ['VERIFIED', 'REJECTED', 'EXPIRED']

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'credentials:manage',
      level: 'sensitive',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const { id } = await params
    if (!id || id.length > 128) {
      return NextResponse.json({ error: 'Invalid credential ID' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const status = typeof body?.status === 'string'
      ? body.status.toUpperCase() as CredentialReviewStatus
      : '' as CredentialReviewStatus
    const reason = typeof body?.reason === 'string' ? body.reason.trim().slice(0, 2000) : undefined

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const credential = await prisma.certification.findUnique({
      where: { id },
      select: { id: true, holderType: true, holderId: true },
    })
    if (!credential) {
      return NextResponse.json({ error: 'Credential not found' }, { status: 404 })
    }

    let countryCode: string | null = null
    if (credential.holderType === 'INDIVIDUAL') {
      const holder = await prisma.user.findUnique({
        where: { id: credential.holderId },
        select: { countryCode: true },
      })
      countryCode = holder?.countryCode || null
    } else if (credential.holderType === 'COMPANY') {
      const holder = await prisma.companyProfile.findUnique({
        where: { id: credential.holderId },
        select: { countryCode: true },
      })
      countryCode = holder?.countryCode || null
    }

    if (!assertCrmCountryAllowed(security, countryCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const session: AdminSession = {
      id: security.adminId,
      email: security.email,
      role: security.role,
      firstName: '',
      lastName: '',
      assignedCountries: security.assignedCountries,
      authType: 'adminUser',
    }

    const result = await reviewCredential(prisma, {
      credentialId: id,
      status,
      reason,
      session,
      ipAddress: security.ipAddress,
    })

    return NextResponse.json({
      success: true,
      credential: result.credential,
      newStatus: result.newStatus,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Server error'
    if (message.includes('already in terminal state')) {
      return NextResponse.json({ error: message }, { status: 409 })
    }
    if (message.includes('not found')) {
      return NextResponse.json({ error: message }, { status: 404 })
    }
    if (message.includes('Rejection reason')) {
      return NextResponse.json({ error: message }, { status: 400 })
    }
    logger.error('CRM credential review failed unexpectedly', { err: error, route: '/api/admin/credentials/[id]/review' })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
