import crypto from 'crypto'
import { describe, expect, it } from 'vitest'
import {
  formatPayHereAmount,
  generateCheckoutHash,
  parsePayHereAmount,
  verifyNotificationSignature,
} from '@/lib/payment/payhere-adapter'

describe('PayHere adapter', () => {
  it('formats canonical minor units exactly without floating point', () => {
    expect(formatPayHereAmount(500000n)).toBe('5000.00')
    expect(formatPayHereAmount(500050n)).toBe('5000.50')
    expect(formatPayHereAmount(1n)).toBe('0.01')
  })

  it('parses only valid two-decimal PayHere amounts', () => {
    expect(parsePayHereAmount('5000.00')).toBe(500000n)
    expect(parsePayHereAmount('5000.5')).toBe(500050n)
    expect(parsePayHereAmount('5000.005')).toBeNull()
    expect(parsePayHereAmount('LKR 5000.00')).toBeNull()
    expect(parsePayHereAmount('1.2.3')).toBeNull()
  })

  it('uses the official uppercase MD5 checkout hash structure', () => {
    const merchantId = '1234567'
    const orderId = 'MX-ORDER-1'
    const amount = '5000.00'
    const currency = 'LKR'
    const secret = 'merchant-secret'

    const secretHash = crypto.createHash('md5').update(secret).digest('hex').toUpperCase()
    const expected = crypto
      .createHash('md5')
      .update(`${merchantId}${orderId}${amount}${currency}${secretHash}`)
      .digest('hex')
      .toUpperCase()

    const actual = generateCheckoutHash(merchantId, orderId, amount, currency, secret)
    expect(actual).toBe(expected)
    expect(actual).toMatch(/^[A-F0-9]{32}$/)
  })

  it('verifies signed notification hashes case-insensitively', () => {
    const secret = 'merchant-secret'
    const notification = {
      merchant_id: '1234567',
      order_id: 'MX-ORDER-1',
      payhere_amount: '5000.00',
      payhere_currency: 'LKR',
      status_code: '2',
      md5sig: '',
    }

    const secretHash = crypto.createHash('md5').update(secret).digest('hex').toUpperCase()
    const signature = crypto
      .createHash('md5')
      .update(
        `${notification.merchant_id}${notification.order_id}${notification.payhere_amount}${notification.payhere_currency}${notification.status_code}${secretHash}`
      )
      .digest('hex')
      .toUpperCase()

    expect(verifyNotificationSignature({ ...notification, md5sig: signature }, secret)).toBe(true)
    expect(verifyNotificationSignature({ ...notification, md5sig: signature.toLowerCase() }, secret)).toBe(true)
    expect(verifyNotificationSignature({ ...notification, md5sig: '0'.repeat(32) }, secret)).toBe(false)
  })
})
