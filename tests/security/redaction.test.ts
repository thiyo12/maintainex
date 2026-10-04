import { describe, it, expect } from 'vitest'
import { redactObject, redactString } from '@/lib/observability/redaction'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('Redaction', () => {
  it('redacts password fields', () => {
    const input = { password: 'secret123', name: 'John' }
    const result = redactObject(input) as any
    expect(result.password).toBe('[REDACTED]')
    expect(result.name).toBe('John')
  })

  it('redacts token fields', () => {
    const input = { token: 'abc123', apiKey: 'xyz789' }
    const result = redactObject(input) as any
    expect(result.token).toBe('[REDACTED]')
    expect(result.apiKey).toBe('[REDACTED]')
  })

  it('redacts nested objects', () => {
    const input = { user: { password: 'secret' } }
    const result = redactObject(input) as any
    expect(result.user.password).toBe('[REDACTED]')
  })

  it('redacts strings containing sensitive patterns', () => {
    const input = 'DATABASE_URL=postgresql://user:pass@host/db'
    const result = redactString(input)
    expect(result).toContain('[REDACTED]')
  })

  it('redacts bearer credentials and database passwords embedded in error strings', () => {
    expect(redactString('Authorization failed: Bearer abcdefghijklmnopqrstuvwxyz012345'))
      .toContain('Bearer [REDACTED]')
    const db = redactString('connect postgresql://maintainex:supersecretpassword@db.internal/app')
    expect(db).toContain('postgresql://maintainex:[REDACTED]@db.internal/app')
    expect(db).not.toContain('supersecretpassword')
  })

  it('never passes raw Error objects to the production structured logger path', () => {
    const logger = readFileSync(resolve(process.cwd(), 'lib/shared/observability/logger.ts'), 'utf8')
    const crmAudit = readFileSync(resolve(process.cwd(), 'lib/crm/audit.ts'), 'utf8')
    const mobileUpload = readFileSync(resolve(process.cwd(), 'app/api/mobile/upload/route.ts'), 'utf8')

    expect(logger).toContain('sanitizeErrorForLog')
    expect(logger).toContain("message: '[REDACTED]'")
    expect(logger).not.toContain('baseLogger.error({ ...enriched, err }, message)')
    expect(crmAudit).toContain("logger.error('Failed to create audit log', { err: error })")
    expect(crmAudit).not.toContain("console.error('Failed to create audit log:'")
    expect(mobileUpload).toContain("logger.error('Mobile upload failed', {")
    expect(mobileUpload).toContain('err: error')
    expect(mobileUpload).not.toContain("console.error('Upload error:'")
  })

  it('preserves safe values', () => {
    const input = { name: 'John', age: 30, active: true }
    const result = redactObject(input)
    expect(result).toEqual(input)
  })
})
