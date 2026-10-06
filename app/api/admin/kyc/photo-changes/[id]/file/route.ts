import { logger } from '@/lib/shared/observability/logger'
import { readFile } from 'fs/promises'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assertCrmCountryAllowed, guardCrmRequest } from '@/lib/crm/security'
import { resolveLocalKycFileReference } from '@/lib/security/kyc-storage'
import { validateFileUpload } from '@/lib/security/file-upload'

const MAX_VERIFIED_PHOTO_BYTES = 10 * 1024 * 1024

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await guardCrmRequest(request, {
      permission: 'kyc:view',
      level: 'sensitive',
      requireCountryScope: true,
    })
    if (!guard.ok) return guard.response
    const security = guard.context

    const { id } = await params
    if (!id || id.length > 128) {
      return NextResponse.json({ error: 'Invalid photo request ID' }, { status: 400 })
    }

    const photoRequest = await prisma.providerPhotoChangeRequest.findUnique({
      where: { id },
      select: {
        id: true,
        requestedPhotoUrl: true,
        providerIdentity: {
          select: {
            currentUserId: true,
            countryCode: true,
          },
        },
      },
    })

    if (!photoRequest || !photoRequest.providerIdentity.currentUserId) {
      return NextResponse.json({ error: 'Photo request not found' }, { status: 404 })
    }
    if (!assertCrmCountryAllowed(security, photoRequest.providerIdentity.countryCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const reference = resolveLocalKycFileReference(
      photoRequest.requestedPhotoUrl,
      photoRequest.providerIdentity.currentUserId,
      request.nextUrl.origin,
    )
    if (!reference || !reference.contentType.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Protected photo storage reference is unavailable.' },
        { status: 503 },
      )
    }

    const buffer = await readFile(reference.filePath)
    if (buffer.byteLength > MAX_VERIFIED_PHOTO_BYTES) {
      return NextResponse.json({ error: 'Photo is too large' }, { status: 413 })
    }

    const validation = validateFileUpload(
      buffer,
      reference.contentType,
      reference.filename,
    )
    if (!validation.valid) {
      return NextResponse.json({ error: 'Stored photo failed content validation' }, { status: 415 })
    }

    await prisma.securityAudit.create({
      data: {
        action: 'VERIFIED_PHOTO_REVIEW_VIEW',
        category: 'IDENTITY',
        userId: security.adminId,
        userEmail: security.email,
        userRole: security.role,
        entityType: 'ProviderPhotoChangeRequest',
        entityId: photoRequest.id,
        description: 'Viewed protected verified-photo review evidence',
        ipAddress: security.ipAddress,
        userAgent: security.userAgent || undefined,
        riskLevel: 'HIGH',
        isSuspicious: false,
      },
    })

    return new NextResponse(Uint8Array.from(buffer).buffer, {
      status: 200,
      headers: {
        'Content-Type': reference.contentType,
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'Referrer-Policy': 'no-referrer',
      },
    })
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
    }
    logger.error('CRM protected verified-photo read failed unexpectedly', { err: error, route: '/api/admin/kyc/photo-changes/[id]/file', method: 'GET' })
    return NextResponse.json({ error: 'Failed to load protected photo' }, { status: 500 })
  }
}
