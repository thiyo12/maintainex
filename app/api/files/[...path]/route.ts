import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const PUBLIC_DIR = path.resolve(process.cwd(), 'public')
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico', '.pdf', '.woff', '.woff2', '.ttf', '.eot'])

function getContentType(ext: string): string {
  const types: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.pdf': 'application/pdf',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
  }
  return types[ext] || 'application/octet-stream'
}

function normalizeAndValidatePath(paramsPath: string[]): string | null {
  const segments = paramsPath.map(s => s.replace(/\.\./g, ''))
  const joined = segments.join('/')
  const resolved = path.resolve(PUBLIC_DIR, joined)

  if (!resolved.startsWith(PUBLIC_DIR)) {
    return null
  }
  return resolved
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: paramsPath } = await params

    if (paramsPath.length === 0) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const filePath = normalizeAndValidatePath(paramsPath)
    if (!filePath) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const ext = path.extname(filePath).toLowerCase()
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const file = await readFile(filePath)
    const contentType = getContentType(ext)

    return new Response(file, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }
}
