import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const source = readFileSync(resolve(process.cwd(), 'middleware.ts'), 'utf-8')

describe('middleware crawler security boundary', () => {
  it('limits AI crawler handling to public document routes', () => {
    expect(source).toContain('const isPublicDocumentRoute =')
    expect(source).toContain("!pathname.startsWith('/api/')")
    expect(source).toContain("!pathname.startsWith('/admin')")
    expect(source).toContain("!pathname.startsWith('/setup')")
    expect(source).toContain('if (isPublicDocumentRoute && isAiCrawler(request))')
  })

  it('does not use a bare crawler shortcut that can bypass protected surfaces', () => {
    expect(source).not.toContain('if (isAiCrawler(request)) {')
  })

  it('keeps public crawler behavior without changing homepage content', () => {
    expect(source).toContain("response.headers.set('X-Robots-Tag', 'all')")
    expect(source).toContain("response.headers.set('Cache-Control', 'public, max-age=3600')")
  })
})
