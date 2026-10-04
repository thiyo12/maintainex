import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('public black-box evidence workflow safety', () => {
  it('keeps the production probe read-only and secret-free', () => {
    const workflow = source('.github/workflows/security-public-blackbox.yml')

    expect(workflow).toContain('permissions: {}')
    expect(workflow).toContain('https://maintainex.lk')
    expect(workflow).toContain('https://admin.maintainex.lk')
    expect(workflow).toContain('/api/internal/readiness')
    expect(workflow).toContain("body.testOtpMode !== 'disabled'")
    expect(workflow).toContain("^[0-9a-f]{40}$")
    expect(workflow).not.toMatch(/secrets\./)
    expect(workflow).not.toMatch(/\bcurl\b[^\n]*(?:-X|--request)\s+(?:POST|PUT|PATCH|DELETE)\b/i)
    expect(workflow).not.toMatch(/^\s*(?:psql|prisma|docker|ssh)\b/m)
  })
})
