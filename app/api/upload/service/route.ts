import { NextRequest, NextResponse } from 'next/server'
import { guardCrmRequest } from '@/lib/crm/security'
import { uploadToCloudinary } from '@/lib/cloudinary'
import { validateFileUpload } from '@/lib/security/file-upload'
import { checkRateLimit } from '@/lib/rate-limit/middleware'

export async function GET() {
  return NextResponse.json({
    message: 'Upload endpoint - use POST to upload images',
    uploadTo: 'Cloudinary'
  })
}

export async function POST(request: NextRequest) {
  try {
    const guard = await guardCrmRequest(request, {
      allowedRoles: ['SUPER_ADMIN'],
      permission: 'catalog:edit',
      level: 'mutation',
    })
    if (!guard.ok) return guard.response

    const rateLimit = await checkRateLimit(request, {
      policyName: 'UPLOAD',
      keyPrefix: 'service_asset_upload',
      identifier: guard.context.adminId,
    })
    if (!rateLimit.allowed) return rateLimit.response!

    const formData = await request.formData()
    const file = formData.get('file') as File | null

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

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const validation = validateFileUpload(buffer, file.type === 'image/jpg' ? 'image/jpeg' : file.type, file.name)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const result = await uploadToCloudinary(buffer, 'services', file.name)

    return NextResponse.json({
      url: result.url,
      fileName: result.publicId
    })
  } catch (error) {
    return NextResponse.json({
      error: 'Failed to upload file',
      details: 'Upload failed'
    }, { status: 500 })
  }
}
