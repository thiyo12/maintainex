import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const workflow = readFileSync(
  resolve(process.cwd(), '.github/workflows/phase0-7-validation.yml'),
  'utf8',
)

const target = workflow.split('      - name: International launch Phases 04-11 blocking acceptance gates')[1]
  ?.split('      - name: Upload international launch acceptance diagnostics')[0] || ''

describe('Phase 11 — international release gates are blocking and observable', () => {
  it('has a dedicated launch acceptance stage, separate from the historic nonblocking baseline', () => {
    expect(target).toContain('set -euo pipefail')
    expect(target).toContain('npx vitest run')
    expect(target).toContain('--reporter=verbose')
    expect(target).not.toContain('continue-on-error: true')
    expect(workflow).toContain('name: Historical full regression baseline (non-blocking)')
  })

  it('checks independent LK and CA pricing plus revision integrity', () => {
    expect(target).toContain('tests/finance/phase05-price-input-isolation.test.ts')
    expect(target).toContain('tests/pricing/phase05-market-price-estimate.test.ts')
    expect(target).toContain('tests/quotes/quote-revision.test.ts')
    expect(target).toContain('tests/security/quote-revision-route-security.test.ts')
  })

  it('checks real provider onboarding and booking safety', () => {
    expect(target).toContain('tests/security/phase04-vancouver-company-onboarding.test.ts')
    expect(target).toContain('tests/security/phase04-company-invitation-market.test.ts')
    expect(target).toContain('tests/security/phase07-company-work-start-authorization.test.ts')
  })

  it('checks market-safe seasonal offers, French fallback and CRM country permissions', () => {
    expect(target).toContain('tests/domain/phase08-seasonal-offer-market.test.ts')
    expect(target).toContain('apps/mobile/lib/i18n/__tests__/french-locale.test.ts')
    expect(target).toContain('tests/security/crm-canonical-catalog.test.ts')
  })

  it('runs against the existing isolated CI PostgreSQL service with no deploy to production', () => {
    expect(workflow).toContain('services:')
    expect(workflow).toContain('postgres:')
    expect(workflow).toContain('maintainex_test_phase07_ci')
    expect(workflow).toContain('Upload international launch acceptance diagnostics')
    expect(target).not.toContain('npm run deploy')
    expect(target).not.toContain('prisma migrate dev')
  })
})
