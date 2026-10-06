import { describe, expect, it } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { relative, resolve } from 'node:path'

const ROOTS = [
  'app/api',
  'lib/auth',
  'lib/crm',
  'lib/security',
  'lib/payment',
  'lib/finance',
] as const

function walk(root: string): string[] {
  const absolute = resolve(process.cwd(), root)
  if (!existsSync(absolute)) return []

  const out: string[] = []
  for (const entry of readdirSync(absolute)) {
    const path = resolve(absolute, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) out.push(...walk(relative(process.cwd(), path)))
    else if (/\.(?:ts|tsx|js|jsx)$/.test(path)) out.push(path)
  }
  return out
}

describe('server log-sink inventory', () => {
  it('keeps API/auth/CRM/security/payment/finance code off raw console sinks', () => {
    const offenders: Array<{ path: string; line: number; sink: string }> = []

    for (const root of ROOTS) {
      for (const file of walk(root)) {
        const source = readFileSync(file, 'utf8')
        for (const [index, line] of source.split('\n').entries()) {
          const match = line.match(/\bconsole\.(error|warn|log)\s*\(/)
          if (!match) continue
          offenders.push({
            path: relative(process.cwd(), file),
            line: index + 1,
            sink: `console.${match[1]}`,
          })
        }
      }
    }

    expect(offenders).toEqual([])
  })
})
