import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'fallback-secret-key'

async function createToken(payload: any): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(JSON.stringify(payload))
  const key = encoder.encode(JWT_SECRET)
  
  const hashBuffer = await crypto.subtle.digest('SHA-256', key)
  const signature = Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = btoa(JSON.stringify(payload))
  
  return `${header}.${body}.${signature}`
}

async function verifyToken(token: string): Promise<any> {
  try {
    const [header, body, signature] = token.split('.')
    const encoder = new TextEncoder()
    const key = encoder.encode(JWT_SECRET)
    
    const hashBuffer = await crypto.subtle.digest('SHA-256', key)
    const expectedSignature = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    
    if (signature !== expectedSignature) {
      return null
    }
    
    const payload = JSON.parse(atob(body))
    
    if (payload.exp && Date.now() > payload.exp) {
      return null
    }
    
    return payload
  } catch {
    return null
  }
}

export async function getSession(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value
  
  if (!token) {
    return null
  }
  
  const payload = await verifyToken(token)
  
  if (!payload) {
    return null
  }
  
  return payload
}

export async function logout(request: NextRequest) {
  const response = NextResponse.json({ success: true })
  response.cookies.delete('admin_token')
  return response
}

export { createToken, verifyToken }
