import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Legacy PayHere hosted checkout.
 *
 * Historical PayHere financial records remain readable, but MaintainEX no
 * longer starts PayHere checkout for a new payment. Returning 410 also makes
 * old hosted-checkout links fail closed instead of collecting payment.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ intentId: string }> }
) {
  const { intentId } = await params

  secureConsole.warn('[payments] blocked legacy PayHere checkout request', {
    intentId,
    reason: 'PAYHERE_DISABLED_FOR_NEW_CHECKOUT',
  })

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Payment method unavailable</title>
  <style>
    body{font-family:system-ui,-apple-system,sans-serif;background:#0d0d0d;color:#fff;display:grid;place-items:center;min-height:100vh;margin:0}
    main{max-width:420px;padding:32px;text-align:center}
    h1{font-size:20px;margin:0 0 12px}
    p{color:#bdbdbd;line-height:1.6}
  </style>
</head>
<body>
  <main>
    <h1>Payment method no longer available</h1>
    <p>This payment session uses a retired payment method and can no longer be completed.</p>
    <p>Please return to your job and start a new payment to continue.</p>
  </main>
</body>
</html>`

  return new NextResponse(html, {
    status: 410,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      'Referrer-Policy': 'no-referrer',
      'X-Frame-Options': 'DENY',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
    },
  })
}
