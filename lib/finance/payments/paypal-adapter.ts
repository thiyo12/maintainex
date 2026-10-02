import crypto from 'crypto'

export interface PayPalConfig {
  clientId: string
  clientSecret: string
  webhookId: string | null
  sandbox: boolean
}

export interface PayPalOrderResult {
  ok: boolean
  status: number
  orderId?: string
  orderStatus?: string
  approvalUrl?: string
  body?: Record<string, unknown> | null
  error?: string
}

export interface PayPalCaptureResult {
  ok: boolean
  status: number
  orderId?: string
  orderStatus?: string
  captureId?: string
  captureStatus?: string
  amountValue?: string
  currency?: string
  providerFeeValue?: string
  netSettlementValue?: string
  body?: Record<string, unknown> | null
  error?: string
}

export interface PayPalRefundResult {
  ok: boolean
  status: number
  refundId?: string
  refundStatus?: string
  amountValue?: string
  currency?: string
  body?: Record<string, unknown> | null
  error?: string
}

let accessTokenCache: {
  cacheKey: string
  token: string
  expiresAt: number
} | null = null

export function getPayPalConfig(): PayPalConfig | null {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim()
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim()
  const webhookId = process.env.PAYPAL_WEBHOOK_ID?.trim() || null
  const sandbox = process.env.PAYPAL_SANDBOX !== 'false'

  if (!clientId || !clientSecret) return null
  return { clientId, clientSecret, webhookId, sandbox }
}

function apiBase(sandbox: boolean): string {
  return sandbox
    ? 'https://api-m.sandbox.paypal.com'
    : 'https://api-m.paypal.com'
}

async function readJson(response: Response): Promise<Record<string, unknown> | null> {
  const text = await response.text()
  if (!text) return null
  try {
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null
  } catch {
    return null
  }
}

