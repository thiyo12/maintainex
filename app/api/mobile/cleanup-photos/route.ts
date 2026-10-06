import { secureConsole } from '@/lib/shared/observability/secure-console'
import { NextResponse } from 'next/server'
import { unlinkSync, readdirSync, statSync, existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { matchesBearerSecret } from '@/lib/security/secret-compare'

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'mobile')
const MAX_AGE_MS = 4 * 24 * 60 * 60 * 1000
const INDEX_FILE = join(UPLOAD_DIR, '.photo-index.json')

function loadIndex(): Record<string, string> {
  try {
    if (existsSync(INDEX_FILE)) return JSON.parse(readFileSync(INDEX_FILE, 'utf-8'))
  } catch {}
  return {}
}

function saveIndex(idx: Record<string, string>) {
  try { writeFileSync(INDEX_FILE, JSON.stringify(idx, null, 2)) } catch {}
}

export async function POST(request: Request) {
  if (!process.env.CRON_SECRET) throw new Error('[SECURITY] CRON_SECRET env var is required')
  const authHeader = request.headers.get('authorization')
  if (!matchesBearerSecret(authHeader, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    if (!existsSync(UPLOAD_DIR)) return NextResponse.json({ deleted: 0 })
    const now = Date.now()
    let deleted = 0
    const index = loadIndex()

    const userIdDirs = readdirSync(UPLOAD_DIR)
    for (const userId of userIdDirs) {
      if (userId.startsWith('.')) continue
      const userDir = join(UPLOAD_DIR, userId)
      if (!statSync(userDir).isDirectory()) continue

      const files = readdirSync(userDir)
      for (const file of files) {
        if (file.startsWith('.')) continue
        const filePath = join(userDir, file)
        let age = now - statSync(filePath).mtimeMs
        const createdAt = index[file]
        if (createdAt) age = now - new Date(createdAt).getTime()
        if (age > MAX_AGE_MS) {
          try { unlinkSync(filePath); deleted++ } catch {}
        }
      }
    }
    return NextResponse.json({ deleted })
  } catch (error) {
    secureConsole.error('Photo cleanup error:', error)
    return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 })
  }
}
