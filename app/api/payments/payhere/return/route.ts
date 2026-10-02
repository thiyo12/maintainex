import { NextRequest, NextResponse } from 'next/server'

function page(jobId: string, cancelled: boolean): string {
  const safeJobId = encodeURIComponent(jobId)
  const deepLink = `maintainex://jobs/v2/confirm/${safeJobId}`
  const title = cancelled ? 'Payment cancelled' : 'Checking your payment'
  const message = cancelled
    ? 'No payment confirmation was received. You can return to MaintainEX and try again.'
    : 'This is a retired payment session. MaintainEX confirms payment status securely in the app.'

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${title}</title>
  <style>
    body{font-family:system-ui,-apple-system,sans-serif;background:#0d0d0d;color:#fff;display:grid;place-items:center;min-height:100vh;margin:0}
    main{max-width:440px;padding:32px;text-align:center}
    a{display:inline-block;margin-top:18px;background:#f5a623;color:#111;text-decoration:none;font-weight:700;padding:14px 20px;border-radius:12px}
    p{color:#bdbdbd;line-height:1.5}
  </style>
</head>
<body>
  <main>
    <h1>${title}</h1>
    <p>${message}</p>
    <a id="open-app" href="${deepLink}">Open MaintainEX</a>
  </main>
  <script>setTimeout(function(){ window.location.href = ${JSON.stringify(deepLink)}; }, 800);</script>
</body>
</html>`
}

export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get('jobId')?.trim() || ''
  if (!jobId) return new NextResponse('Missing job reference', { status: 400 })
  return new NextResponse(page(jobId, false), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
    },
  })
}
