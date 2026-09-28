import { describe, it, expect } from 'vitest'
import path from 'path'

describe('Path traversal protection', () => {
  const PUBLIC_ROOT = path.resolve(process.cwd(), 'public')

  function isPathSafe(requestedPath: string): boolean {
    try {
      const resolved = path.resolve(requestedPath)
      if (!resolved.startsWith(PUBLIC_ROOT + path.sep) && resolved !== PUBLIC_ROOT) return false
      return true
    } catch {
      return false
    }
  }

  it('allows valid public file', () => {
    expect(isPathSafe(path.join(PUBLIC_ROOT, 'uploads', 'test.jpg'))).toBe(true)
  })

  it('rejects single .. traversal', () => {
    expect(isPathSafe(path.join(PUBLIC_ROOT, '..', '.env'))).toBe(false)
  })

  it('rejects multiple .. traversal', () => {
    expect(isPathSafe(path.join(PUBLIC_ROOT, '..', '..', '.env'))).toBe(false)
  })

  it('rejects absolute path attempt', () => {
    expect(isPathSafe('/etc/passwd')).toBe(false)
  })

  it('allows valid nested public file', () => {
    expect(isPathSafe(path.join(PUBLIC_ROOT, 'uploads', 'industries', 'test.jpg'))).toBe(true)
  })

  it('allows the public root itself', () => {
    expect(isPathSafe(PUBLIC_ROOT)).toBe(true)
  })

  it('rejects path above root via .. segments', () => {
    expect(isPathSafe(path.resolve(PUBLIC_ROOT, '..', '..', 'etc', 'passwd'))).toBe(false)
  })

  it('rejects path with double dots in middle', () => {
    expect(isPathSafe(path.join(PUBLIC_ROOT, 'uploads', '..', '..', '.env'))).toBe(false)
  })
})
