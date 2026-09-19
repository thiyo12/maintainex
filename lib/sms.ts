/**
 * SMS delivery for mobile OTPs.
 *
 * Production currently supports Twilio through environment variables.
 * Keep provider credentials server-side only.
 */

export interface SmsDeliveryResult {
  delivered: boolean
  provider: 'twilio' | 'test'
  messageId?: string
}

function normalizeE164(phone: string): string {
  const trimmed = phone.trim()
  const digits = trimmed.replace(/\D/g, '')
  if (!digits) throw new Error('Invalid phone number')
  return `+${digits}`
}

export async function sendOtpSms(phone: string, otp: string): Promise<SmsDeliveryResult> {
  const to = normalizeE164(phone)

  // Synthetic certification accounts use a fixed OTP and must not send real SMS.
  if (process.env.ALLOW_TEST_OTP === 'true' && otp === '000000') {
    return { delivered: true, provider: 'test' }
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim()
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim()
  const from = process.env.TWILIO_FROM_NUMBER?.trim()

  if (!accountSid || !authToken || !from) {
    throw new Error('SMS provider is not configured')
  }

  const form = new URLSearchParams()
  form.set('To', to)
  form.set('From', from)
  form.set('Body', `Your MaintainEX verification code is ${otp}. It expires in 5 minutes.`)

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
      cache: 'no-store',
    }
  )

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    console.error('Twilio SMS send failed', response.status, body.slice(0, 500))
    throw new Error('Unable to send SMS verification code')
  }

  const data = await response.json().catch(() => ({}))
  return {
    delivered: true,
    provider: 'twilio',
    messageId: typeof data?.sid === 'string' ? data.sid : undefined,
  }
}
