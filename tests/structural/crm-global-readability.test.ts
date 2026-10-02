import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

function filesUnder(root: string): string[] {
  const absolute = resolve(process.cwd(), root)
  const result: string[] = []

  function walk(directory: string) {
    for (const name of readdirSync(directory)) {
      const path = join(directory, name)
      if (statSync(path).isDirectory()) {
        walk(path)
      } else if (name.endsWith('.tsx')) {
        result.push(path)
      }
    }
  }

  walk(absolute)
  return result
}

describe('CRM V2 global readability guard', () => {
  it('prevents known invisible foreground/background combinations across admin pages', () => {
    const pages = filesUnder('app/(admin)/admin')
    const shared = [
      resolve(process.cwd(), 'components/crm/v2/CrmPrimitives.tsx'),
      resolve(process.cwd(), 'components/crm/v2/CrmOverlays.tsx'),
      ...pages,
    ]

    const failures: string[] = []
    const patterns: Array<[string, RegExp]> = [
      ['accent background with white text', /bg-\[var\(--crm-accent\)\][^"'\n]{0,100}text-white|text-white[^"'\n]{0,100}bg-\[var\(--crm-accent\)\]/g],
      ['amber action background with white text', /bg-amber-(?:400|500|600)[^"'\n]{0,100}text-white|text-white[^"'\n]{0,100}bg-amber-(?:400|500|600)/g],
      ['white background with white text', /(?<!hover:)bg-white(?!\/)[^"'\n]{0,100}(?<!hover:)(?<!focus:)(?<!focus-visible:)text-white(?!\/)|(?<!hover:)(?<!focus:)(?<!focus-visible:)text-white(?!\/)[^"'\n]{0,100}(?<!hover:)bg-white(?!\/)/g],
      ['accent action with white text', /crm-accent-action[^"'\n]{0,100}text-white|text-white[^"'\n]{0,100}crm-accent-action/g],
      ['danger action with danger-colored text', /crm-danger-action[^"'\n]{0,100}text-\[var\(--crm-danger\)\]/g],
    ]

    for (const path of shared) {
      const source = readFileSync(path, 'utf8')
      for (const [label, pattern] of patterns) {
        pattern.lastIndex = 0
        if (pattern.test(source)) {
          failures.push(`${path.replace(process.cwd(), '')}: ${label}`)
        }
      }
    }

    expect(failures).toEqual([])
  })

  it('keeps every admin workspace on the shared CRM V2 component system', () => {
    const pages = filesUnder('app/(admin)/admin')
    const legacyPages = pages
      .filter(path => !readFileSync(path, 'utf8').includes('@/components/crm/v2/'))
      .map(path => path.replace(process.cwd(), ''))

    expect(legacyPages).toEqual([])
  })

  it('keeps shared CRM inputs and buttons contrast-safe and focus-visible', () => {
    const primitives = readFileSync(
      resolve(process.cwd(), 'components/crm/v2/CrmPrimitives.tsx'),
      'utf8'
    )

    expect(primitives).toContain("primary: 'crm-accent-action text-[#111315]")
    expect(primitives).toContain("secondary: 'bg-white text-slate-800")
    expect(primitives).toContain("danger: 'crm-danger-action text-white")
    expect(primitives).toContain('focus:border-amber-300')
    expect(primitives).toContain('disabled:opacity-45')
  })

  it('keeps the main CRM workspace light while reserving dark styling for the navigation rail', () => {
    const layout = readFileSync(
      resolve(process.cwd(), 'components/admin/AdminLayout.tsx'),
      'utf8'
    )

    expect(layout).toContain('bg-[var(--crm-rail)]')
    expect(layout).toContain('bg-[var(--crm-canvas)]')
    expect(layout).toContain('<main className="px-4 py-4')
    expect(layout).not.toContain('<main className="bg-[var(--crm-rail)]')
  })
})
