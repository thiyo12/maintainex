if (!process.env.NEXTAUTH_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('NEXTAUTH_SECRET environment variable is required in production')
}
const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'fallback-secret-key-change-in-production'

export function verifySimpleToken(token: string): any {
  try {
    const [encoded, signature] = token.split('.')
    if (!encoded || !signature) return null
    const expectedSig = Buffer.from(JWT_SECRET + encoded).toString('base64').slice(0, 32)
    if (signature !== expectedSig) return null
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
  const signature = Buffer.from(JWT_SECRET + encoded).toString('base64').slice(0, 32)
  return `${encoded}.${signature}`
}

export async function getAdminSession(request: { cookies: { get: (name: string) => { value: string } | undefined } }) {
  const token = request.cookies.get('admin_token')?.value
  if (!token) return null
  const payload = verifySimpleToken(token)
  if (!payload) return null
  return payload
}
