import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth-utils'
import cloudinary from '@/lib/cloudinary'
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
    console.log('=== Upload API called ===')
    console.log('Headers:', Object.fromEntries(request.headers.entries()))
    
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

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Please upload jpg, png, or webp images.' }, { status: 400 })
    }

    const maxSize = 20 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File size exceeds 20MB limit' }, { status: 400 })
    }

    console.log('Reading file buffer...')
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    console.log('Buffer size:', buffer.length)

    const fileExt = path.extname(file.name).toLowerCase() || '.jpg'
    
    console.log('Uploading to Cloudinary...')
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { 
          folder: 'maintainex/services',
          resource_type: 'auto',
          transformation: [
            { width: 1200, height: 800, crop: 'limit' },
            { quality: 'auto:good' },
            { fetch_format: 'auto' }
          ]
        },
        (error, result) => {
          if (error) reject(error)
          else resolve(result)
        }
      )
      uploadStream.end(buffer)
    }) as any
    
    console.log('Cloudinary upload successful:', result.secure_url)
    
    return NextResponse.json({ 
      success: true, 
      url: result.secure_url,
      publicId: result.public_id,
      savedPath: result.secure_url
    })
  } catch (error) {
    console.error('=== UPLOAD ERROR ===')
    console.error(error)
    return NextResponse.json({ error: 'Failed to upload file', details: String(error), stack: error instanceof Error ? error.stack : '' }, { status: 500 })
  }
}
