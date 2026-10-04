import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { prisma } from '@/lib/prisma'
import { assertCrmCountryAllowed, guardCrmRequest } from '@/lib/crm/security'
import { resolveLocalKycFileReference } from '@/lib/security/kyc-storage'
import { validateFileUpload } from '@/lib/security/file-upload'

const MAX_KYC_FILE_BYTES = 15 * 1024 * 1024
const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
])

function sourceUrl(raw: string, request: NextRequest): URL | null {
  try {
    const url = new URL(raw, request.nextUrl.origin)
    const allowedHosts = new Set(
      (process.env.KYC_DOCUMENT_ALLOWED_HOSTS || '')
        .split(',')
        .map(value => value.trim().toLowerCase())
        .filter(Boolean)
    )

    const sameHost = url.hostname.toLowerCase() === request.nextUrl.hostname.toLowerCase()
    const configuredHost = allowedHosts.has(url.hostname.toLowerCase())

    if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') return null
    if (!sameHost && !configuredHost) return null

    // Never allow the stored path to turn this proxy into an internal API fetcher.
    if (sameHost && url.pathname.startsWith('/api/')) return null

    return url
  } catch {
    return null
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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
      return NextResponse.json({ error: 'Invalid document ID' }, { status: 400 })
    }

    const document = await prisma.identityDocument.findUnique({
      where: { id },
      select: {
        id: true,
        imageUrl: true,
        countryCode: true,
        docType: true,
        side: true,
        userId: true,
      },
    })

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }
    if (!assertCrmCountryAllowed(security, document.countryCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let bytes: ArrayBuffer
    let contentType: string

    const localReference = resolveLocalKycFileReference(
      document.imageUrl,
      document.userId,
      request.nextUrl.origin,
    )

    if (localReference) {
      const localBuffer = await readFile(localReference.filePath)
      if (localBuffer.byteLength > MAX_KYC_FILE_BYTES) {
        return NextResponse.json({ error: 'Document is too large' }, { status: 413 })
      }

      const validation = validateFileUpload(
        localBuffer,
        localReference.contentType,
        localReference.filename,
      )
      if (!validation.valid) {
        return NextResponse.json({ error: 'Stored document failed content validation' }, { status: 415 })
      }

      contentType = localReference.contentType
      bytes = Uint8Array.from(localBuffer).buffer
    } else {
      const url = sourceUrl(document.imageUrl, request)
      if (!url) {
        return NextResponse.json(
          { error: 'Document storage source is not approved for CRM access.' },
          { status: 503 }
        )
      }

      const upstream = await fetch(url, {
        redirect: 'error',
        cache: 'no-store',
        headers: { Accept: 'image/*,application/pdf' },
      })

      if (!upstream.ok) {
        return NextResponse.json({ error: 'Document storage unavailable' }, { status: 502 })
      }

      contentType = (upstream.headers.get('content-type') || '')
        .split(';')[0]
        .trim()
        .toLowerCase()

      if (!ALLOWED_TYPES.has(contentType)) {
        return NextResponse.json({ error: 'Unsupported document content type' }, { status: 415 })
      }

      const declaredSize = Number(upstream.headers.get('content-length') || 0)
      if (declaredSize > MAX_KYC_FILE_BYTES) {
        return NextResponse.json({ error: 'Document is too large' }, { status: 413 })
      }

      bytes = await upstream.arrayBuffer()
      if (bytes.byteLength > MAX_KYC_FILE_BYTES) {
        return NextResponse.json({ error: 'Document is too large' }, { status: 413 })
      }
    }

    // Sensitive file access is fail-closed on audit.
    await prisma.securityAudit.create({
      data: {
        action: 'KYC_DOCUMENT_VIEW',
        category: 'KYC',
        userId: security.adminId,
        userEmail: security.email,
        userRole: security.role,
        entityType: 'IdentityDocument',
        entityId: document.id,
        description: 'Viewed protected KYC document',
        newValue: JSON.stringify({
          docType: document.docType,
          side: document.side,
          subjectUserId: document.userId,
          countryCode: document.countryCode,
        }),
        ipAddress: security.ipAddress,
        userAgent: security.userAgent || undefined,
        riskLevel: 'HIGH',
        isSuspicious: false,
      },
    })

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'Referrer-Policy': 'no-referrer',
      },
    })
  } catch (error) {
    console.error('CRM KYC protected file error:', error)
    return NextResponse.json({ error: 'Failed to load KYC document' }, { status: 500 })
  }
}
