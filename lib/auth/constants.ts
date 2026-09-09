export const TOKEN_PURPOSE = {
  MARKETPLACE_ACCESS: 'marketplace_access',
  STAFF_ACCESS: 'staff_access',
} as const

export type TokenPurpose = typeof TOKEN_PURPOSE[keyof typeof TOKEN_PURPOSE]

export const TOKEN_AUDIENCE = {
  MARKETPLACE: 'maintainex-marketplace',
  STAFF: 'maintainex-staff',
} as const

export const TOKEN_ISSUER = 'maintainex'

export const TOKEN_LIFETIMES = {
  MARKETPLACE_ACCESS: '15m',
  MARKETPLACE_REFRESH_DAYS: 30,
  STAFF_ACCESS: '30m',
  STAFF_REFRESH_DAYS: 7,
  TEMP_2FA: '5m',
  OTP: '5m',
  PASSWORD_RESET: '1h',
} as const

export const REFRESH_TOKEN_BYTES = 64
