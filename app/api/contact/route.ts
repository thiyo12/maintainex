import { NextRequest, NextResponse } from 'next/server'

const contactRateLimit = new Map<string, { count: number; lastReset: number }>()
const RATE_LIMIT = 5
const RATE_WINDOW = 60 * 1000

function cleanupOldEntries() {
  const now = Date.now()
  const entries = Array.from(contactRateLimit.entries())
  for (const [ip, record] of entries) {
    if (now - record.lastReset > RATE_WINDOW * 2) {
      contactRateLimit.delete(ip)
    }
  }
}

if (typeof window === 'undefined') {
  setInterval(cleanupOldEntries, RATE_WINDOW * 2)
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const record = contactRateLimit.get(ip)
  
  if (!record || now - record.lastReset > RATE_WINDOW) {
    contactRateLimit.set(ip, { count: 1, lastReset: now })
    return true
  }
  
  if (record.count >= RATE_LIMIT) {
    return false
  }
  
  record.count++
  return true
}

function sanitizeString(str: string): string {
  return str.replace(/<[^>]*>/g, '').trim()
}

function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '')
  return cleaned.length >= 10 && cleaned.length <= 15
}

function isValidName(name: string): boolean {
  const englishOnly = /^[a-zA-Z\s]+$/
  return englishOnly.test(name) && name.length >= 2 && name.length <= 100
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    let { name, phone, email, subject, message } = body

    if (!name || !phone || !email || !subject || !message) {
      return NextResponse.json(
        { error: 'Please fill in all required fields' },
        { status: 400 }
      )
    }

    name = sanitizeString(name)
    phone = sanitizeString(phone)
    email = sanitizeString(email)
    subject = sanitizeString(subject)
    message = sanitizeString(message)

    if (!isValidName(name)) {
      return NextResponse.json(
        { error: 'Please enter a valid name (English letters only, 2-100 characters)' },
        { status: 400 }
      )
    }

    if (!isValidPhone(phone)) {
      return NextResponse.json(
        { error: 'Please enter a valid phone number (10-15 digits)' },
        { status: 400 }
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email) || email.length > 255) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      )
    }

    if (subject.length < 2 || subject.length > 200) {
      return NextResponse.json(
        { error: 'Subject must be between 2 and 200 characters' },
        { status: 400 }
      )
    }

    if (message.length < 10 || message.length > 2000) {
      return NextResponse.json(
        { error: 'Message must be between 10 and 2000 characters' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Thank you for your message! We will get back to you soon.'
    }, { status: 201 })
  } catch {
    return NextResponse.json(
      { error: 'Failed to process your request. Please try again.' },
      { status: 500 }
    )
  }
}
