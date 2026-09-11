const SENSITIVE_KEYS = new Set([
  'password', 'passwordHash', 'password_hash',
  'token', 'accessToken', 'access_token',
  'refreshToken', 'refresh_token',
  'authorization', 'Authorization',
  'cookie', 'Cookie',
  'secret', 'SECRET',
  'apiKey', 'api_key', 'ApiKey',
  'otp', 'OTP', 'otpCode',
  'privateKey', 'private_key',
  'databaseUrl', 'DATABASE_URL',
  'smtp_password', 'SMTP_APP_PASSWORD',
  'pepper', 'PASSWORD_PEPPER',
  'totpSecret', 'totp_secret',
  'codeHash', 'code_hash',
  'refreshTokenHash', 'refresh_token_hash',
  'jwt', 'JWT',
  'session', 'sessionId',
  'credentials',
])

const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /otp/i,
  /cookie/i,
  /authorization/i,
  /private.?key/i,
  /database.?url/i,
]

function isSensitiveKey(key: string): boolean {
  if (SENSITIVE_KEYS.has(key)) return true
  return SENSITIVE_PATTERNS.some(p => p.test(key))
}

function redactValue(key: string, value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === 'string') {
    if (isSensitiveKey(key)) {
      return '[REDACTED]'
    }
    if (key === 'email') return value
    return value
  }
  return value
}

export function redactObject(obj: unknown, depth = 0): unknown {
  if (depth > 10) return '[Max depth exceeded]'
  if (obj === null || obj === undefined) return obj
  if (typeof obj !== 'object') return obj

  if (Array.isArray(obj)) {
    return obj.map(item => redactObject(item, depth + 1))
  }

  const redacted: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (isSensitiveKey(key)) {
      redacted[key] = redactValue(key, value)
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactObject(value, depth + 1)
    } else {
      redacted[key] = value
    }
  }
  return redacted
}

export function redactString(str: string): string {
  let result = str
  for (const pattern of SENSITIVE_PATTERNS) {
    result = result.replace(/([a-zA-Z_]+)=(["']?)([^"'\s,;]+)(["']?)/gi, (match, key, q1, val, q2) => {
      if (pattern.test(key)) {
        return `${key}=${q1}[REDACTED]${q2}`
      }
      return match
    })
  }
  return result
}
