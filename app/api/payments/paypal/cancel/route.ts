import { NextRequest, NextResponse } from 'next/server'
import { cancelPayPalCheckout } from '@/lib/finance/payments/paypal-service'

function renderPage(input: {
  title: string
  message: string
  jobId?: string
}): string {
  const deepLink = input.jobId
    ? `maintainex://jobs/v2/confirm/${encodeURIComponent(input.jobId)}`
    : 'maintainex://'
  const safeTitle = input.title.replace(/[<>&"]/g, '')
  const safeMessage = input.message.replace(/[<>&"]/g, '')

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${safeTitle}</title>
  <style>
    body{font-family:system-ui,-apple-system,sans-serif;background:#f6f7f8;color:#111315;display:grid;place-items:center;min-height:100vh;margin:0}
    main{width:min(440px,calc(100vw - 32px));background:#fff;border:1px solid #e5e7eb;border-radius:18px;padding:32px;box-shadow:0 16px 48px rgba(17,19,21,.08);text-align:center}
    .mark{width:52px;height:52px;border-radius:14px;background:#f5a623;display:grid;place-items:center;margin:0 auto 18px;font-weight:900}
    h1{font-size:24px;margin:0 0 10px}
    p{color:#62666b;line-height:1.55;margin:0}
    a{display:inline-block;margin-top:22px;background:#f5a623;color:#111315;text-decoration:none;font-weight:800;padding:13px 20px;border-radius:12px}
  </style>
</head>
<body>
  <main>
    <div class="mark">MX</div>
    <h1>${safeTitle}</h1>
    <p>${safeMessage}</p>
    <a href="${deepLink}">Open MaintainEX</a>
  </main>
  <script>setTimeout(function(){ window.location.href = ${JSON.stringify(deepLink)}; }, 900);</script>
</body>
</html>`
}

export async function GET(request: NextRequest) {
  const paymentIntentId =
    request.nextUrl.searchParams.get('paymentIntentId')?.trim() || ''
  const orderId = request.nextUrl.searchParams.get('token')?.trim() || ''

  if (!paymentIntentId || !orderId) {
    return new NextResponse('Missing PayPal payment reference', { status: 400 })
  }

  const result = await cancelPayPalCheckout({
    paymentIntentId,
    orderId,
  })

  
  const title = result.success
    ? result.cancelled
      ? 'Payment cancelled'
      : 'Payment already processed'
    : 'Cancellation could not be confirmed'
  const message = result.success
    ? result.cancelled
      ? 'The PayPal checkout was cancelled. If PayPal later reports a capture, MaintainEX will isolate it for refund reconciliation.'
      : 'This payment could not be cancelled because MaintainEX found a completed or protected payment state.'
    : 'MaintainEX could not validate this PayPal cancellation request.'

  return new NextResponse(
    renderPage({
      title,
      message,
      jobId: result.jobId,
    }),
    {
      status: result.success ? 200 : 409,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, max-age=0',
        'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
      },
    }
  )
}
