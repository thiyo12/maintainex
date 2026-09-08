import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(process.cwd())

function fileExists(path: string): boolean {
  try {
    readFileSync(path)
    return true
  } catch {
    return false
  }
}

function readFile(path: string): string {
  return readFileSync(path, 'utf-8')
}

describe('Deployment Safety — No prisma db push in production paths', () => {
  it('Dockerfile does not contain prisma db push', () => {
    const dockerfile = join(ROOT, 'Dockerfile')
    if (!fileExists(dockerfile)) return
    const content = readFile(dockerfile)
    expect(content).not.toContain('prisma db push')
    expect(content).not.toContain('db push')
  })

  it('Dockerfile uses prisma migrate deploy', () => {
    const dockerfile = join(ROOT, 'Dockerfile')
    if (!fileExists(dockerfile)) return
    const content = readFile(dockerfile)
    expect(content).toContain('prisma migrate deploy')
  })

  it('Dockerfile does not contain --accept-data-loss', () => {
    const dockerfile = join(ROOT, 'Dockerfile')
    if (!fileExists(dockerfile)) return
    const content = readFile(dockerfile)
    expect(content).not.toContain('--accept-data-loss')
  })

  it('Dockerfile does not contain migrate reset', () => {
    const dockerfile = join(ROOT, 'Dockerfile')
    if (!fileExists(dockerfile)) return
    const content = readFile(dockerfile)
    expect(content).not.toContain('migrate reset')
  })

  it('docker-compose.yml does not contain prisma db push', () => {
    const compose = join(ROOT, 'docker-compose.yml')
    if (!fileExists(compose)) return
    const content = readFile(compose)
    expect(content).not.toContain('prisma db push')
    expect(content).not.toContain('db push')
  })

  it('no deployment shell scripts use prisma db push', () => {
    const deployScripts = ['deploy-rsync.sh', 'deploy.sh', 'deploy-production.sh']
    for (const script of deployScripts) {
      const path = join(ROOT, script)
      if (!fileExists(path)) continue
      const content = readFile(path)
      expect(content).not.toContain('prisma db push')
      expect(content).not.toContain('db push')
      expect(content).not.toContain('--accept-data-loss')
      expect(content).not.toContain('migrate reset')
    }
  })
})