async function paypalFetch(
  path: string,
  init: RequestInit,
  timeoutMs = 12000
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> | null }> {
  const config = getPayPalConfig()
  if (!config) {
    return { ok: false, status: 503, body: { error: 'PAYPAL_NOT_CONFIGURED' } }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${apiBase(config.sandbox)}${path}`, {
      ...init,
      cache: 'no-store',
      redirect: 'error',
      signal: controller.signal,
    })
    return {
      ok: response.ok,
      status: response.status,
      body: await readJson(response),
    }
  } finally {
    clearTimeout(timeout)
  }
}

export async function getPayPalAccessToken(): Promise<string | null> {
  const config = getPayPalConfig()
  if (!config) return null

  const cacheKey = `${config.sandbox ? 'sandbox' : 'live'}:${config.clientId}`
  if (
    accessTokenCache &&
    accessTokenCache.cacheKey === cacheKey &&
    accessTokenCache.expiresAt > Date.now() + 30_000
  ) {
    return accessTokenCache.token
  }

  const credentials = Buffer.from(
    `${config.clientId}:${config.clientSecret}`,
    'utf8'
  ).toString('base64')

  const response = await paypalFetch('/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: 'grant_type=client_credentials',
  })

  const token =
    typeof response.body?.access_token === 'string'
      ? response.body.access_token
      : null

  if (!response.ok || !token) return null

  const expiresIn =
    typeof response.body?.expires_in === 'number'
      ? response.body.expires_in
      : Number(response.body?.expires_in || 300)

  accessTokenCache = {
    cacheKey,
    token,
    expiresAt: Date.now() + Math.max(60, expiresIn) * 1000,
  }

  return token
}

function compactRequestId(seed: string): string {
  return crypto.createHash('sha256').update(seed).digest('hex').slice(0, 24)
}

export function getPayPalCurrencyExponent(currency: string): number {
  const normalized = currency.trim().toUpperCase()
  if (!/^[A-Z]{3}$/.test(normalized)) throw new Error('Invalid PayPal currency')
  try {
    const exponent = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: normalized,
    }).resolvedOptions().maximumFractionDigits
    if (Number.isInteger(exponent) && exponent >= 0 && exponent <= 3) return exponent
  } catch {
    // The provider/market capability gate remains authoritative. This fallback
    // is only for currencies whose ICU metadata is unavailable at runtime.
  }
  return 2
}

export function formatPayPalAmount(amountMinor: bigint, currency = 'USD'): string {
  if (amountMinor <= 0n) throw new Error('PayPal amount must be positive')
  const exponent = getPayPalCurrencyExponent(currency)
  const divisor = 10n ** BigInt(exponent)
  const whole = amountMinor / divisor
  if (exponent === 0) return whole.toString()
  const fraction = (amountMinor % divisor).toString().padStart(exponent, '0')
  return `${whole.toString()}.${fraction}`
}

export function parsePayPalAmountToMinor(
  value: string,
  currency: string
): bigint | null {
  const raw = value.trim()
  const exponent = getPayPalCurrencyExponent(currency)
  const match = raw.match(/^(\\d+)(?:\\.(\\d+))?$/)
  if (!match) return null

  const fraction = match[2] || ''
  if (fraction.length > exponent) return null
  if (exponent === 0 && fraction) return null

  const divisor = 10n ** BigInt(exponent)
  const padded = fraction.padEnd(exponent, '0')
  const minor = BigInt(match[1]) * divisor + BigInt(padded || '0')
  return minor > 0n ? minor : null
}

function errorMessage(body: Record<string, unknown> | null, fallback: string): string {
  if (!body) return fallback
  if (typeof body.message === 'string') return body.message
  if (typeof body.error_description === 'string') return body.error_description
  if (typeof body.error === 'string') return body.error
  return fallback
}

function links(body: Record<string, unknown> | null): Array<Record<string, unknown>> {
  return Array.isArray(body?.links)
    ? body!.links.filter(
        (value): value is Record<string, unknown> =>
          Boolean(value) && typeof value === 'object' && !Array.isArray(value)
      )
    : []
}

export function findPayPalApprovalUrl(
  body: Record<string, unknown> | null
): string | null {
  const approval = links(body).find(link => {
    const rel = typeof link.rel === 'string' ? link.rel : ''
    return rel === 'approve' || rel === 'payer-action'
  })
  return approval && typeof approval.href === 'string' ? approval.href : null
}

export async function createPayPalOrder(input: {
  paymentIntentId: string
  jobId: string
  description: string
  amountMinor: bigint
  currency: string
  returnUrl: string
  cancelUrl: string
}): Promise<PayPalOrderResult> {
  const token = await getPayPalAccessToken()
  if (!token) {
    return {
      ok: false,
      status: 503,
      error: 'PayPal credentials are not configured or authentication failed',
    }
  }

  const response = await paypalFetch('/v2/checkout/orders', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Prefer: 'return=representation',
      'PayPal-Request-Id': compactRequestId(
        `create:${input.paymentIntentId}`
      ),
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: input.paymentIntentId,
          custom_id: input.jobId,
          description: input.description.slice(0, 127),
          amount: {
            currency_code: input.currency.toUpperCase(),
            value: formatPayPalAmount(input.amountMinor, input.currency),
          },
        },
      ],
      application_context: {
        return_url: input.returnUrl,
        cancel_url: input.cancelUrl,
        user_action: 'PAY_NOW',
        shipping_preference: 'NO_SHIPPING',
      },
    }),
  })

  const orderId =
    typeof response.body?.id === 'string' ? response.body.id : undefined
  const orderStatus =
    typeof response.body?.status === 'string' ? response.body.status : undefined
  const approvalUrl = findPayPalApprovalUrl(response.body) || undefined

  return {
    ok: response.ok && Boolean(orderId) && Boolean(approvalUrl),
    status: response.status,
    orderId,
    orderStatus,
    approvalUrl,
    body: response.body,
    ...(!response.ok || !orderId || !approvalUrl
      ? { error: errorMessage(response.body, 'Unable to create PayPal order') }
      : {}),
  }
}

function firstCapture(
  body: Record<string, unknown> | null
): Record<string, unknown> | null {
  const units = Array.isArray(body?.purchase_units) ? body!.purchase_units : []
  for (const unit of units) {
    if (!unit || typeof unit !== 'object' || Array.isArray(unit)) continue
    const payments = (unit as Record<string, unknown>).payments
    if (!payments || typeof payments !== 'object' || Array.isArray(payments)) continue
    const captures = (payments as Record<string, unknown>).captures
    if (!Array.isArray(captures)) continue
    const capture = captures.find(
      item => Boolean(item) && typeof item === 'object' && !Array.isArray(item)
    )
    if (capture) return capture as Record<string, unknown>
  }
  return null
}

function moneyFromObject(value: unknown): {
  value?: string
  currency?: string
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const record = value as Record<string, unknown>
  return {
    ...(typeof record.value === 'string' ? { value: record.value } : {}),
    ...(typeof record.currency_code === 'string'
      ? { currency: record.currency_code }
      : {}),
  }
}

function amountFromResource(resource: Record<string, unknown> | null): {
  value?: string
  currency?: string
} {
  return resource ? moneyFromObject(resource.amount) : {}
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

export function parsePayPalCaptureResource(
  resource: Record<string, unknown> | null
): {
  captureId?: string
  captureStatus?: string
  orderId?: string
  amountValue?: string
  currency?: string
  providerFeeValue?: string
  netSettlementValue?: string
} {
  if (!resource) return {}
  const amount = amountFromResource(resource)
  const supplementary = objectValue(resource.supplementary_data)
  const relatedIds = objectValue(supplementary?.related_ids)
  const breakdown = objectValue(resource.seller_receivable_breakdown)
  const fee = moneyFromObject(breakdown?.paypal_fee)
  const net = moneyFromObject(breakdown?.net_amount)

  return {
    ...(typeof resource.id === 'string' ? { captureId: resource.id } : {}),
    ...(typeof resource.status === 'string'
      ? { captureStatus: resource.status }
      : {}),
    ...(typeof relatedIds?.order_id === 'string'
      ? { orderId: relatedIds.order_id }
      : {}),
    ...(amount.value ? { amountValue: amount.value } : {}),
    ...(amount.currency ? { currency: amount.currency } : {}),
    ...(fee.value ? { providerFeeValue: fee.value } : {}),
    ...(net.value ? { netSettlementValue: net.value } : {}),
  }
}

export async function capturePayPalOrder(
  orderId: string,
  paymentIntentId: string
): Promise<PayPalCaptureResult> {
  const token = await getPayPalAccessToken()
  if (!token) {
    return {
      ok: false,
      status: 503,
      error: 'PayPal authentication failed',
    }
  }

  const response = await paypalFetch(
    `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Prefer: 'return=representation',
        'PayPal-Request-Id': compactRequestId(
          `capture:${paymentIntentId}:${orderId}`
        ),
      },
      body: '{}',
    }
  )

  const capture = firstCapture(response.body)
  const financials = parsePayPalCaptureResource(capture)
  const captureId = financials.captureId
  const captureStatus = financials.captureStatus

  return {
    ok: response.ok && Boolean(captureId),
    status: response.status,
    orderId:
      typeof response.body?.id === 'string' ? response.body.id : orderId,
    orderStatus:
      typeof response.body?.status === 'string' ? response.body.status : undefined,
    captureId,
    captureStatus,
    amountValue: financials.amountValue,
    currency: financials.currency,
    providerFeeValue: financials.providerFeeValue,
    netSettlementValue: financials.netSettlementValue,
    body: response.body,
    ...(!response.ok || !captureId
      ? { error: errorMessage(response.body, 'Unable to capture PayPal order') }
      : {}),
  }
}

