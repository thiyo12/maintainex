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

  it('keeps the temporary legacy visual bridge explicit until module migration removes it', () => {
    const css = readFileSync(resolve(process.cwd(), 'app/globals.css'), 'utf8')

    expect(css).toContain('CRM V2 TEMPORARY LEGACY VISUAL BRIDGE')
    expect(css).toContain('.crm-v2 main')
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
})
