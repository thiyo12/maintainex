export function resolvePaymentPublicOrigin(requestUrl: string): string | null {
  const configured = process.env.NEXTAUTH_URL?.trim()
  if (configured) {
    try {
      const url = new URL(configured)
      if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
        return null
      }
      return url.origin
    } catch {
      return null
    }
  }

  if (process.env.NODE_ENV === 'production') {
    return null
  }

  try {
    return new URL(requestUrl).origin
  } catch {
    return null
  }
}