export async function getPayPalOrder(
  orderId: string
): Promise<PayPalCaptureResult> {
  const token = await getPayPalAccessToken()
  if (!token) {
    return { ok: false, status: 503, error: 'PayPal authentication failed' }
  }

  const response = await paypalFetch(
    `/v2/checkout/orders/${encodeURIComponent(orderId)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    }
  )

  const capture = firstCapture(response.body)
  const financials = parsePayPalCaptureResource(capture)

  return {
    ok: response.ok,
    status: response.status,
    orderId:
      typeof response.body?.id === 'string' ? response.body.id : orderId,
    orderStatus:
      typeof response.body?.status === 'string' ? response.body.status : undefined,
    captureId: financials.captureId,
    captureStatus: financials.captureStatus,
    amountValue: financials.amountValue,
    currency: financials.currency,
    providerFeeValue: financials.providerFeeValue,
    netSettlementValue: financials.netSettlementValue,
    body: response.body,
    ...(!response.ok
      ? { error: errorMessage(response.body, 'Unable to retrieve PayPal order') }
      : {}),
  }
}

export async function refundPayPalCapture(
  captureId: string,
  paymentIntentId: string,
  options?: {
    amountMinor?: bigint
    currency?: string
    refundRequestKey?: string
  }
): Promise<PayPalRefundResult> {
  const token = await getPayPalAccessToken()
  if (!token) {
    return { ok: false, status: 503, error: 'PayPal authentication failed' }
  }

  const response = await paypalFetch(
    `/v2/payments/captures/${encodeURIComponent(captureId)}/refund`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Prefer: 'return=representation',
        'PayPal-Request-Id': compactRequestId(
          `refund:${paymentIntentId}:${captureId}:${options?.refundRequestKey || 'full'}`
        ),
      },
      body: options?.amountMinor && options.currency
        ? JSON.stringify({
            amount: {
              currency_code: options.currency.toUpperCase(),
              value: formatPayPalAmount(options.amountMinor, options.currency),
            },
          })
        : '{}',
    }
  )

  const amount = amountFromResource(response.body)
  return {
    ok: response.ok,
    status: response.status,
    refundId:
      typeof response.body?.id === 'string' ? response.body.id : undefined,
    refundStatus:
      typeof response.body?.status === 'string' ? response.body.status : undefined,
    amountValue: amount.value,
    currency: amount.currency,
    body: response.body,
    ...(!response.ok
      ? { error: errorMessage(response.body, 'Unable to refund PayPal capture') }
      : {}),
  }
}

export async function getPayPalRefund(
  refundId: string
): Promise<PayPalRefundResult> {
  const token = await getPayPalAccessToken()
  if (!token) {
    return { ok: false, status: 503, error: 'PayPal authentication failed' }
  }

  const response = await paypalFetch(
    `/v2/payments/refunds/${encodeURIComponent(refundId)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    }
  )

  const amount = amountFromResource(response.body)
  return {
    ok: response.ok,
    status: response.status,
    refundId:
      typeof response.body?.id === 'string' ? response.body.id : refundId,
    refundStatus:
      typeof response.body?.status === 'string' ? response.body.status : undefined,
    amountValue: amount.value,
    currency: amount.currency,
    body: response.body,
    ...(!response.ok
      ? { error: errorMessage(response.body, 'Unable to retrieve PayPal refund') }
      : {}),
  }
}

