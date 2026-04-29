const DOMAIN = 'https://maintainex.lk'

export function getImageUrl(url: string | null | undefined): string {
  if (!url) return ''
  
  if (url.startsWith('http')) {
    return url
  }
  
  if (url.startsWith('/uploads/')) {
    return `${DOMAIN}/api/files${url}`
  }
  
  if (url.startsWith('/api/')) {
    return url
  }
  
  if (url.startsWith('/')) {
    return `${DOMAIN}/api/files${url}`
  }

  return `${DOMAIN}/api/files/${url}`
}

export function isCloudinaryUrl(url: string | null | undefined): boolean {
  if (!url) return false
  return url.includes('cloudinary.com') || url.startsWith('https://res.cloudinary.com')
}

export function isUploadedImage(url: string | null | undefined): boolean {
  if (!url) return false
  return url.startsWith('/uploads/') || isCloudinaryUrl(url)
}
