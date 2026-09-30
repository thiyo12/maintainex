import crypto from 'crypto'

export interface PayHereConfig {
  merchantId: string
  merchantSecret: string
  sandbox: boolean
}

export interface PayHereCheckoutParams {
  merchantId: string
  orderId: string
  amount: string
  currency: string
  firstName: string
  lastName: string
  email?: string
  phone?: string
  address?: string
  city?: string
  country?: string
  returnUrl: string
  cancelUrl: string
  notifyUrl: string
  items?: string
}

export interface PayHereNotification {
  merchant_id: string
  order_id: string
  payhere_amount: string
  payhere_currency: string
  status_code: string
  md5sig: string
  payment_id?: string
  status_message?: string
  custom_1?: string
  custom_2?: string
}

export function getPayHereConfig(): PayHereConfig | null {
  const merchantId = process.env.PAYHERE_MERCHANT_ID
  const merchantSecret = process.env.PAYHERE_MERCHANT_SECRET
  const sandbox = process.env.PAYHERE_SANDBOX !== 'false'

  if (!merchantId || !merchantSecret) return null

  return { merchantId, merchantSecret, sandbox }
}

export function generateCheckoutHash(
  merchantId: string,
  orderId: string,
  amount: string,
  currency: string,
  merchantSecret: string
): string {
  const secretHash = crypto.createHash('md5').update(merchantSecret).digest('hex').toUpperCase()
  const hashString = `${merchantId}${orderId}${amount}${currency}${secretHash}`
  return crypto.createHash('md5').update(hashString).digest('hex').toUpperCase()
}

export function verifyNotificationSignature(
  notification: PayHereNotification,
  merchantSecret: string
): boolean {
  const secretHash = crypto.createHash('md5').update(merchantSecret).digest('hex').toUpperCase()
  const hashString = `${notification.merchant_id}${notification.order_id}${notification.payhere_amount}${notification.payhere_currency}${notification.status_code}${secretHash}`
  const expectedHash = crypto.createHash('md5').update(hashString).digest('hex').toUpperCase()
  return notification.md5sig.toUpperCase() === expectedHash
}

export function getPayHereCheckoutUrl(sandbox: boolean): string {
  return sandbox
    ? 'https://sandbox.payhere.lk/pay/checkout'
    : 'https://www.payhere.lk/pay/checkout'
}

export function getPayHereReturnUrl(baseUrl: string, jobId: string): string {
  return `${new URL(baseUrl).origin}/api/payments/payhere/return?jobId=${encodeURIComponent(jobId)}`
}

export function getPayHereCancelUrl(baseUrl: string, jobId: string): string {
  return `${new URL(baseUrl).origin}/api/payments/payhere/cancel?jobId=${encodeURIComponent(jobId)}`
}

export function getPayHereNotifyUrl(baseUrl: string): string {
  return `${new URL(baseUrl).origin}/api/webhooks/payhere`
}

export function generateMerchantOrderId(jobId: string): string {
  const shortId = jobId.slice(-8)
  const timestamp = Date.now().toString(36)
  return `MX-${shortId}-${timestamp}`
}

export function parsePayHereAmount(amountStr: string): bigint | null {
  const raw = amountStr.trim()
  const match = raw.match(/^(\d+)(?:\.(\d{1,2}))?$/)
  if (!match) return null

  const whole = BigInt(match[1])
  const fraction = (match[2] || '').padEnd(2, '0')
  const minor = whole * 100n + BigInt(fraction || '0')
  return minor > 0n ? minor : null
}

export function formatPayHereAmount(amountCents: bigint): string {
  if (amountCents < 0n) throw new Error('PayHere amount cannot be negative')
  const whole = amountCents / 100n
  const fraction = (amountCents % 100n).toString().padStart(2, '0')
  return `${whole.toString()}.${fraction}`
}


export interface PayHereMerchantApiConfig {
  appId: string
  appSecret: string
  sandbox: boolean
}

export interface PayHereRefundResult {
  status: number
  message: string
  refundReference: string | null
}

export interface PayHereRetrievedPayment {
  payment_id: string | number
  order_id: string
  status: string
  currency?: string
  amount?: number
  payment_method?: {
    method?: string
    card_customer_name?: string
    card_no?: string
  }
}

export interface PayHereRetrievalResult {
  status: number
  message: string
  payments: PayHereRetrievedPayment[]
}

let merchantTokenCache: {
  cacheKey: string
  token: string
  expiresAt: number
} | null = null

