export function getImageUrl(url: string | null | undefined): string {
  if (!url) return ''
  if (url.startsWith('/uploads/')) {
    return `/api/files${url}`
  }
  return url
}
