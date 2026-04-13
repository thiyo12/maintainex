import { NextRequest } from 'next/server'

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'fallback-secret-key-change-in-production'

function verifySimpleToken(token: string): any {
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

export async function getSession(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value
  
  if (!token) {
    console.log('getSession: No token found in cookies')
    return null
  }
  
  const payload = verifySimpleToken(token)
  if (!payload) {
    console.log('getSession: Token verification failed')
    return null
  }
  
  console.log('getSession: Token valid for', payload.email)
  return payload
}
