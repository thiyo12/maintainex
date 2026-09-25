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
  const secretHash = crypto.createHash('md5').update(merchantSecret).digest('hex')
  const hashString = `${merchantId}${orderId}${amount}${currency}${secretHash}`
  return crypto.createHash('md5').update(hashString).digest('hex')
}

export function verifyNotificationSignature(
  notification: PayHereNotification,
  merchantSecret: string
): boolean {
  const secretHash = crypto.createHash('md5').update(merchantSecret).digest('hex')
  const hashString = `${notification.merchant_id}${notification.order_id}${notification.payhere_amount}${notification.payhere_currency}${notification.status_code}${secretHash}`
  const expectedHash = crypto.createHash('md5').update(hashString).digest('hex')
  return notification.md5sig === expectedHash
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
  const cleaned = amountStr.replace(/[^0-9.]/g, '')
  const num = parseFloat(cleaned)
  if (isNaN(num) || num <= 0) return null
  return BigInt(Math.round(num * 100))
}

export function formatPayHereAmount(amountCents: bigint): string {
  return (Number(amountCents) / 100).toFixed(2)
}
