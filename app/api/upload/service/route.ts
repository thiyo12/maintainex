import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import { getSession } from '@/lib/auth-utils'

export async function POST(request: NextRequest) {
  try {
    console.log('Upload request received')
    const session = await getSession(request)
    console.log('Session:', session ? `User: ${session.email}, Role: ${session.role}` : 'No session')
    
    if (!session) {
      console.log('Unauthorized - no session')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isSuper = session.role === 'SUPER_ADMIN'
    const canEdit = session.canEditServices === true

    if (!isSuper && !canEdit) {
      console.log('Forbidden - no permission')
      return NextResponse.json({ error: 'You do not have permission to upload images' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      console.log('No file provided')
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    console.log('File received:', file.name, file.size, file.type)

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      console.log('Invalid file type:', file.type)
      return NextResponse.json({ error: 'Invalid file type. Please upload jpg, png, or webp images.' }, { status: 400 })
    }

    const maxSize = 20 * 1024 * 1024
    if (file.size > maxSize) {
      console.log('File too large:', file.size)
      return NextResponse.json({ error: 'File size exceeds 20MB limit' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const timestamp = Date.now()
    const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '-')
    const fileName = `service-${timestamp}-${originalName}`

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'services')
    console.log('Upload directory:', uploadDir)
    
    if (!existsSync(uploadDir)) {
      console.log('Creating upload directory...')
      await mkdir(uploadDir, { recursive: true })
    }

    const filePath = path.join(uploadDir, fileName)
    console.log('Writing file to:', filePath)
    await writeFile(filePath, buffer)
    console.log('File written successfully')

    const imageUrl = `/uploads/services/${fileName}`
    console.log('Returning URL:', imageUrl)

    return NextResponse.json({ 
      success: true, 
      url: imageUrl,
      fileName: fileName
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Failed to upload file', details: String(error) }, { status: 500 })
  }
}
