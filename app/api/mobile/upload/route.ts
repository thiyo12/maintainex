import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, assertNotSuspended } from '@/lib/mobile-auth'
import { writeFile, mkdir } from 'fs/promises'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import path from 'path'
import { validateFileUpload, generateSecureFilename } from '@/lib/security/file-upload'
const ALLOWED_MIMES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf',
])
const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const uploadRateMap = new Map<string, { count: number; resetAt: number }>()

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const blocked = assertNotSuspended(user)
    if (blocked) return blocked

    const uploadIp = request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || user.id
    const now = Date.now()
    const entry = uploadRateMap.get(uploadIp)
    if (entry && now < entry.resetAt && entry.count >= 10) {
      return NextResponse.json({ error: 'Too many uploads. Try again later.' }, { status: 429 })
    }
    if (!entry || now > entry.resetAt) {
      uploadRateMap.set(uploadIp, { count: 1, resetAt: now + 60000 })
    } else {
      entry.count++
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const kind = String(formData.get('kind') || 'mobile').toLowerCase()
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!ALLOWED_MIMES.has(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF, PDF' }, { status: 400 })
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum 10MB.' }, { status: 400 })
    }

    if (kind === 'avatar' && !file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Avatar must be an image' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const validation = validateFileUpload(buffer, file.type, file.name)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const secureFilename = generateSecureFilename(file.name)

    // Avatars must be publicly readable (chat list/detail across users)
    if (kind === 'avatar') {
      const publicAvatarDir = path.join(process.cwd(), 'public', 'uploads', 'avatars')
      await mkdir(publicAvatarDir, { recursive: true })
      const avatarFilename = `${user.id}-${Date.now()}-${secureFilename}`
      const avatarPath = path.join(publicAvatarDir, avatarFilename)
      await writeFile(avatarPath, buffer)
      return NextResponse.json({ url: `/uploads/avatars/${avatarFilename}`, filename: avatarFilename, public: true })
    }

    const uploadDir = path.join(process.cwd(), 'uploads', 'mobile', user.id)
    await mkdir(uploadDir, { recursive: true })

    const filename = secureFilename
    const filepath = path.join(uploadDir, filename)

    await writeFile(filepath, buffer)

    const indexFile = path.join(process.cwd(), 'uploads', 'mobile', '.photo-index.json')
    let index: Record<string, string> = {}
    try { if (existsSync(indexFile)) index = JSON.parse(readFileSync(indexFile, 'utf-8')) } catch {}
    index[filename] = new Date().toISOString()
    try { writeFileSync(indexFile, JSON.stringify(index)) } catch {}

    const url = `/api/mobile/files/${user.id}/${filename}`

    return NextResponse.json({ url, filename })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
