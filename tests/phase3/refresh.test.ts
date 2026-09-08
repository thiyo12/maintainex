import { describe, it, expect } from 'vitest'
import { generateRefreshToken, parseRefreshToken, hashRefreshSecret, verifyRefreshSecret } from '../../lib/auth/refresh'

describe('refresh token utilities', () => {
  describe('generateRefreshToken', () => {
    it('generates token with selector.secret format', () => {
      const { raw } = generateRefreshToken('session-123')
      expect(raw).toMatch(/^session-123\.[a-f0-9]+$/)
    })

    it('generates different secrets on each call', () => {
      const a = generateRefreshToken('session-123')
      const b = generateRefreshToken('session-123')
      expect(a.raw).not.toBe(b.raw)
      expect(a.secretHash).not.toBe(b.secretHash)
    })

    it('generates 128 hex char secrets (64 bytes)', () => {
      const { raw } = generateRefreshToken('session-123')
      const secret = raw.split('.')[1]
      expect(secret).toHaveLength(128)
    })

    it('returns sha256 hash of secret', () => {
      const { secretHash } = generateRefreshToken('session-123')
      expect(secretHash).toHaveLength(64)
      expect(secretHash).toMatch(/^[a-f0-9]+$/)
    })
  })

  describe('parseRefreshToken', () => {
    it('parses valid token', () => {
      const { raw } = generateRefreshToken('sess-abc')
      const parsed = parseRefreshToken(raw)
      expect(parsed).not.toBeNull()
      expect(parsed!.sessionId).toBe('sess-abc')
      expect(parsed!.secret).toHaveLength(128)
    })

    it('rejects token without dot', () => {
      expect(parseRefreshToken('nodothere')).toBeNull()
    })

    it('rejects token with empty selector', () => {
      expect(parseRefreshToken('.abcdef')).toBeNull()
    })

    it('rejects token with short secret', () => {
      expect(parseRefreshToken('session.abc')).toBeNull()
    })

    it('rejects empty string', () => {
      expect(parseRefreshToken('')).toBeNull()
    })
  })

  describe('hashRefreshSecret', () => {
    it('produces deterministic output', () => {
      const a = hashRefreshSecret('test-secret')
      const b = hashRefreshSecret('test-secret')
      expect(a).toBe(b)
    })

    it('produces 64 char hex string', () => {
      const hash = hashRefreshSecret('any-input')
      expect(hash).toHaveLength(64)
      expect(hash).toMatch(/^[a-f0-9]+$/)
    })

    it('different inputs produce different hashes', () => {
      const a = hashRefreshSecret('secret-a')
      const b = hashRefreshSecret('secret-b')
      expect(a).not.toBe(b)
    })
  })

  describe('verifyRefreshSecret', () => {
    it('returns true for matching secret and hash', () => {
      const secret = 'my-secret-value'
      const hash = hashRefreshSecret(secret)
      expect(verifyRefreshSecret(secret, hash)).toBe(true)
    })

    it('returns false for wrong secret', () => {
      const hash = hashRefreshSecret('correct-secret')
      expect(verifyRefreshSecret('wrong-secret', hash)).toBe(false)
    })

    it('returns false for mismatched hash length', () => {
      expect(verifyRefreshSecret('secret', 'tooshort')).toBe(false)
    })
  })

  describe('round-trip', () => {
    it('generate → parse → verify succeeds', () => {
      const { raw, secretHash } = generateRefreshToken('sess-roundtrip')
      const parsed = parseRefreshToken(raw)
      expect(parsed).not.toBeNull()
      expect(verifyRefreshSecret(parsed!.secret, secretHash)).toBe(true)
    })
  })
})