export function getPayHereMerchantApiConfig(): PayHereMerchantApiConfig | null {
  const appId = process.env.PAYHERE_APP_ID?.trim()
  const appSecret = process.env.PAYHERE_APP_SECRET?.trim()
  const sandbox = process.env.PAYHERE_SANDBOX !== 'false'

  if (!appId || !appSecret) return null
  return { appId, appSecret, sandbox }
}

function merchantBaseUrl(sandbox: boolean): string {
  return sandbox ? 'https://sandbox.payhere.lk' : 'https://www.payhere.lk'
}

async function merchantFetchJson<T>(
  url: string,
  init: RequestInit,
  timeoutMs = 10000
): Promise<{ ok: boolean; status: number; body: T | null }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...init,
      redirect: 'error',
      cache: 'no-store',
      signal: controller.signal,
    })
    const text = await response.text()
    let body: T | null = null
    if (text) {
      try {
        body = JSON.parse(text) as T
      } catch {
        body = null
      }
    }
    return { ok: response.ok, status: response.status, body }
  } finally {
    clearTimeout(timeout)
  }
}

export async function getPayHereMerchantAccessToken(): Promise<string | null> {
  const config = getPayHereMerchantApiConfig()
  if (!config) return null

  const cacheKey = `${config.sandbox ? 'sandbox' : 'live'}:${config.appId}`
  if (
    merchantTokenCache &&
    merchantTokenCache.cacheKey === cacheKey &&
    merchantTokenCache.expiresAt > Date.now() + 15000
  ) {
    return merchantTokenCache.token
  }

  const credentials = Buffer.from(`${config.appId}:${config.appSecret}`, 'utf8').toString('base64')
  const result = await merchantFetchJson<{
    access_token?: string
    expires_in?: number
    error?: string
    error_description?: string
  }>(
    `${merchantBaseUrl(config.sandbox)}/merchant/v1/oauth/token`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: 'grant_type=client_credentials',
    }
  )

  const token = result.body?.access_token
  if (!result.ok || !token) return null

  const expiresIn = Number(result.body?.expires_in || 599)
  merchantTokenCache = {
    cacheKey,
    token,
    expiresAt: Date.now() + Math.max(30, expiresIn) * 1000,
  }
  return token
}

export async function requestPayHereRefund(
  paymentId: string,
  description: string
): Promise<PayHereRefundResult> {
  const config = getPayHereMerchantApiConfig()
  if (!config) {
    return {
      status: -2,
      message: 'PayHere Merchant API credentials are not configured',
      refundReference: null,
    }
  }

  const token = await getPayHereMerchantAccessToken()
  if (!token) {
    return {
      status: -2,
      message: 'Unable to authenticate with PayHere Merchant API',
      refundReference: null,
    }
  }

  const result = await merchantFetchJson<{
    status?: number
    msg?: string
    data?: string | number | null
    error?: string
    error_description?: string
  }>(
    `${merchantBaseUrl(config.sandbox)}/merchant/v1/payment/refund`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        payment_id: paymentId,
        description: description.slice(0, 500),
      }),
    }
  )

  const status = Number(result.body?.status ?? (result.ok ? 0 : -2))
  return {
    status,
    message:
      result.body?.msg ||
      result.body?.error_description ||
      result.body?.error ||
      `PayHere refund request failed with HTTP ${result.status}`,
    refundReference:
      result.body?.data === null || result.body?.data === undefined
        ? null
        : String(result.body.data),
  }
}

export async function retrievePayHerePayment(
  orderId: string
): Promise<PayHereRetrievalResult> {
  const config = getPayHereMerchantApiConfig()
  if (!config) {
    return {
      status: -2,
      message: 'PayHere Merchant API credentials are not configured',
      payments: [],
    }
  }

  const token = await getPayHereMerchantAccessToken()
  if (!token) {
    return {
      status: -2,
      message: 'Unable to authenticate with PayHere Merchant API',
      payments: [],
    }
  }

  const url = new URL(`${merchantBaseUrl(config.sandbox)}/merchant/v1/payment/search`)
  url.searchParams.set('order_id', orderId)

  const result = await merchantFetchJson<{
    status?: number
    msg?: string
    data?: PayHereRetrievedPayment[] | null
    error?: string
    error_description?: string
  }>(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  })

  return {
    status: Number(result.body?.status ?? (result.ok ? 0 : -2)),
    message:
      result.body?.msg ||
      result.body?.error_description ||
      result.body?.error ||
      `PayHere retrieval request failed with HTTP ${result.status}`,
    payments: Array.isArray(result.body?.data) ? result.body!.data! : [],
  }
}

export function resetPayHereMerchantTokenCacheForTests() {
  merchantTokenCache = null
}
