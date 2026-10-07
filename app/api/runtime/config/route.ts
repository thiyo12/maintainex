import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'
import { getPlatformRuntimeConfig } from '@/lib/runtime/platform-runtime'

export async function GET(request: NextRequest) {
  try {
    const country = new URL(request.url).searchParams.get('country')
    const config = await getPlatformRuntimeConfig(country)

    return NextResponse.json(config, {
      headers: {
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    secureConsole.error('Public runtime config error:', error)
    return NextResponse.json(
      {
        channels: { website: true, mobile: true, booking: false },
        maintenance: { enabled: false, message: '' },
        catalog: { visible: true },
        offers: { visible: true },
        notifications: { enabled: true },
        banner: { enabled: false, message: '', severity: 'INFO' },
        mobile: { minimumVersion: '1.0.0' },
        market: { countryCode: null, available: true, availableMarkets: [] },
        booking: {
          enabled: false,
          locked: true,
          reason: 'PUBLIC_BOOKING_UX_GATE_PENDING',
        },
        degraded: true,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
          'X-MaintainEX-Runtime-Fallback': '1',
          'X-Content-Type-Options': 'nosniff',
        },
      }
    )
  }
}
