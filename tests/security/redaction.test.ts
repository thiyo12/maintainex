import { describe, it, expect } from 'vitest'
import { redactObject, redactString } from '@/lib/observability/redaction'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('Redaction', () => {
  it('redacts password fields', () => {
    const input = { password: 'secret123', name: 'John' }
    const result = redactObject(input) as any
    expect(result.password).toBe('[REDACTED]')
    expect(result.name).toBe('John')
  })

  it('redacts token fields', () => {
    const input = { token: 'abc123', apiKey: 'xyz789' }
    const result = redactObject(input) as any
    expect(result.token).toBe('[REDACTED]')
    expect(result.apiKey).toBe('[REDACTED]')
  })

  it('redacts nested objects', () => {
    const input = { user: { password: 'secret' } }
    const result = redactObject(input) as any
    expect(result.user.password).toBe('[REDACTED]')
  })

  it('redacts strings containing sensitive patterns', () => {
    const input = 'DATABASE_URL=postgresql://user:pass@host/db'
    const result = redactString(input)
    expect(result).toContain('[REDACTED]')
  })

  it('redacts bearer credentials and database passwords embedded in error strings', () => {
    expect(redactString('Authorization failed: Bearer abcdefghijklmnopqrstuvwxyz012345'))
      .toContain('Bearer [REDACTED]')
    const db = redactString('connect postgresql://maintainex:supersecretpassword@db.internal/app')
    expect(db).toContain('postgresql://maintainex:[REDACTED]@db.internal/app')
    expect(db).not.toContain('supersecretpassword')
  })

  it('never passes raw Error objects to the production structured logger path', () => {
    const logger = readFileSync(resolve(process.cwd(), 'lib/shared/observability/logger.ts'), 'utf8')
    const crmAudit = readFileSync(resolve(process.cwd(), 'lib/crm/audit.ts'), 'utf8')
    const mobileUpload = readFileSync(resolve(process.cwd(), 'app/api/mobile/upload/route.ts'), 'utf8')

    expect(logger).toContain('sanitizeErrorForLog')
    expect(logger).toContain("message: '[REDACTED]'")
    expect(logger).not.toContain('baseLogger.error({ ...enriched, err }, message)')
    expect(crmAudit).toContain("logger.error('Failed to create audit log', { err: error })")
    expect(crmAudit).not.toContain("console.error('Failed to create audit log:'")
    expect(mobileUpload).toContain("logger.error('Mobile upload failed', {")
    expect(mobileUpload).toContain('err: error')
    expect(mobileUpload).not.toContain("console.error('Upload error:'")
  })

  it('keeps sensitive authentication routes off raw console error sinks', () => {
    const sensitiveRoutes = [
      'app/api/auth/forgot-password/route.ts',
      'app/api/auth/reset-password/route.ts',
      'app/api/mobile/auth/otp-login/route.ts',
      'app/api/mobile/auth/verify-otp/route.ts',
      'app/api/admin/auth/login/route.ts',
      'app/api/admin/auth/refresh/route.ts',
      'app/api/admin/auth/2fa/verify/route.ts',
      'app/api/admin/auth/logout/route.ts',
    ]

    for (const path of sensitiveRoutes) {
      const route = readFileSync(resolve(process.cwd(), path), 'utf8')
      expect(route).toContain("logger.error(")
      expect(route).not.toMatch(/\bconsole\.error\s*\(/)
    }
  })

  it('keeps sensitive booking and conversation routes off raw console error sinks', () => {
    const sensitiveRoutes = [
      'app/api/bookings/[id]/route.ts',
      'app/api/mobile/bookings/[id]/route.ts',
      'app/api/mobile/conversations/[id]/route.ts',
      'app/api/mobile/conversations/[id]/messages/route.ts',
      'app/api/mobile/conversations/route.ts',
      'app/api/mobile/quick-bookings/[id]/route.ts',
    ]

    for (const path of sensitiveRoutes) {
      const route = readFileSync(resolve(process.cwd(), path), 'utf8')
      expect(route).toContain("logger.error(")
      expect(route).not.toMatch(/\bconsole\.error\s*\(/)
    }
  })

  it('keeps financial and payment routes off raw error sinks and internal error responses', () => {
    const sensitiveRoutes = [
      'app/api/mobile/v2/jobs/[id]/cash-payment/route.ts',
      'app/api/mobile/v2/jobs/[id]/escrow/refund/route.ts',
      'app/api/mobile/v2/jobs/[id]/escrow/route.ts',
      'app/api/mobile/v2/jobs/[id]/payment/route.ts',
      'app/api/mobile/v2/jobs/[id]/release-escrow/route.ts',
      'app/api/webhooks/payhere/route.ts',
      'app/api/webhooks/paypal/route.ts',
      'app/api/cron/escrow-release/route.ts',
    ]

    for (const routePath of sensitiveRoutes) {
      const route = readFileSync(resolve(process.cwd(), routePath), 'utf8')
      expect(route).toMatch(/logger\.(?:error|warn)\s*\(/)
      expect(route).not.toMatch(/\bconsole\.error\s*\(/)
    }

    const refund = readFileSync(
      resolve(process.cwd(), 'app/api/mobile/v2/jobs/[id]/escrow/refund/route.ts'),
      'utf8',
    )
    expect(refund).not.toContain("return NextResponse.json({ error: message }, { status: 500 })")
    expect(refund).toContain("return NextResponse.json({ error: 'Failed to process refund' }, { status: 500 })")

    const payHere = readFileSync(resolve(process.cwd(), 'app/api/webhooks/payhere/route.ts'), 'utf8')
    const payPal = readFileSync(resolve(process.cwd(), 'app/api/webhooks/paypal/route.ts'), 'utf8')
    expect(payHere).not.toContain("NextResponse.json({ error: result.error }")
    expect(payPal).not.toContain("result.error || 'Webhook processing failed'")
  })

  it('keeps admin finance routes on structured redacted logging', () => {
    const adminFinanceRoutes = [
      'app/api/admin/financial/commission/payments/route.ts',
      'app/api/admin/financial/commission/route.ts',
      'app/api/admin/financial/escrow/route.ts',
      'app/api/admin/financial/ledger/route.ts',
      'app/api/admin/financial/payments/[id]/route.ts',
      'app/api/admin/financial/payouts/[id]/route.ts',
      'app/api/admin/financial/refunds/route.ts',
      'app/api/admin/financial/wallets/route.ts',
    ]

    for (const routePath of adminFinanceRoutes) {
      const route = readFileSync(resolve(process.cwd(), routePath), 'utf8')
      expect(route).toContain("from '@/lib/shared/observability/logger'")
      expect(route).toContain('logger.error(')
      expect(route).not.toMatch(/\bconsole\.error\s*\(/)
    }
  })

  it('keeps identity, KYC and credential review routes on structured redacted logging', () => {
    const routes = [
      'app/api/mobile/v2/identity/route.ts',
      'app/api/mobile/v2/identity/photo-change/route.ts',
      'app/api/mobile/v2/jobs/[id]/worker-identity/route.ts',
      'app/api/admin/kyc/[id]/file/route.ts',
      'app/api/admin/kyc/photo-changes/[id]/file/route.ts',
      'app/api/admin/companies/[id]/verification/route.ts',
      'app/api/admin/credentials/[id]/review/route.ts',
      'app/api/admin/credentials/route.ts',
      'app/api/admin/kyc/photo-changes/route.ts',
      'app/api/admin/kyc/route.ts',
      'app/api/mobile/v2/admin/identity/[id]/route.ts',
      'app/api/mobile/v2/admin/identity/route.ts',
      'app/api/upload/route.ts',
    ]

    for (const routePath of routes) {
      const route = readFileSync(resolve(process.cwd(), routePath), 'utf8')
      expect(route).toContain("from '@/lib/shared/observability/logger'")
      expect(route).toContain('logger.error(')
      expect(route).not.toMatch(/\bconsole\.error\s*\(/)
    }
  })

  it('preserves safe values', () => {
    const input = { name: 'John', age: 30, active: true }
    const result = redactObject(input)
    expect(result).toEqual(input)
  })
})
