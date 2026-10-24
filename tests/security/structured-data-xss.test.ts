import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { serializeStructuredData } from '@/lib/seo'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('public structured-data stored XSS boundary', () => {
  it.each([
    '</script><script>alert(document.cookie)</script>',
    '</ScRiPt><img src=x onerror=alert(1)>',
    '<!--<script> & \u2028 \u2029',
  ])('keeps stored content inside the JSON script: %s', payload => {
    const value = { name: payload, nested: { description: payload } }
    const json = serializeStructuredData(value)
    const html = renderToStaticMarkup(createElement('script', {
      type: 'application/ld+json', dangerouslySetInnerHTML: { __html: json },
    }))
    expect(JSON.parse(json)).toEqual(value)
    expect(json).not.toMatch(/[<>&\u2028\u2029]/)
    expect(html.match(/<script\b/gi)).toHaveLength(1)
    expect(html.match(/<\/script>/gi)).toHaveLength(1)
  })

  it('has no remaining raw JSON.stringify script sinks in public pages', () => {
    const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
      entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)])
    const leaks = walk('app/(public)').filter(file => /\.[jt]sx?$/.test(file))
      .filter(file => /dangerouslySetInnerHTML=\{\{\s*__html:\s*JSON\.stringify/.test(readFileSync(file, 'utf8')))
    expect(leaks).toEqual([])
  })
})
