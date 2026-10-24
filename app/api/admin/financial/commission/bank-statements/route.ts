import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/shared/observability/logger'
import { prisma } from '@/lib/prisma'
import { assertCrmCountryAllowed, getCrmCountryCodes, guardCrmAction, guardCrmRequest } from '@/lib/crm/security'
import { requireFinancialRateLimit } from '@/lib/rate-limit/financial-guard'
import { hashBankStatement, normalizeBankStatementEntries } from '@/lib/finance/commissions/bank-statement-import'

export async function GET(request: NextRequest) {
  const guard = await guardCrmRequest(request, {
    permission: 'finance:commission:view',
    permissionClass: 'READ',
    level: 'read',
    requireCountryScope: true,
  })
  if (!guard.ok) return guard.response

  const countries = getCrmCountryCodes(guard.context)
  const where = countries === null ? {} : { countryCode: { in: countries } }
  const imports = await prisma.commissionBankStatementImport.findMany({
    where,
    include: {
      transactions: {
        select: {
          id: true, transactionId: true, bankAccountRef: true, direction: true,
          amountMinor: true, currency: true, countryCode: true, reference: true,
          reversalOfTransactionId: true, status: true, mismatchCode: true,
          reconciliation: { select: { id: true, status: true, providerIdentityId: true, approvalRequestId: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return NextResponse.json({
    imports: imports.map((item) => ({
      ...item,
      transactions: item.transactions.map((row) => ({ ...row, amountMinor: row.amountMinor.toString() })),
    })),
  }, { headers: { 'Cache-Control': 'no-store' } })
}

/**
 * File imports are retained as unverified evidence. Only a trusted bank source
 * adapter may promote provenanceStatus to VERIFIED; this endpoint intentionally
 * cannot settle debt or accept client-supplied verification claims.
 */
export async function POST(request: NextRequest) {
  try {
    const guard = await guardCrmAction(request, 'finance.commission.reconcile')
    if (!guard.ok) return guard.response
    const limited = await requireFinancialRateLimit(request, 'commission-payment-confirm')
    if (limited) return limited

    const rawBody = await request.text()
    if (rawBody.length > 2_000_000) return NextResponse.json({ error: 'Statement import is too large' }, { status: 413 })
    const body = (() => {
      try { return JSON.parse(rawBody) } catch { return null }
    })()
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid bank statement payload' }, { status: 400 })
    }
    const data = body as Record<string, unknown>
    const statementId = typeof data.statementId === 'string' ? data.statementId.trim() : ''
    const accountRef = typeof data.accountRef === 'string' ? data.accountRef.trim() : ''
    const countryCode = typeof data.countryCode === 'string' ? data.countryCode.trim().toUpperCase() : ''
    const currency = typeof data.currency === 'string' ? data.currency.trim().toUpperCase() : ''
    if (!statementId || statementId.length > 200 || !/^[A-Za-z0-9._:-]{1,100}$/.test(accountRef)) {
      return NextResponse.json({ error: 'Statement ID or account alias is invalid' }, { status: 400 })
    }
    if (!assertCrmCountryAllowed(guard.context, countryCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (!((countryCode === 'LK' && currency === 'LKR') || (countryCode === 'CA' && currency === 'CAD'))) {
      return NextResponse.json({ error: 'Currency does not match the selected market' }, { status: 400 })
    }

    const rows = normalizeBankStatementEntries(data.rows)
    if (rows.some((row) => row.countryCode !== countryCode || row.currency !== currency)) {
      return NextResponse.json({ error: 'Statement rows must match the selected market and currency' }, { status: 400 })
    }
    const contentSha256 = hashBankStatement({ statementId, accountRef, countryCode, currency, rows })
    const statement = await prisma.commissionBankStatementImport.create({
      data: {
        sourceSystem: 'MANUAL_STATEMENT',
        statementId,
        accountRef,
        countryCode,
        currency,
        contentSha256,
        provenanceType: 'STATEMENT_FILE',
        provenanceStatus: 'UNVERIFIED',
        importedByAdminId: guard.context.adminId,
        rowCount: rows.length,
      events: {
        create: {
          eventType: 'STATEMENT_IMPORTED',
          actor: guard.context.adminId,
          evidenceHash: contentSha256,
          metadata: JSON.stringify({ rowCount: rows.length, provenanceStatus: 'UNVERIFIED' }),
        },
      },
        transactions: {
          createMany: {
            data: rows.map((row) => ({
              sourceSystem: 'MANUAL_STATEMENT',
              transactionId: row.transactionId,
              bankAccountRef: accountRef,
              direction: row.direction,
              amountMinor: row.amountMinor,
              currency: row.currency,
              countryCode: row.countryCode,
              reference: row.reference,
              reversalOfTransactionId: row.reversalOfTransactionId,
            })),
          },
        },
      },
      select: { id: true, statementId: true, rowCount: true, provenanceStatus: true, createdAt: true },
    }).catch((error: unknown) => {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') return null
      throw error
    })
    if (!statement) {
      return NextResponse.json({ error: 'Statement or bank transaction was already imported', code: 'BANK_STATEMENT_DUPLICATE' }, { status: 409 })
    }
    return NextResponse.json({
      statement,
      message: 'Imported for review. Bank provenance remains unverified; no debt or ledger balance changed.',
    }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('BANK_')) {
      return NextResponse.json({ error: 'Bank statement rows are invalid', code: error.message }, { status: 400 })
    }
    logger.error('CRM commission bank statement import failed', {
      errorType: error instanceof Error ? error.name : 'unknown',
      route: '/api/admin/financial/commission/bank-statements', method: 'POST',
    })
    return NextResponse.json({ error: 'Unable to import commission bank statement' }, { status: 500 })
  }
}
