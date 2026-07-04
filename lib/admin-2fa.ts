import { NobleCryptoPlugin, ScureBase32Plugin, TOTP, generateSecret, generateURI } from 'otplib'

const crypto = new NobleCryptoPlugin()
const base32 = new ScureBase32Plugin()
const plugins = { crypto, base32 }

const APP_NAME = 'Maintainex Admin'

export function generateTotpSecret(): string {
  return generateSecret(plugins)
}

export function generateTotpUri(secret: string, email: string): string {
  return generateURI({ issuer: APP_NAME, label: email, secret, ...plugins })
}

export async function verifyTotp(token: string, secret: string): Promise<boolean> {
  try {
    const totp = new TOTP({ ...plugins, secret })
    const result = await totp.verify(token)
    return result.valid === true
  } catch {
    return false
  }
}
