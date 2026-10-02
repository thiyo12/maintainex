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

  it('removes the legacy global text override and keeps explicit contrast-safe actions', () => {
    const css = readFileSync(resolve(process.cwd(), 'app/globals.css'), 'utf8')

    expect(css).not.toContain('CRM V2 TEMPORARY LEGACY VISUAL BRIDGE')
    expect(css).not.toContain('.crm-v2 main .text-white')
    expect(css).toContain('CRM V2 REFERENCE-PARITY SAFETY')
    expect(css).toContain('.crm-v2 .crm-accent-action')
    expect(css).toContain('.crm-v2 .crm-danger-action')
    expect(css).toContain('.crm-v2 .crm-dark-surface')
  })

  it('does not reintroduce obvious unreadable CRM button color combinations', () => {
    const primitives = readFileSync(resolve(process.cwd(), 'components/crm/v2/CrmPrimitives.tsx'), 'utf8')
    const dashboard = readFileSync(resolve(process.cwd(), 'app/(admin)/admin/dashboard/page.tsx'), 'utf8')
    const job360 = readFileSync(resolve(process.cwd(), 'app/(admin)/admin/jobs/[id]/page.tsx'), 'utf8')
    const source = [primitives, dashboard, job360].join('\n')

    expect(source).not.toContain('bg-[var(--crm-accent)] text-white')
    expect(source).not.toContain('bg-white text-white')
    expect(source).not.toContain('bg-[#17191b] text-[#17191b]')
  })

  it('uses the V2 shell on every admin page through the admin route-group layout', () => {
    const layout = readFileSync(resolve(process.cwd(), 'app/(admin)/layout.tsx'), 'utf8')
    const shell = readFileSync(resolve(process.cwd(), 'components/admin/AdminLayout.tsx'), 'utf8')

    expect(layout).toContain('<AdminLayout>{children}</AdminLayout>')
    expect(shell).toContain('className="crm-v2')
    expect(shell).toContain('CrmGlobalSearch')
    expect(shell).toContain('CrmNotificationBell')
    expect(shell).toContain('CrmShellProvider')
    expect(shell).toContain("border-[var(--crm-accent)]")
    expect(shell).toContain('M<span className="text-[var(--crm-accent)]">Λ</span>INTΛINEX')
  })

  it('keeps the dashboard aligned with the approved operations reference', () => {
    const dashboard = readFileSync(resolve(process.cwd(), 'app/(admin)/admin/dashboard/page.tsx'), 'utf8')

    for (const marker of [
      'Active Jobs',
      'Escrow Held',
      'Revenue',
      'Disputes',
      'Jobs & Revenue Trend',
      'Job Status',
      'Recent Jobs',
      "'Provider'",
      'Alerts / Pending Actions',
      'Live Activity',
      'System Health',
    ]) {
      expect(dashboard).toContain(marker)
    }
  })

  it('keeps Job 360 aligned with the approved workspace reference', () => {
    const job360 = readFileSync(resolve(process.cwd(), 'app/(admin)/admin/jobs/[id]/page.tsx'), 'utf8')

    for (const marker of [
      'Back to Jobs',
      'Overview',
      'Lifecycle',
      'Quotes',
      'Workspace',
      'Finance',
      'Dispute / Risk',
      'Audit',
      'Quick Actions',
      'Payment / Escrow',
      'Risk / Verification',
      'Provider / Company / Worker',
      'Location',
      'Schedule',
      'Service Details',
      'Job Lifecycle',
    ]) {
      expect(job360).toContain(marker)
    }
  })
})
