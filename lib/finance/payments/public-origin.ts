export function resolvePaymentPublicOrigin(requestUrl: string): string | null {
  const configured = process.env.NEXTAUTH_URL?.trim()
  if (configured) {
    try {
      return new URL(configured).origin
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
