import { getAuthToken } from './token'
import { API_URL } from './client'

// File upload
// Map iOS/HEIC and other non-standard image extensions to supported MIME types
const MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/jpeg',
  heif: 'image/jpeg',
  pdf: 'application/pdf',
}

export const upload = {
  file: async (fileUri: string, kind?: 'avatar' | 'attachment') => {
    const token = await getAuthToken()
    const formData = new FormData()
    const rawFilename = fileUri.split('/').pop() || 'photo.jpg'
    const ext = (rawFilename.split('.').pop() || 'jpg').toLowerCase()
    const mimeType = MIME_MAP[ext] || `image/${ext}`
    const filename = ext === 'heic' || ext === 'heif'
      ? rawFilename.replace(/\.[^.]+$/, '.jpg')
      : rawFilename
    formData.append('file', {
      uri: fileUri,
      name: filename,
      type: mimeType,
    } as any)
    if (kind) formData.append('kind', kind)
    const res = await fetch(`${API_URL}/api/mobile/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    })
    if (!res.ok) throw new Error('Upload failed')
    return res.json() as Promise<{ url: string; filename: string }>
  },
}
