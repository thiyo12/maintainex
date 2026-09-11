import { describe, it, expect } from 'vitest'
import { redactObject, redactString } from '@/lib/observability/redaction'

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

  it('preserves safe values', () => {
    const input = { name: 'John', age: 30, active: true }
    const result = redactObject(input)
    expect(result).toEqual(input)
  })
})
