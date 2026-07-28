import crypto from 'crypto'

const JWT_SECRET: string = process.env.NEXTAUTH_SECRET!
if (!JWT_SECRET) {
  throw new Error('NEXTAUTH_SECRET environment variable is required')
}

function hmacSign(data: string): string {
  return crypto.createHmac('sha256', JWT_SECRET).update(data).digest('hex')
}

export function verifySimpleToken(token: string): any {
  try {
    const [encoded, signature] = token.split('.')
    if (!encoded || !signature) return null
    const expectedSig = hmacSign(encoded)
    if (!crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSig, 'hex'))) return null
    const payload = JSON.parse(Buffer.from(encoded, 'base64').toString())
    const maxAge = 30 * 24 * 60 * 60 * 1000
    if (Date.now() - payload.created > maxAge) return null
    return payload
  } catch {
    return null
  }
}

export function createSimpleToken(data: any): string {
  const payload = { ...data, created: Date.now() }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64')
  const signature = hmacSign(encoded)
  return `${encoded}.${signature}`
}

export async function getAdminSession(request: { cookies: { get: (name: string) => { value: string } | undefined } }) {
  const token = request.cookies.get('admin_token')?.value
  if (!token) return null
  const payload = verifySimpleToken(token)
  if (!payload) return null
  return payload
}
