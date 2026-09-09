export type AuthErrorCode =
  | 'AUTH_REQUIRED'
  | 'INVALID_CREDENTIALS'
  | 'INVALID_TOKEN'
  | 'INVALID_TOKEN_PURPOSE'
  | 'SESSION_EXPIRED'
  | 'SESSION_REVOKED'
  | 'SESSION_INVALIDATED'
  | 'TOKEN_REPLAY'
  | 'ACCOUNT_DISABLED'
  | 'ACCOUNT_SUSPENDED'
  | 'ACCOUNT_BANNED'
  | 'FORBIDDEN'
  | 'MEMBERSHIP_REQUIRED'
  | 'CAPABILITY_REQUIRED'
  | 'RATE_LIMITED'
  | 'LOCKED'

const ERROR_MAP: Record<AuthErrorCode, { status: number; message: string }> = {
  AUTH_REQUIRED: { status: 401, message: 'Authentication required' },
  INVALID_CREDENTIALS: { status: 401, message: 'Invalid email or password' },
  INVALID_TOKEN: { status: 401, message: 'Invalid token' },
  INVALID_TOKEN_PURPOSE: { status: 401, message: 'Invalid token type' },
  SESSION_EXPIRED: { status: 401, message: 'Session expired' },
  SESSION_REVOKED: { status: 401, message: 'Session revoked' },
  SESSION_INVALIDATED: { status: 401, message: 'Session invalidated' },
  TOKEN_REPLAY: { status: 401, message: 'Token reuse detected' },
  ACCOUNT_DISABLED: { status: 401, message: 'Account disabled' },
  ACCOUNT_SUSPENDED: { status: 403, message: 'Account suspended' },
  ACCOUNT_BANNED: { status: 403, message: 'Account banned' },
  FORBIDDEN: { status: 403, message: 'Insufficient permissions' },
  MEMBERSHIP_REQUIRED: { status: 403, message: 'Company membership required' },
  CAPABILITY_REQUIRED: { status: 403, message: 'Required capability not available' },
  RATE_LIMITED: { status: 429, message: 'Too many requests' },
  LOCKED: { status: 423, message: 'Account temporarily locked' },
}

export class AuthError extends Error {
  readonly code: AuthErrorCode
  readonly status: number

  constructor(code: AuthErrorCode) {
    const info = ERROR_MAP[code]
    super(info.message)
    this.name = 'AuthError'
    this.code = code
    this.status = info.status
  }

  toJSON() {
    return { error: this.message, code: this.code }
  }
}
