import { NextRequest, NextResponse } from 'next/server'
import { getPaymentCheckoutForm } from '@/lib/payment/payment-service'
import { resolvePaymentPublicOrigin } from '@/lib/finance/payments/public-origin'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ intentId: string }> }
) {
  const { intentId } = await params
  const token = request.nextUrl.searchParams.get('token') || ''
  const baseUrl = resolvePaymentPublicOrigin(request.url)
  if (!baseUrl) {
    return new NextResponse('Payment public URL is not configured.', {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  const checkout = await getPaymentCheckoutForm(intentId, token, baseUrl)
  if (!checkout) {
    return new NextResponse('Payment session is invalid or no longer available.', {
      status: 404,
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  const fields = Object.entries(checkout.fields)
    .map(([name, value]) => `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}" />`)
    .join('\n')

  const actionOrigin = new URL(checkout.actionUrl).origin
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Redirecting to secure payment</title>
  <style>
    body{font-family:system-ui,-apple-system,sans-serif;background:#0d0d0d;color:#fff;display:grid;place-items:center;min-height:100vh;margin:0}
    main{max-width:420px;padding:32px;text-align:center}
    button{background:#f5a623;border:0;border-radius:12px;padding:14px 20px;font-weight:700;color:#111;cursor:pointer}
    p{color:#bdbdbd;line-height:1.5}
  </style>
</head>
<body>
  <main>
    <h1>Secure payment</h1>
    <p>Redirecting you to PayHere. Do not close this page until the payment screen opens.</p>
    <form id="payhere-form" method="post" action="${escapeHtml(checkout.actionUrl)}">
      ${fields}
      <button type="submit">Continue to PayHere</button>
    </form>
  </main>
  <script>document.getElementById('payhere-form').submit();</script>
</body>
</html>`

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      'Referrer-Policy': 'no-referrer',
      'X-Frame-Options': 'DENY',
      'Content-Security-Policy': `default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; form-action ${actionOrigin}; base-uri 'none'; frame-ancestors 'none'`,
    },
  })
}
