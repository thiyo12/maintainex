import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir, readdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { getSession } from '@/lib/auth-utils'
import { randomBytes } from 'crypto'

export async function GET(request: NextRequest) {
  try {
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'services')
    
    if (!existsSync(uploadDir)) {
      return NextResponse.json({ 
        exists: false, 
        message: 'Upload directory does not exist',
        uploadDir 
      })
    }
    
    const files = await readdir(uploadDir)
    return NextResponse.json({ 
      exists: true, 
      fileCount: files.length,
      files: files.slice(0, 10),
      uploadDir
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('Upload API called')
    console.log('Headers:', Object.fromEntries(request.headers.entries()))
    
    const session = await getSession(request)
    console.log('Session:', session)
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized', debug: 'No session found' }, { status: 401 })
    }

    const isSuper = session.role === 'SUPER_ADMIN'
    const canEdit = session.canEditServices === true
    console.log('Permissions - isSuper:', isSuper, 'canEdit:', canEdit)

    if (!isSuper && !canEdit) {
      return NextResponse.json({ error: 'You do not have permission to upload images' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Please upload jpg, png, or webp images.' }, { status: 400 })
    }

    const maxSize = 20 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File size exceeds 20MB limit' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const timestamp = Date.now()
    const uniqueId = randomBytes(8).toString('hex')
    const fileExt = path.extname(file.name).toLowerCase() || '.jpg'
    const baseName = path.basename(file.name, fileExt).replace(/[^a-zA-Z0-9]/g, '-').substring(0, 30)
    const fileName = `${timestamp}-${uniqueId}-${baseName}${fileExt}`

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'services')
    
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    const filePath = path.join(uploadDir, fileName)
    await writeFile(filePath, buffer)

    const imageUrl = `/uploads/services/${fileName}`

    return NextResponse.json({ 
      success: true, 
      url: imageUrl,
      fileName: fileName,
      savedPath: filePath
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Failed to upload file', details: String(error) }, { status: 500 })
  }
}
