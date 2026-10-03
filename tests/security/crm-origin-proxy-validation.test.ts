import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { isTrustedCrmMutationRequest } from '@/lib/crm/security'

function request(
  url: string,
  headers: Record<string, string>,
  method = 'PATCH'
) {
  return new NextRequest(url, { method, headers })
}

describe('CRM reverse-proxy origin validation', () => {
  it('accepts a normal same-origin CRM mutation', () => {
    const req = request('https://maintainex.lk/api/admin/financial/providers', {
      origin: 'https://maintainex.lk',
      host: 'maintainex.lk',
      'sec-fetch-site': 'same-origin',
    })

    expect(isTrustedCrmMutationRequest(req)).toBe(true)
  })

  it('accepts the public HTTPS origin when Next.js sees an internal proxy URL', () => {
    const req = request('http://maintainex:3000/api/admin/financial/providers', {
      origin: 'https://admin.maintainex.lk',
      host: 'maintainex:3000',
      'x-forwarded-host': 'admin.maintainex.lk',
      'x-forwarded-proto': 'https',
      'sec-fetch-site': 'same-origin',
    })

    expect(isTrustedCrmMutationRequest(req)).toBe(true)
  })

  it('accepts a proxy TLS scheme mismatch only with the browser same-origin signal', () => {
    const req = request('http://admin.maintainex.lk/api/admin/financial/providers', {
      origin: 'https://admin.maintainex.lk',
      host: 'admin.maintainex.lk',
      'sec-fetch-site': 'same-origin',
    })

    expect(isTrustedCrmMutationRequest(req)).toBe(true)
  })

  it('rejects an unrelated origin even when the browser reports same-origin', () => {
    const req = request('http://maintainex:3000/api/admin/financial/providers', {
      origin: 'https://evil.example',
      host: 'maintainex:3000',
      'x-forwarded-host': 'admin.maintainex.lk',
      'x-forwarded-proto': 'https',
      'sec-fetch-site': 'same-origin',
    })

    expect(isTrustedCrmMutationRequest(req)).toBe(false)
  })

  it('rejects cross-site browser mutations before considering forwarded headers', () => {
    const req = request('http://maintainex:3000/api/admin/financial/providers', {
      origin: 'https://evil.example',
      host: 'maintainex:3000',
      'x-forwarded-host': 'evil.example',
      'x-forwarded-proto': 'https',
      'sec-fetch-site': 'cross-site',
    })

    expect(isTrustedCrmMutationRequest(req)).toBe(false)
  })

  it('requires exact reconstructed origin when Sec-Fetch-Site is unavailable', () => {
    const good = request('http://maintainex:3000/api/admin/financial/providers', {
      origin: 'https://admin.maintainex.lk',
      host: 'maintainex:3000',
      'x-forwarded-host': 'admin.maintainex.lk',
      'x-forwarded-proto': 'https',
    })
    const bad = request('http://maintainex:3000/api/admin/financial/providers', {
      origin: 'http://admin.maintainex.lk',
      host: 'maintainex:3000',
      'x-forwarded-host': 'admin.maintainex.lk',
      'x-forwarded-proto': 'https',
    })

    expect(isTrustedCrmMutationRequest(good)).toBe(true)
    expect(isTrustedCrmMutationRequest(bad)).toBe(false)
  })

  it('rejects cookie-authenticated mutations with no Origin', () => {
    const req = request('https://maintainex.lk/api/admin/financial/providers', {
      host: 'maintainex.lk',
      'sec-fetch-site': 'same-origin',
    })

    expect(isTrustedCrmMutationRequest(req)).toBe(false)
  })

  it('keeps safe methods and bearer-token clients allowed', () => {
    const getReq = request(
      'https://maintainex.lk/api/admin/financial/providers',
      {},
      'GET'
    )
    const bearerReq = request('https://maintainex.lk/api/admin/financial/providers', {
      authorization: 'Bearer test-token',
    })

    expect(isTrustedCrmMutationRequest(getReq)).toBe(true)
    expect(isTrustedCrmMutationRequest(bearerReq)).toBe(true)
  })
})
