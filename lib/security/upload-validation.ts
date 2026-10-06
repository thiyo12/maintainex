import path from 'node:path'

export const IMAGE_UPLOAD_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export type ValidatedUpload = {
  buffer: Buffer
  mime: string
  extension: string
  safeFilename: string
}

function hasPrefix(buffer: Buffer, bytes: number[]): boolean {
  if (buffer.length < bytes.length) return false
  return bytes.every((byte, index) => buffer[index] === byte)
}

export function detectImageMime(buffer: Buffer): string | null {
  if (hasPrefix(buffer, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (hasPrefix(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'
  if (
    buffer.length >= 6 &&
    (buffer.subarray(0, 6).toString('ascii') === 'GIF87a' ||
      buffer.subarray(0, 6).toString('ascii') === 'GIF89a')
  ) {
    return 'image/gif'
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp'
  }
  return null
}

export function sanitizeUploadFilename(filename: string, fallback = 'upload'): string {
  const base = path.basename(filename || fallback)
  const cleaned = base
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .slice(0, 120)
  return cleaned || fallback
}

export function validateUploadFolder(folder: unknown): string | null {
  if (typeof folder !== 'string') return 'general'
  const trimmed = folder.trim().toLowerCase()
  if (!/^[a-z0-9_-]{1,64}$/.test(trimmed)) return null
  return trimmed
}

export async function validateImageUpload(
  file: File,
  maxBytes = 10 * 1024 * 1024,
): Promise<ValidatedUpload> {
  if (!file || typeof file.arrayBuffer !== 'function') {
    throw new Error('UPLOAD_FILE_REQUIRED')
  }
  if (file.size <= 0 || file.size > maxBytes) {
    throw new Error('UPLOAD_SIZE_INVALID')
  }
  if (!IMAGE_UPLOAD_MIMES.has(file.type)) {
    throw new Error('UPLOAD_TYPE_INVALID')
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const detected = detectImageMime(buffer)
  if (!detected || detected !== file.type) {
    throw new Error('UPLOAD_SIGNATURE_INVALID')
  }

  return {
    buffer,
    mime: detected,
    extension: IMAGE_EXTENSIONS[detected],
    safeFilename: sanitizeUploadFilename(file.name),
  }
}

export async function validatePdfUpload(
  file: File,
  maxBytes = 5 * 1024 * 1024,
): Promise<{ buffer: Buffer; safeFilename: string }> {
  if (!file || typeof file.arrayBuffer !== 'function') {
    throw new Error('UPLOAD_FILE_REQUIRED')
  }
  if (file.size <= 0 || file.size > maxBytes) {
    throw new Error('UPLOAD_SIZE_INVALID')
  }
  if (file.type !== 'application/pdf') {
    throw new Error('UPLOAD_TYPE_INVALID')
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  if (buffer.length < 5 || buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw new Error('UPLOAD_SIGNATURE_INVALID')
  }

  return { buffer, safeFilename: sanitizeUploadFilename(file.name, 'document.pdf') }
}
