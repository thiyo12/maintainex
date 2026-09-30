import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  requestPayHereRefund,
  resetPayHereMerchantTokenCacheForTests,
  retrievePayHerePayment,
} from '@/lib/payment/payhere-adapter'

const ORIGINAL = {
  appId: process.env.PAYHERE_APP_ID,
  appSecret: process.env.PAYHERE_APP_SECRET,
  sandbox: process.env.PAYHERE_SANDBOX,
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  process.env.PAYHERE_APP_ID = 'test-app'
  process.env.PAYHERE_APP_SECRET = 'test-secret'
  process.env.PAYHERE_SANDBOX = 'true'
  resetPayHereMerchantTokenCacheForTests()
})

afterEach(() => {
  vi.restoreAllMocks()
  resetPayHereMerchantTokenCacheForTests()
  if (ORIGINAL.appId === undefined) delete process.env.PAYHERE_APP_ID
  else process.env.PAYHERE_APP_ID = ORIGINAL.appId
  if (ORIGINAL.appSecret === undefined) delete process.env.PAYHERE_APP_SECRET
  else process.env.PAYHERE_APP_SECRET = ORIGINAL.appSecret
  if (ORIGINAL.sandbox === undefined) delete process.env.PAYHERE_SANDBOX
  else process.env.PAYHERE_SANDBOX = ORIGINAL.sandbox
})

describe('PayHere Merchant API adapter', () => {
  it('authenticates and submits a sandbox refund without exposing credentials in URL/body', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(response({
        access_token: 'token-1',
        expires_in: 599,
        token_type: 'bearer',
      }))
      .mockResolvedValueOnce(response({
        status: 1,
        msg: 'Successfully processed the refund',
        data: 560034010257,
      }))

    const result = await requestPayHereRefund('320027150501', 'MaintainEX test refund')

    expect(result).toEqual({
      status: 1,
      message: 'Successfully processed the refund',
      refundReference: '560034010257',
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://sandbox.payhere.lk/merchant/v1/oauth/token')
    expect(String(fetchMock.mock.calls[1][0])).toBe('https://sandbox.payhere.lk/merchant/v1/payment/refund')

    const authHeaders = fetchMock.mock.calls[0][1]?.headers as Record<string, string>
    expect(authHeaders.Authorization).toMatch(/^Basic /)

    const refundBody = String(fetchMock.mock.calls[1][1]?.body || '')
    expect(refundBody).toContain('"payment_id":"320027150501"')
    expect(refundBody).not.toContain('test-secret')
  })

  it('reuses the cached OAuth token for retrieval', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(response({
        access_token: 'token-1',
        expires_in: 599,
      }))
      .mockResolvedValueOnce(response({
        status: 1,
        msg: 'refund accepted',
        data: 1001,
      }))
      .mockResolvedValueOnce(response({
        status: 1,
        msg: 'found',
        data: [{
          payment_id: 320027150501,
          order_id: 'MX-ORDER-1',
          status: 'REFUND PROCESSING',
        }],
      }))

    await requestPayHereRefund('320027150501', 'refund')
    const retrieval = await retrievePayHerePayment('MX-ORDER-1')

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(String(fetchMock.mock.calls[2][0])).toContain(
      'https://sandbox.payhere.lk/merchant/v1/payment/search?order_id=MX-ORDER-1'
    )
    expect(retrieval.payments[0]?.status).toBe('REFUND PROCESSING')
  })

  it('fails closed when Merchant API credentials are absent', async () => {
    delete process.env.PAYHERE_APP_ID
    delete process.env.PAYHERE_APP_SECRET

    const fetchMock = vi.spyOn(globalThis, 'fetch')
    const result = await requestPayHereRefund('payment-1', 'refund')

    expect(result.status).toBe(-2)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
