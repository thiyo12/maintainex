import path from 'node:path'

const KYC_MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
}

export interface LocalKycFileReference {
  userId: string
  filename: string
  filePath: string
  contentType: string
}

function safeSegment(value: string, maxLength: number): boolean {
  return (
    value.length > 0 &&
    value.length <= maxLength &&
    /^[A-Za-z0-9._-]+$/.test(value) &&
    value !== '.' &&
    value !== '..'
  )
}

/**
 * Resolve a KYC evidence reference only when it points at the authenticated
 * user's private mobile-file namespace on this MaintainEX origin.
 *
 * The returned filesystem path is constructed server-side; the client never
 * supplies an arbitrary disk path.
 */
export function resolveLocalKycFileReference(
  rawUrl: string,
  expectedUserId: string,
  requestOrigin: string,
): LocalKycFileReference | null {
  try {
    if (!safeSegment(expectedUserId, 191)) return null

    const origin = new URL(requestOrigin)
    const url = new URL(rawUrl, origin)

    if (url.origin !== origin.origin) return null
    if (url.search || url.hash) return null

    const prefix = '/api/mobile/files/'
    if (!url.pathname.startsWith(prefix)) return null

    const remainder = url.pathname.slice(prefix.length)
    const segments = remainder.split('/').filter(Boolean)
    if (segments.length !== 2) return null

    const [encodedUserId, encodedFilename] = segments
    const userId = decodeURIComponent(encodedUserId)
    const filename = decodeURIComponent(encodedFilename)

    if (userId !== expectedUserId) return null
    if (!safeSegment(userId, 191) || !safeSegment(filename, 255)) return null
    if (path.basename(filename) !== filename) return null

    const ext = path.extname(filename).toLowerCase()
    const contentType = KYC_MIME_BY_EXT[ext]
    if (!contentType) return null

    const root = path.resolve(process.cwd(), 'uploads', 'mobile', userId)
    const filePath = path.resolve(root, filename)
    if (!filePath.startsWith(root + path.sep)) return null

    return { userId, filename, filePath, contentType }
  } catch {
    return null
  }
}

export function kycContentTypeForFilename(filename: string): string | null {
  return KYC_MIME_BY_EXT[path.extname(filename).toLowerCase()] || null
}
