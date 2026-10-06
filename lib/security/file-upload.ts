import crypto from 'crypto'

const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf'
]

const ALLOWED_EXTENSIONS: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
  'application/pdf': ['.pdf']
}

const MAGIC_BYTES: Record<string, number[][]> = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47]],
  'image/gif': [[0x47, 0x49, 0x46, 0x38]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]],
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]]
}

export function validateFileUpload(
  buffer: Buffer,
  declaredMimeType: string,
  filename: string
): { valid: boolean; error?: string } {
  if (!ALLOWED_MIME_TYPES.includes(declaredMimeType)) {
    return { valid: false, error: `File type ${declaredMimeType} is not allowed` }
  }

  const ext = filename.toLowerCase().match(/\.[a-z]+$/)?.[0]
  if (!ext || !ALLOWED_EXTENSIONS[declaredMimeType]?.includes(ext)) {
    return { valid: false, error: 'File extension does not match content type' }
  }

  const expectedMagic = MAGIC_BYTES[declaredMimeType]
  if (expectedMagic) {
    const fileStart = buffer.slice(0, 16)
    const matches = expectedMagic.some(magic =>
      magic.every((byte, i) => fileStart[i] === byte)
    )
    if (!matches) {
      return { valid: false, error: 'File content does not match declared type' }
    }
  }

  if (
    declaredMimeType === 'image/webp' &&
    (buffer.length < 12 || buffer.slice(8, 12).toString('ascii') !== 'WEBP')
  ) {
    return { valid: false, error: 'File content does not match declared type' }
  }

  if (buffer.length > 10 * 1024 * 1024) {
    return { valid: false, error: 'File size exceeds 10MB limit' }
  }

  return { valid: true }
}

export function generateSecureFilename(originalFilename: string): string {
  const ext = originalFilename.toLowerCase().match(/\.[a-z]+$/)?.[0] || '.bin'
  const random = crypto.randomBytes(16).toString('hex')
  return `${Date.now()}-${random}${ext}`
}
