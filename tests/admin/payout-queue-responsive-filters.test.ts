import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('payout queue responsive filters', () => {
  it('gives search and status controls separate responsive widths', () => {
    const page = readFileSync(
      resolve(process.cwd(), 'app/(admin)/admin/financial/payouts/page.tsx'),
      'utf8'
    )

    expect(page).toContain('relative w-full min-w-0 md:flex-1')
    expect(page).toContain('aria-label="Payout status"')
    expect(page).toContain('w-full min-w-0 md:w-auto md:min-w-[190px] md:flex-none')
  })
})
