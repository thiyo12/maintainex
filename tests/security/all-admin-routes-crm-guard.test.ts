import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import { join, relative, resolve } from 'path'

function collectRouteFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      out.push(...collectRouteFiles(full))
    } else if (name === 'route.ts') {
      out.push(full)
    }
  }
  return out
}

describe('all non-auth admin APIs use the CRM security boundary', () => {
  const root = resolve(process.cwd(), 'app/api/admin')
  const routes = collectRouteFiles(root)
    .filter(path => !relative(root, path).startsWith('auth/'))

  it('discovers the expected protected admin route surface', () => {
    expect(routes.length).toBeGreaterThanOrEqual(56)
  })

  for (const route of routes) {
    const rel = relative(process.cwd(), route)
    it(`${rel} contains guardCrmRequest`, () => {
      const source = readFileSync(route, 'utf-8')
      expect(source).toContain('guardCrmRequest(')
    })
  }
})
