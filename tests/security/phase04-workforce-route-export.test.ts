import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('Phase 04 — workforce Next.js route has no unsupported exports', () => {
  it('keeps internal transaction helpers private to avoid failing the production build', () => {
    const route = readFileSync(resolve(process.cwd(),
      'app/api/mobile/company/workforce/route.ts'), 'utf8')
    expect(route).toMatch(/async function assertCurrentWorkforceManager\(/)
    expect(route).not.toMatch(/export\s+async\s+function\s+assertCurrentWorkforceManager\(/)
    expect(route).toMatch(/export async function PATCH\(/)
  })
})
