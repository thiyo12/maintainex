import { NextRequest, NextResponse } from 'next/server'
import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'ddt2rqfe1',
  api_key: process.env.CLOUDINARY_API_KEY || '273983623944158',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'wqzJvZQFYx9z9ogg49rNvRw4IrQ'
})

const rateLimitMap = new Map<string, { count: number; lastReset: number }>()
const RATE_LIMIT = 10
const RATE_WINDOW = 60 * 1000

function cleanupOldEntries() {
  const now = Date.now()
  const entries = Array.from(rateLimitMap.entries())
  for (const [ip, record] of entries) {
    if (now - record.lastReset > RATE_WINDOW * 2) {
      rateLimitMap.delete(ip)
    }
  }
}

if (typeof window === 'undefined') {
  setInterval(cleanupOldEntries, RATE_WINDOW * 2)
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(ip)
  
  if (!record || now - record.lastReset > RATE_WINDOW) {
    rateLimitMap.set(ip, { count: 1, lastReset: now })
    return true
  }
  
  if (record.count >= RATE_LIMIT) {
    return false
  }
  
  record.count++
  return true
}

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
    }

    let formData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
    }

    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 })
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be less than 5MB' }, { status: 400 })
    }

    const fileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    if (fileName.length > 100) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: 'maintainex/cvs', resource_type: 'raw' },
        (error, result) => {
          if (error) reject(error)
          else resolve(result)
        }
      )
      uploadStream.end(buffer)
    }) as any

    return NextResponse.json({ url: result.secure_url })
  } catch {
    return NextResponse.json({ error: 'Failed to upload CV' }, { status: 500 })
  }
}
