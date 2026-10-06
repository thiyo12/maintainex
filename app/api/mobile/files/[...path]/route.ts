import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth/compatibility/mobile-auth'
import { readFile } from 'fs/promises'
import path from 'path'

const ALLOWED_MIMES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
}

const ALLOWED_EXTENSIONS = new Set(Object.keys(ALLOWED_MIMES))

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { path: paramsPath } = await params
    const [userId, ...fileParts] = paramsPath
    const filename = fileParts.join('/')

    if (!userId || !filename) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }

    if (userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const sanitizedFilename = path.basename(filename)
    if (sanitizedFilename !== filename) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
    }

    const ext = path.extname(sanitizedFilename).toLowerCase()
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json({ error: 'File type not allowed' }, { status: 400 })
    }

    const filepath = path.join(process.cwd(), 'uploads', 'mobile', userId, sanitizedFilename)

    const buffer = await readFile(filepath)

    const contentType = ALLOWED_MIMES[ext] || 'application/octet-stream'

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
      },
    })
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
