import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('Phase04 blocking release CI: production HTTP redirects dependency advisory',()=>{
  it('pins an integrity-verified patched follow-redirects version without disabling npm audit',()=>{
    const read=(p:string)=>JSON.parse(readFileSync(resolve(process.cwd(),p),'utf8'))
    const manifest=read('package.json')
    const lock=read('package-lock.json')
    const redirects=lock.packages['node_modules/follow-redirects']
    expect(manifest.overrides['follow-redirects']).toBe('1.16.1')
    expect(redirects.version).toBe('1.16.1')
    expect(redirects.resolved).toBe(
      'https://registry.npmjs.org/follow-redirects/-/follow-redirects-1.16.1.tgz',
    )
    expect(redirects.integrity).toBe(
      'sha512-FNvFGzoMLWmE6Yj9spb/zjd7yiNCHiAW9/Tg9CXrQ8wuu32HtlJOwWO11OJafl5FfY3DxTdQ0vj42zU1kvv5jg==',
    )
    expect(Object.keys(lock.packages).filter(k=>k.endsWith('/follow-redirects')))
      .toEqual(['node_modules/follow-redirects'])
    const workflow=readFileSync(resolve(process.cwd(),
      '.github/workflows/phase0-7-validation.yml'),'utf8')
    expect(workflow).toContain('npm audit --omit=dev --audit-level=high')
    expect(workflow).not.toContain('audit-level=none')
  })
})
