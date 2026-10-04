import { mkdir, readFile, writeFile } from 'fs/promises'
import path from 'node:path'
import { generateSecureFilename, validateFileUpload } from '@/lib/security/file-upload'
import { resolveLocalKycFileReference } from '@/lib/security/kyc-storage'

export async function promoteVerifiedPublicPhoto(input: {
  privatePhotoUrl: string
  userId: string
  requestOrigin: string
}): Promise<{ publicUrl: string; filename: string }> {
  const reference = resolveLocalKycFileReference(
    input.privatePhotoUrl,
    input.userId,
    input.requestOrigin,
  )
  if (!reference || !reference.contentType.startsWith('image/')) {
    throw new Error('VERIFIED_PHOTO_PRIVATE_REFERENCE_INVALID')
  }

  const buffer = await readFile(reference.filePath)
  const validation = validateFileUpload(
    buffer,
    reference.contentType,
    reference.filename,
  )
  if (!validation.valid) {
    throw new Error('VERIFIED_PHOTO_CONTENT_INVALID')
  }

  const publicDir = path.join(process.cwd(), 'public', 'uploads', 'avatars')
  await mkdir(publicDir, { recursive: true })

  const secure = generateSecureFilename(reference.filename)
  const filename = `verified-${input.userId}-${secure}`
  const destination = path.join(publicDir, filename)
  await writeFile(destination, buffer, { mode: 0o644 })

  return {
    publicUrl: `/uploads/avatars/${filename}`,
    filename,
  }
}
