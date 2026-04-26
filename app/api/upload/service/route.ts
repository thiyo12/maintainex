import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth-utils'
import fs from 'fs'
import path from 'path'

export async function GET() {
  return NextResponse.json({ 
    message: 'Upload endpoint - use POST to upload images',
    uploadTo: 'Local file system'
  })
}

export async function POST(request: NextRequest) {
  try {
    console.log('=== Upload API called (Local storage) ===')
    
    const session = await getSession(request)
    console.log('Session result:', session)
    
    if (!session) {
      console.log('=== AUTH FAILED ===')
      return NextResponse.json({ error: 'Unauthorized', reason: 'No valid session' }, { status: 401 })
    }

    const isSuper = session.role === 'SUPER_ADMIN'
    console.log('Permissions - isSuper:', isSuper)

    if (!isSuper) {
      console.log('=== PERMISSION DENIED ===')
      return NextResponse.json({ error: 'Only Super Admin can upload images' }, { status: 403 })
    }

    console.log('Parsing form data...')
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    console.log('File received:', file?.name, file?.size, file?.type)

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Allowed: jpg, png, webp, gif' }, { status: 400 })
    }

    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File size exceeds 10MB limit' }, { status: 400 })
    }

    console.log('Reading file buffer...')
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    console.log('Buffer size:', buffer.length)

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'services')
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }

    const timestamp = Date.now()
    const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const fileName = `service-${timestamp}-${originalName}`
    const filePath = path.join(uploadDir, fileName)

    console.log('Saving to:', filePath)
    fs.writeFileSync(filePath, buffer)
    console.log('File saved successfully')

    const url = `/uploads/services/${fileName}`
    console.log('File URL:', url)
    
    return NextResponse.json({ 
      url: url,
      fileName: fileName
    })
  } catch (error) {
    console.error('!!! Upload error:', error)
    return NextResponse.json({ 
      error: 'Failed to upload file', 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 })
  }
}