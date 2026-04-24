import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth-utils'
import fs from 'fs'
import path from 'path'

export async function GET() {
  return NextResponse.json({ 
    message: 'Upload endpoint - use POST to upload images',
    uploadTo: 'Local VPS Storage'
  })
}

export async function POST(request: NextRequest) {
  try {
    console.log('=== Upload API called (Local Storage) ===')
    
    const session = await getSession(request)
    console.log('Session result:', session)
    
    if (!session) {
      console.log('=== AUTH FAILED ===')
      return NextResponse.json({ error: 'Unauthorized', reason: 'No valid session' }, { status: 401 })
    }

    const isSuper = session.role === 'SUPER_ADMIN'
    const canEdit = session.canEditServices === true
    console.log('Permissions - isSuper:', isSuper, 'canEdit:', canEdit)

    if (!isSuper && !canEdit) {
      console.log('=== PERMISSION DENIED ===')
      return NextResponse.json({ error: 'You do not have permission to upload images', isSuper, canEdit }, { status: 403 })
    }

    console.log('Parsing form data...')
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    console.log('File received:', file?.name, file?.size, file?.type)

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Allowed: jpg, png, webp, gif, pdf' }, { status: 400 })
    }

    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File size exceeds 5MB limit' }, { status: 400 })
    }

    console.log('Reading file buffer...')
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    console.log('Buffer size:', buffer.length)

    const timestamp = Date.now()
    const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const fileName = `${timestamp}-${originalName}`
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'services')
    
    console.log('Upload directory:', uploadDir)

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
      console.log('Created upload directory')
    }

    const filePath = path.join(uploadDir, fileName)
    fs.writeFileSync(filePath, buffer)
    console.log('File saved to:', filePath)

    const savedPath = `/uploads/services/${fileName}`
    
    return NextResponse.json({ 
      success: true, 
      url: savedPath,
      fileName: fileName,
      savedPath: savedPath
    })
  } catch (error) {
    console.error('=== UPLOAD ERROR ===')
    console.error(error)
    return NextResponse.json({ error: 'Failed to upload file', details: String(error), stack: error instanceof Error ? error.stack : '' }, { status: 500 })
  }
}