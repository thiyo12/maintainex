import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('CRM V2 Job 360 contract', () => {
  it('uses server-issued action authority instead of browser role tables', () => {
    const page = readFileSync(
      resolve(process.cwd(), 'app/(admin)/admin/jobs/[id]/page.tsx'),
      'utf8'
    )

    expect(page).toContain('payload.permissions.cancel')
    expect(page).not.toContain('ROLE_PERMISSIONS')
    expect(page).not.toContain('useAdminSession')
    expect(page).not.toContain('window.confirm')
    expect(page).toContain('CrmConfirmDialog')
  })

  it('uses shared V2 visual primitives', () => {
    const page = readFileSync(
      resolve(process.cwd(), 'app/(admin)/admin/jobs/[id]/page.tsx'),
      'utf8'
    )

    expect(page).toContain('CrmCard')
    expect(page).toContain('CrmBadge')
    expect(page).toContain('CrmButton')
    expect(page).toContain('CrmTabs')
    expect(page).toContain('CrmState')
  })

  it('guards cancellation with the canonical CRM action on the server', () => {
    const route = readFileSync(
      resolve(process.cwd(), 'app/api/admin/jobs/route.ts'),
      'utf8'
    )

    expect(route).toContain("status === 'CANCELLED'")
    expect(route).toContain("guardCrmAction(request, 'jobs.cancel')")
  })

  it('derives Job 360 cancel visibility from live action initiation rules', () => {
    const route = readFileSync(
      resolve(process.cwd(), 'app/api/admin/jobs/[id]/route.ts'),
      'utf8'
    )

    expect(route).toContain("evaluateActionInitiation")
    expect(route).toContain("actionId: 'jobs.cancel'")
    expect(route).toContain('cancel: canCancel')
  })
})
