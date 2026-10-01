import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf-8')
}

describe('tasker state input boundary', () => {
  it('requires a boolean online state instead of truthy coercion', () => {
    const route = read('app/api/mobile/taskers/status/route.ts')
    expect(route).toContain("typeof isOnline !== 'boolean'")
    expect(route).not.toContain('isOnline: !!isOnline')
  })

  it('validates mutable identity text before calling trim', () => {
    const route = read('app/api/mobile/taskers/profile/route.ts')
    expect(route).toContain("typeof name !== 'string' || !name.trim()")
    expect(route).toContain("nickname !== null && typeof nickname !== 'string'")
  })

  it('keeps profession self-assignment pending and handles duplicate submission as conflict', () => {
    const domain = read('lib/profession/index.ts')
    const route = read('app/api/mobile/taskers/professions/route.ts')

    expect(domain).toContain("status: 'PENDING'")
    expect(route).toContain('Profession already assigned')
    expect(route).toContain("error.code === 'P2002'")
    expect(route).toContain('{ status: 409 }')
  })
})
