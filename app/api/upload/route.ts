import { logger } from '@/lib/shared/observability/logger'
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/authentication/auth-utils'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { checkRateLimit } from '@/lib/rate-limit/middleware'

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const MAGIC_BYTES: Record<string, Uint8Array> = {
  'image/jpeg': new Uint8Array([0xFF, 0xD8, 0xFF]),
  'image/png': new Uint8Array([0x89, 0x50, 0x4E, 0x47]),
  'image/gif': new Uint8Array([0x47, 0x49, 0x46]),
  'image/webp': new Uint8Array([0x52, 0x49, 0x46, 0x46]),
}

function detectMimeType(buffer: Uint8Array): string | null {
  for (const [mime, magic] of Object.entries(MAGIC_BYTES)) {
    if (buffer.length >= magic.length && magic.every((b, i) => buffer[i] === b)) {
      return mime
    }
  }
  return null
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rateLimit = await checkRateLimit(request, {
      policyName: 'UPLOAD',
      keyPrefix: 'generic_upload',
      identifier: session.id,
    })
    if (!rateLimit.allowed) return rateLimit.response!

    const formData = await request.formData()
    const file = formData.get('file') as File
    const rawFolder = typeof formData.get('folder') === 'string' ? String(formData.get('folder')) : 'general'
    const folder = rawFolder.replace(/[^a-zA-Z0-9/_-]/g, '').slice(0, 80) || 'general'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'File size exceeds 10MB limit' }, { status: 400 })
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const detectedMime = detectMimeType(new Uint8Array(bytes))
    if (!detectedMime) {
      return NextResponse.json({ error: 'Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.' }, { status: 400 })
    }

    // Industry assets are CRM-controlled public catalog content.
    if (folder === 'industries' && session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Only Super Admin can upload industry assets' }, { status: 403 })
    }

    // For industries, save locally instead of Cloudinary
    if (folder === 'industries') {
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'industries')
      
      // Create directory if it doesn't exist
      if (!existsSync(uploadsDir)) {
        await mkdir(uploadsDir, { recursive: true })
      }

      // Generate unique filename with correct extension
      const timestamp = Date.now()
      const extMap: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }
      const ext = extMap[detectedMime] || 'jpg'
      const filename = `${timestamp}.${ext}`
      const filepath = path.join(uploadsDir, filename)

      // Save file
      await writeFile(filepath, buffer)

      const localUrl = `/uploads/industries/${filename}`
      return NextResponse.json({ 
        url: localUrl,
        success: true 
      })
    }

    // For other folders, upload to Cloudinary
    const { uploadToCloudinary } = await import('@/lib/cloudinary')
    const result = await uploadToCloudinary(buffer, folder, file.name)

    return NextResponse.json({ 
      url: result.url,
      success: true 
    })
  } catch (error) {
    logger.error('Generic authenticated upload failed unexpectedly', { err: error, route: '/api/upload', method: 'POST' })
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
  }
}