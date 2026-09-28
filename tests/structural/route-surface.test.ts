import { describe, it, expect } from 'vitest'
import { readdirSync, existsSync } from 'fs'
import { join } from 'path'

const ROOT = join(process.cwd())
const APP = join(ROOT, 'app')

type Entry = { url: string; file: string; kind: 'page' | 'route' }

function isGroup(dir: string): boolean {
  return dir.startsWith('(') && dir.endsWith(')')
}

function walk(dir: string, relSegs: string[], out: Entry[]): void {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  const hasPage = entries.some((e) => e.isFile() && e.name === 'page.tsx')
  const hasRoute = entries.some((e) => e.isFile() && e.name === 'route.ts')
  if (hasPage && hasRoute) {
    out.push({ url: '', file: join(dir, 'page.tsx+route.ts'), kind: 'page' })
  } else if (hasPage) {
    const groupless = relSegs.filter((s) => !isGroup(s))
    out.push({ url: '/' + groupless.join('/'), file: join(dir, 'page.tsx'), kind: 'page' })
  } else if (hasRoute) {
    const groupless = relSegs.filter((s) => !isGroup(s))
    out.push({ url: '/' + groupless.join('/'), file: join(dir, 'route.ts'), kind: 'route' })
  }
  for (const e of entries) {
    if (e.isDirectory() && !e.name.startsWith('_')) {
      walk(join(dir, e.name), [...relSegs, e.name], out)
    }
  }
}

function collect(): Entry[] {
  const out: Entry[] = []
  walk(APP, [], out)
  return out
}

function normalized(url: string): string {
  return url === '/' || url.startsWith('/api/') || url.length > 1 ? (url === '/' ? url : url.replace(/\/$/, '')) : url
}

describe('Route Surface — URL uniqueness and group isolation', () => {
  it('every page/route resolves to a unique external URL', () => {
    const entries = collect().map((e) => ({ ...e, url: normalized(e.url) }))
    const seen = new Map<string, string>()
    const collisions: string[] = []
    for (const e of entries) {
      if (e.url === '') collisions.push(`page+route collision at ${e.file}`)
      else if (seen.has(e.url)) collisions.push(`${e.url}: ${seen.get(e.url)} vs ${e.file}`)
      else seen.set(e.url, e.file)
    }
    expect(collisions).toEqual([])
  })

  it('route group names never leak into external URLs', () => {
    for (const e of collect()) {
      expect(e.url).not.toContain('(')
      expect(e.url).not.toContain(')')
    }
  })

  it('API routes exist only under app/api (never inside a route group)', () => {
    const api = collect().filter((e) => e.kind === 'route')
    expect(api.length).toBeGreaterThan(0)
    for (const e of api) {
      expect(e.file.startsWith(join(APP, 'api') + '/')).toBe(true)
    }
  })
})

describe('Route Surface — surface membership (Phase G structure)', () => {
  it('public surface: homepage and marketing pages live in app/(public)', () => {
    expect(existsSync(join(APP, '(public)', 'page.tsx'))).toBe(true)
    expect(existsSync(join(APP, '(public)', 'home', 'page.tsx'))).toBe(true)
    expect(existsSync(join(APP, '(public)', 'services', 'page.tsx'))).toBe(true)
    expect(existsSync(join(APP, 'page.tsx'))).toBe(false)
  })

  it('auth surface: admin login lives in app/(auth)/admin/login with no group layout above it', () => {
    expect(existsSync(join(APP, '(auth)', 'admin', 'login', 'page.tsx'))).toBe(true)
    expect(existsSync(join(APP, '(auth)', 'layout.tsx'))).toBe(false)
    expect(existsSync(join(APP, 'admin'))).toBe(false)
  })

  it('CRM surface: all admin pages live in app/(admin)/admin behind the AdminLayout wrapper', () => {
    expect(existsSync(join(APP, '(admin)', 'layout.tsx'))).toBe(true)
    expect(existsSync(join(APP, '(admin)', 'admin', 'dashboard', 'page.tsx'))).toBe(true)
    expect(existsSync(join(APP, '(admin)', 'admin', 'jobs', 'page.tsx'))).toBe(true)
    expect(existsSync(join(APP, '(web)'))).toBe(false)
    expect(existsSync(join(APP, 'admin', 'login'))).toBe(false)
  })

  it('app root contains only system pages plus required Next.js files', () => {
    const allowedDirs = new Set([
      '(public)',
      '(auth)',
      '(admin)',
      'api',
      'setup',
      'maintenance',
    ])
    const allowedFiles = new Set([
      'layout.tsx',
      'providers.tsx',
      'globals.css',
      'robots.ts',
      'sitemap.ts',
    ])
    const unexpected: string[] = []
    for (const e of readdirSync(APP, { withFileTypes: true })) {
      if (e.name.startsWith('.')) continue
      if (e.isDirectory() && !allowedDirs.has(e.name)) unexpected.push(`dir:${e.name}`)
      if (e.isFile() && !allowedFiles.has(e.name)) unexpected.push(`file:${e.name}`)
    }
    expect(unexpected).toEqual([])
  })

  it('no empty route groups', () => {
    const groups = readdirSync(APP, { withFileTypes: true }).filter(
      (e) => e.isDirectory() && isGroup(e.name)
    )
    expect(groups.length).toBeGreaterThan(0)
    for (const g of groups) {
      const stack = [join(APP, g.name)]
      let count = 0
      while (stack.length) {
        const dir = stack.pop()!
        for (const e of readdirSync(dir, { withFileTypes: true })) {
          if (e.isDirectory()) stack.push(join(dir, e.name))
          else count++
        }
      }
      expect(count, `route group ${g.name} is empty`).toBeGreaterThan(0)
    }
  })
})
