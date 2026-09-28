import { getAuthToken } from './token'
import { API_URL } from './client'

// File upload
export const upload = {
  file: async (fileUri: string, kind?: 'avatar' | 'attachment') => {
    const token = await getAuthToken()
    const formData = new FormData()
    const filename = fileUri.split('/').pop() || 'photo.jpg'
    const ext = filename.split('.').pop() || 'jpg'
    formData.append('file', {
      uri: fileUri,
      name: filename,
      type: `image/${ext}`,
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
