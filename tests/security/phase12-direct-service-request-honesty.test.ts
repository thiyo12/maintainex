import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = (name: string) => readFileSync(resolve(process.cwd(), name), 'utf8')

describe('Phase 12 — direct requests must not appear confirmed before quote acceptance', () => {
  it('retains OPEN bookings and PENDING quotes without mutating the finance lifecycle', () => {
    const code = source('lib/domain/book-now.ts')
    expect(code).toContain("status: 'OPEN'")
    expect(code).toContain("status: 'PENDING'")
    expect(code).toContain("title: 'New direct service request'")
    expect(code).toContain('Review and respond before confirming the appointment.')
    expect(code).not.toContain('has been booked with you')
    expect(code).not.toContain("'BOOK_NOW instant booking'")
  })

  it('returns an explicit unconfirmed appointment message from the booking endpoint', () => {
    const code = source('app/api/mobile/v2/book-now/route.ts')
    expect(code).toContain(
      'Service request sent. The provider must confirm the quote and appointment before it is booked.',
    )
    expect(code).not.toContain('BOOK_NOW job created.')
  })

  it('keeps the mobile provider selection as a request, not a confirmed booking', () => {
    const screen = source('apps/mobile/features/customer/screens/find/booking/[jobId].tsx')
    expect(screen).toContain('Continue service request')
    expect(screen).toContain('No appointment is confirmed until they respond.')
    expect(screen).toContain('Provider acceptance and payment happen later.')
    expect(screen).toContain("pathname: '/(customer)/jobs/v2/create'")
    expect(screen).not.toContain('AVAILABLE TODAY')
    expect(screen).not.toContain('Available now')
  })
})
