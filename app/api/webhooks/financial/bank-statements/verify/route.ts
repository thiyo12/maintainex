import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/shared/observability/logger'
import { prisma } from '@/lib/prisma'
import { verifyBankEvidenceSignature } from '@/lib/finance/commissions/bank-statement-import'

export async function POST(request: NextRequest) {
  const secret = process.env.MAINTAINEX_BANK_EVIDENCE_HMAC_SECRET || ''
  const configuredSource = process.env.MAINTAINEX_BANK_EVIDENCE_SOURCE || ''
  const trustedSources = new Set((process.env.MAINTAINEX_TRUSTED_BANK_EVIDENCE_SOURCES || '')
    .split(',').map(value => value.trim()).filter(Boolean))
  if (secret.length < 32 || !configuredSource || !trustedSources.has(configuredSource)) {
    return NextResponse.json({ error: 'No approved bank evidence source is configured' }, { status: 503 })
  }
  const rawBody = await request.text()
  if (rawBody.length > 16_384) return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
  if (!verifyBankEvidenceSignature({
    rawBody,
    signature: request.headers.get('x-maintainex-signature'),
    secret,
  })) {
    return NextResponse.json({ error: 'Invalid bank evidence signature' }, { status: 401 })
  }

  try {
    const body: unknown = JSON.parse(rawBody)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid bank evidence payload' }, { status: 400 })
    }
    const data = body as Record<string, unknown>
    const sourceSystem = typeof data.sourceSystem === 'string' ? data.sourceSystem.trim() : ''
    const statementId = typeof data.statementId === 'string' ? data.statementId.trim() : ''
    const contentSha256 = typeof data.contentSha256 === 'string' ? data.contentSha256.trim().toLowerCase() : ''
    const verificationRef = typeof data.verificationRef === 'string' ? data.verificationRef.trim() : ''
    const timestamp = typeof data.timestamp === 'number' ? data.timestamp : NaN
    if (
      sourceSystem !== configuredSource || !statementId || statementId.length > 200 ||
      !/^[a-f0-9]{64}$/.test(contentSha256) || !verificationRef || verificationRef.length > 200 ||
      !Number.isSafeInteger(timestamp) || Math.abs(Date.now() - timestamp) > 5 * 60_000
    ) {
      return NextResponse.json({ error: 'Bank evidence payload is invalid or expired' }, { status: 400 })
    }

    const verified = await prisma.$transaction(async (tx) => {
      const statement = await tx.commissionBankStatementImport.findFirst({
        where: {
          sourceSystem,
          statementId,
          contentSha256,
          provenanceType: 'BANK_FEED',
          provenanceStatus: 'UNVERIFIED',
        },
        select: { id: true, countryCode: true, currency: true },
      })
      if (!statement) return null
      const result = await tx.commissionBankStatementImport.updateMany({
        where: { id: statement.id, provenanceStatus: 'UNVERIFIED' },
        data: {
          provenanceStatus: 'VERIFIED',
          verificationSource: sourceSystem,
          verificationRef,
          verifiedAt: new Date(),
        },
      })
      if (result.count !== 1) return null
      await tx.commissionBankStatementEvent.create({
        data: {
          statementImportId: statement.id,
          eventType: 'PROVENANCE_VERIFIED',
          actor: `BANK_SOURCE:${sourceSystem}`,
          evidenceHash: contentSha256,
          metadata: JSON.stringify({ verificationRef, countryCode: statement.countryCode, currency: statement.currency }),
        },
      })
      return { id: statement.id }
    })
    if (!verified) return NextResponse.json({ error: 'Statement was not found, was already verified, or did not match the signed evidence' }, { status: 409 })
    return NextResponse.json({ verified: true }, { status: 200, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    logger.error('Authenticated bank evidence callback failed', {
      errorType: error instanceof Error ? error.name : 'unknown',
      route: '/api/webhooks/financial/bank-statements/verify', method: 'POST',
    })
    return NextResponse.json({ error: 'Unable to verify bank statement provenance' }, { status: 500 })
  }
}
