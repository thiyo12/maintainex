import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('CRM V2 visual contract', () => {
  it('keeps the approved shell tokens centralized', () => {
    const css = readFileSync(resolve(process.cwd(), 'app/globals.css'), 'utf8')

    for (const token of [
      '--crm-rail:',
      '--crm-canvas:',
      '--crm-surface:',
      '--crm-text:',
      '--crm-border:',
      '--crm-accent:',
      '--crm-success:',
      '--crm-warning:',
      '--crm-danger:',
      '--crm-info:',
    ]) {
      expect(css).toContain(token)
    }
  })

  it('keeps the retired legacy visual bridge out of the fully migrated CRM', () => {
    const css = readFileSync(resolve(process.cwd(), 'app/globals.css'), 'utf8')

    expect(css).not.toContain('CRM V2 TEMPORARY LEGACY VISUAL BRIDGE')
    expect(css).not.toContain('.crm-v2 main .text-white')
    expect(css).toContain('Do not globally rewrite utility text/background')
  })

  it('uses the V2 shell on every admin page through the admin route-group layout', () => {
    const layout = readFileSync(resolve(process.cwd(), 'app/(admin)/layout.tsx'), 'utf8')
    const shell = readFileSync(resolve(process.cwd(), 'components/admin/AdminLayout.tsx'), 'utf8')

    expect(layout).toContain('<AdminLayout>{children}</AdminLayout>')
    expect(shell).toContain('className="crm-v2')
    expect(shell).toContain('CrmGlobalSearch')
    expect(shell).toContain('CrmNotificationBell')
    expect(shell).toContain('CrmShellProvider')
  })
  it('keeps the approved reference dashboard wired to live market-scoped data', () => {
    const page = readFileSync(resolve(process.cwd(), 'app/(admin)/admin/dashboard/page.tsx'), 'utf8')
    const api = readFileSync(resolve(process.cwd(), 'app/api/dashboard/route.ts'), 'utf8')

    expect(page).toContain('useCrmShell')
    expect(page).toContain('/api/dashboard?market=')
    expect(page).toContain('Jobs Trend')
    expect(page).toContain('Recent Jobs')
    expect(page).toContain('System Health')

    expect(api).toContain('assertCrmCountryAllowed')
    expect(api).toContain('requestedMarket')
    expect(api).toContain('marketConfig.findMany')
    expect(api).toContain('defaultCurrency')
    expect(api).not.toContain("job.countryCode === 'CA' ? 'CAD' : 'LKR'")
  })

  it('keeps Job 360 aligned to the approved operations hierarchy', () => {
    const page = readFileSync(resolve(process.cwd(), 'app/(admin)/admin/jobs/[id]/page.tsx'), 'utf8')

    expect(page).toContain('variant="underline"')
    expect(page).toContain('Quick Actions')
    expect(page).toContain('Payment / Escrow')
    expect(page).toContain('Financials')
    expect(page).toContain('Job Lifecycle')
    expect(page).toContain('Provider / Company / Worker')
  })

})
