import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth-utils'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
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

    const formData = await request.formData()
    const file = formData.get('file') as File
    const folder = formData.get('folder') as string || 'general'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const detectedMime = detectMimeType(new Uint8Array(bytes))
    if (!detectedMime) {
      return NextResponse.json({ error: 'Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.' }, { status: 400 })
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
    console.error('Error uploading file:', error)
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
  }
}