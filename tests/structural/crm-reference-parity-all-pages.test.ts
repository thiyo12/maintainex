import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function adminPages(): string[] {
  const root = resolve(process.cwd(), 'app/(admin)/admin')
  const pages: string[] = []

  function walk(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = resolve(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
      } else if (entry.name === 'page.tsx') {
        pages.push(full)
      }
    }
  }

  walk(root)
  return pages.sort()
}

describe('CRM approved-reference parity across all admin pages', () => {
  it('keeps every active admin page on the compact reference density', () => {
    const offenders: Array<{ file: string; pattern: string }> = []
    const patterns = [
      'space-y-6',
      'space-y-5',
      'gap-5',
      'rounded-2xl',
    ]

    for (const file of adminPages()) {
      const source = readFileSync(file, 'utf8')
      for (const pattern of patterns) {
        if (source.includes(pattern)) {
          offenders.push({
            file: file.replace(process.cwd() + '/', ''),
            pattern,
          })
        }
      }
    }

    expect(offenders).toEqual([])
  })

  it('keeps legacy translucent dark-theme action colors out of the light CRM workspace', () => {
    const offenders: Array<{ file: string; pattern: string }> = []
    const patterns = [
      'bg-red-500/20',
      'bg-green-500/20',
      'bg-orange-500/20',
      'text-red-400',
      'text-green-400',
      'text-orange-400',
    ]

    for (const file of adminPages()) {
      const source = readFileSync(file, 'utf8')
      for (const pattern of patterns) {
        if (source.includes(pattern)) {
          offenders.push({
            file: file.replace(process.cwd() + '/', ''),
            pattern,
          })
        }
      }
    }

    expect(offenders).toEqual([])
  })

  it('covers the complete active CRM surface, not only Dashboard and Job 360', () => {
    const pages = adminPages()

    expect(pages.length).toBeGreaterThanOrEqual(43)

    for (const required of [
      'dashboard/page.tsx',
      'jobs/page.tsx',
      'jobs/[id]/page.tsx',
      'users/customers/page.tsx',
      'users/taskers/page.tsx',
      'users/companies/page.tsx',
      'users/[id]/page.tsx',
      'companies/[id]/page.tsx',
      'financial/page.tsx',
      'financial/payments/page.tsx',
      'financial/payments/[id]/page.tsx',
      'trust-safety/page.tsx',
      'analytics/page.tsx',
      'admins/page.tsx',
      'settings/page.tsx',
    ]) {
      expect(pages.some(page => page.endsWith(required))).toBe(true)
    }
  })
})
