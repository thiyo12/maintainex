import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

function filesUnder(root: string, suffixes = ['.ts', '.tsx']) {
  const output: string[] = []
  function walk(dir: string) {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      const stat = statSync(path)
      if (stat.isDirectory()) walk(path)
      else if (suffixes.some(suffix => path.endsWith(suffix))) output.push(path)
    }
  }
  walk(resolve(process.cwd(), root))
  return output
}

describe('CRM V2 Phase 15 legacy demolition gate', () => {
  it('has no obsolete province/branch admin role logic in active CRM code', () => {
    const files = [
      ...filesUnder('app/(admin)/admin'),
      ...filesUnder('app/api/admin'),
      ...filesUnder('components/admin'),
      ...filesUnder('components/crm'),
      ...filesUnder('lib/crm'),
    ]
    const offenders = files.filter(path => {
      const source = readFileSync(path, 'utf8')
      return source.includes('PROVINCE_ADMIN') || source.includes('BRANCH_ADMIN')
    })
    expect(offenders).toEqual([])
  })

  it('has no old dark CRM page implementation still reachable', () => {
    const files = filesUnder('app/(admin)/admin', ['.tsx'])
      .filter(path => path.endsWith('page.tsx'))
    const forbidden = ['bg-[#15161E]', 'bg-[#0B0C12]', 'bg-[#1A1B26]']
    const offenders = files.filter(path => {
      const source = readFileSync(path, 'utf8')
      return forbidden.some(token => source.includes(token))
    })
    expect(offenders).toEqual([])
  })

  it('does not authorize CRM pages directly from role templates', () => {
    const files = filesUnder('app/(admin)/admin', ['.tsx'])
      .filter(path => path.endsWith('page.tsx'))
    const offenders = files.filter(path =>
      readFileSync(path, 'utf8').includes('ROLE_PERMISSIONS')
    )
    expect(offenders).toEqual([])
  })

  it('has no legacy redirect pages in the active CRM tree', () => {
    const files = filesUnder('app/(admin)/admin', ['.tsx'])
      .filter(path => path.endsWith('page.tsx'))
    const offenders = files.filter(path =>
      readFileSync(path, 'utf8').includes('redirect(')
    )
    expect(offenders).toEqual([])
  })

  it('has one effective permission evaluator without the legacy helper', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'lib/crm/security.ts'),
      'utf8'
    )
    expect(source).not.toContain('export function crmHasPermission')
    expect(source).toContain('evaluateEffectivePermission')
  })

  it('retired legacy CRM routes stay absent', () => {
    const retired = [
      'app/(admin)/admin/analytics/security/page.tsx',
      'app/(admin)/admin/cheating/page.tsx',
      'app/(admin)/admin/wishlist/page.tsx',
      'app/(admin)/admin/commission/page.tsx',
      'app/(admin)/admin/users/page.tsx',
      'app/api/admin/cheating/route.ts',
      'app/api/admin/wishlist/route.ts',
      'app/api/admin/security/logs/route.ts',
      'app/api/seasonal-offers/[id]/route.ts',
      'app/api/seasonal-offers/[id]/jobs/route.ts',
    ]
    for (const path of retired) {
      expect(() => readFileSync(resolve(process.cwd(), path), 'utf8')).toThrow()
    }
  })

  it('keeps the canonical admin shell on the V2 design system', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'components/admin/AdminLayout.tsx'),
      'utf8'
    )
    expect(source).toContain('CrmShellProvider')
    expect(source).toContain('crm-v2')
    expect(source).toContain('user?.permissions')
    expect(source).not.toContain('PROVINCE_ADMIN')
    expect(source).not.toContain('BRANCH_ADMIN')
  })

  it('keeps canonical finance and catalog regression gates in CI', () => {
    const workflow = readFileSync(
      resolve(process.cwd(), '.github/workflows/phase0-7-validation.yml'),
      'utf8'
    )
    expect(workflow).toContain('Current financial lifecycle gates')
    expect(workflow).toContain('crm-catalog-v2.test.ts')
    expect(workflow).toContain('mobile-taxonomy-source-v2.test.ts')
  })
})
