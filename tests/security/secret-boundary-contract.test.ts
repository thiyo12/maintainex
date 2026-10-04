import { describe, expect, it } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const FORBIDDEN_SERVER_SECRETS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'MARKETPLACE_JWT_SECRET',
  'STAFF_JWT_SECRET',
  'NEXTAUTH_SECRET',
  'PASSWORD_PEPPER',
  'IDENTITY_CLAIM_PEPPER',
  'INTERNAL_SYNC_SECRET',
  'CRON_SECRET',
  'PAYPAL_CLIENT_SECRET',
  'PAYPAL_WEBHOOK_ID',
  'PAYHERE_MERCHANT_SECRET',
  'PAYHERE_APP_SECRET',
  'CLOUDINARY_API_SECRET',
  'SMTP_APP_PASSWORD',
] as const

function walk(root: string): string[] {
  if (!existsSync(root)) return []
  const out: string[] = []
  for (const entry of readdirSync(root)) {
    if (['node_modules', '.next', 'dist', 'build', 'coverage'].includes(entry)) continue
    const path = join(root, entry)
    const stat = statSync(path)
    if (stat.isDirectory()) out.push(...walk(path))
    else out.push(path)
  }
  return out
}

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('server secret boundaries', () => {
  it('keeps server-only credentials out of every mobile source/config file', () => {
    const mobileRoot = resolve(process.cwd(), 'apps/mobile')
    const textFiles = walk(mobileRoot).filter(path =>
      /\.(?:ts|tsx|js|jsx|json|env|example|md)$/.test(path)
    )

    const leaks: Array<{ file: string; secret: string }> = []
    for (const file of textFiles) {
      const text = readFileSync(file, 'utf8')
      for (const secret of FORBIDDEN_SERVER_SECRETS) {
        if (text.includes(secret)) {
          leaks.push({ file: file.replace(process.cwd(), ''), secret })
        }
      }
    }

    expect(leaks).toEqual([])
  })

  it('keeps server-only credentials out of Next.js client components', () => {
    const roots = ['app', 'components']
    const clientFiles = roots
      .flatMap(root => walk(resolve(process.cwd(), root)))
      .filter(path => /\.(?:ts|tsx|js|jsx)$/.test(path))
      .filter(path => {
        const text = readFileSync(path, 'utf8')
        return text.includes("'use client'") || text.includes('"use client"')
      })

    const leaks: Array<{ file: string; secret: string }> = []
    for (const file of clientFiles) {
      const text = readFileSync(file, 'utf8')
      for (const secret of FORBIDDEN_SERVER_SECRETS) {
        if (text.includes(secret)) {
          leaks.push({ file: file.replace(process.cwd(), ''), secret })
        }
      }
    }

    expect(leaks).toEqual([])
  })

  it('keeps sensitive local material outside the Docker build context', () => {
    const dockerignore = source('.dockerignore')
    for (const required of [
      '**/.env',
      '**/.env.*',
      '**/secrets/',
      '**/credentials/',
      '**/.npmrc',
      'id_rsa*',
      'id_ed25519*',
      '*.key',
      '*.p12',
      '*.pfx',
      '*.dump',
      '*.sql.gz',
      'backups/',
      '.terraform/',
      '*.tfstate',
    ]) {
      expect(dockerignore).toContain(required)
    }
  })

  it('secret-scanning CI recognizes named MaintainEX credentials and database URLs', () => {
    const workflow = source('.github/workflows/security-exposure-audit.yml')
    for (const secret of [
      'DATABASE_URL',
      'MARKETPLACE_JWT_SECRET',
      'STAFF_JWT_SECRET',
      'JWT_REFRESH_SECRET',
      'PASSWORD_PEPPER',
      'IDENTITY_CLAIM_PEPPER',
      'INTERNAL_SYNC_SECRET',
      'CRON_SECRET',
      'PAYPAL_CLIENT_SECRET',
      'PAYHERE_MERCHANT_SECRET',
      'PAYHERE_APP_SECRET',
      'CLOUDINARY_API_SECRET',
      'SMTP_APP_PASSWORD',
    ]) {
      expect(workflow).toContain(secret)
    }
    expect(workflow).toContain('sensitive-env-assignment')
    expect(workflow).toContain('database-credential')
  })
})
