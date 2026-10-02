import { describe, expect, it } from 'vitest'
import {
  formatPayPalAmount,
  parsePayPalAmountToMinor,
  parsePayPalCaptureResource,
} from '@/lib/finance/payments/paypal-adapter'

describe('PayPal adapter normalization', () => {
  it('formats and parses provider amounts without floating-point arithmetic', () => {
    expect(formatPayPalAmount(12345n, 'CAD')).toBe('123.45')
    expect(parsePayPalAmountToMinor('123.45', 'CAD')).toBe(12345n)
    expect(parsePayPalAmountToMinor('123.4', 'CAD')).toBe(12340n)
    expect(parsePayPalAmountToMinor('123.456', 'CAD')).toBeNull()
  })

  it('respects zero-decimal currencies', () => {
    expect(formatPayPalAmount(123n, 'JPY')).toBe('123')
    expect(parsePayPalAmountToMinor('123', 'JPY')).toBe(123n)
    expect(parsePayPalAmountToMinor('123.00', 'JPY')).toBeNull()
  })

  it('extracts provider fee and net settlement from capture resources', () => {
    const capture = parsePayPalCaptureResource({
      id: 'CAPTURE-1',
      status: 'COMPLETED',
      amount: { value: '100.00', currency_code: 'CAD' },
      supplementary_data: {
        related_ids: { order_id: 'ORDER-1' },
      },
      seller_receivable_breakdown: {
        paypal_fee: { value: '3.20', currency_code: 'CAD' },
        net_amount: { value: '96.80', currency_code: 'CAD' },
      },
    })

    expect(capture).toEqual({
      captureId: 'CAPTURE-1',
      captureStatus: 'COMPLETED',
      orderId: 'ORDER-1',
      amountValue: '100.00',
      currency: 'CAD',
      providerFeeValue: '3.20',
      netSettlementValue: '96.80',
    })
  })
})
