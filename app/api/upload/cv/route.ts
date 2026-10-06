import { NextRequest, NextResponse } from 'next/server'
import { v2 as cloudinary } from 'cloudinary'
import { authenticateMarketplaceUser, assertNotSuspended } from '@/lib/auth/marketplace-auth'
import { validateFileUpload, generateSecureFilename } from '@/lib/security/file-upload'
import { checkRateLimit } from '@/lib/rate-limit/middleware'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateMarketplaceUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const rateLimit = await checkRateLimit(request, {
      policyName: 'UPLOAD',
      keyPrefix: 'cv_upload',
      identifier: user.id,
    })
    if (!rateLimit.allowed) return rateLimit.response!

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

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const validation = validateFileUpload(buffer, file.type, file.name)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }
    const fileName = generateSecureFilename(file.name)

    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'maintainex/cvs',
          resource_type: 'raw',
          public_id: fileName.replace(/\.pdf$/i, ''),
          use_filename: false,
          unique_filename: false,
        },
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
