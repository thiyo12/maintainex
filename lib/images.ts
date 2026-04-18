export function getImageUrl(url: string | null | undefined): string {
  if (!url) return ''
  if (url.startsWith('/uploads/')) {
    return `/api/files${url}`
  }
  if (url.startsWith('/api/')) {
    return url
  }
  if (url.startsWith('http')) {
    return url
  }
  if (url.startsWith('/')) {
    return `/api/files${url}`
  }
  return `/api/files/${url}`
}