export async function verifyPayPalWebhook(
  headers: Headers,
  webhookEvent: Record<string, unknown>
): Promise<boolean> {
  const config = getPayPalConfig()
  if (!config?.webhookId) return false

  const token = await getPayPalAccessToken()
  if (!token) return false

  const transmissionId = headers.get('paypal-transmission-id')
  const transmissionTime = headers.get('paypal-transmission-time')
  const certUrl = headers.get('paypal-cert-url')
  const authAlgo = headers.get('paypal-auth-algo')
  const transmissionSig = headers.get('paypal-transmission-sig')

  if (
    !transmissionId ||
    !transmissionTime ||
    !certUrl ||
    !authAlgo ||
    !transmissionSig
  ) {
    return false
  }

  const response = await paypalFetch(
    '/v1/notifications/verify-webhook-signature',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        transmission_id: transmissionId,
        transmission_time: transmissionTime,
        cert_url: certUrl,
        auth_algo: authAlgo,
        transmission_sig: transmissionSig,
        webhook_id: config.webhookId,
        webhook_event: webhookEvent,
      }),
    }
  )

  return (
    response.ok &&
    response.body?.verification_status === 'SUCCESS'
  )
}

export function resetPayPalAccessTokenCacheForTests() {
  accessTokenCache = null
}
