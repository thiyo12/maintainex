import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth-utils'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

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

    // For industries, save locally instead of Cloudinary
    if (folder === 'industries') {
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'industries')
      
      // Create directory if it doesn't exist
      if (!existsSync(uploadsDir)) {
        await mkdir(uploadsDir, { recursive: true })
      }

      // Generate unique filename
      const timestamp = Date.now()
      const ext = file.name.split('.').pop() || 'jpg'
      const filename = `${timestamp}.${ext}`
      const filepath = path.join(uploadsDir, filename)

      // Save file
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      await writeFile(filepath, buffer)

      const localUrl = `/uploads/industries/${filename}`
      return NextResponse.json({ 
        url: localUrl,
        success: true 
      })
    }

    // For other folders, upload to Cloudinary
    const { uploadToCloudinary } = await import('@/lib/cloudinary')
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
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