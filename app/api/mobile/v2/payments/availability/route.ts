import { NextResponse } from 'next/server'
import { logger } from '@/lib/shared/observability/logger'
import { onlinePaymentAvailability } from '@/lib/finance/payments/provider-registry'

/**
 * Canonical payment availability for mobile clients.
 *
 * Exposes only derived booleans so a client can hide an online payment option
 * that this deployment has intentionally not configured, instead of showing a
 * control that the server would reject. It never exposes provider credentials
 * and never relaxes server-side enforcement.
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    return NextResponse.json(
      {
        ...onlinePaymentAvailability(),
        cashAvailable: true,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (error) {
    logger.error('Payment availability lookup failed unexpectedly', { err: error })
    // Fail closed for clients: hide online payment rather than advertising it.
    return NextResponse.json(
      {
        onlinePaymentAvailable: false,
        provider: null,
        reason: 'not_configured',
        cashAvailable: true,
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}