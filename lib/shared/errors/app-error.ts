export class AppError extends Error {
  public readonly code: string
  public readonly statusCode: number
  public readonly safeMessage: string
  public readonly details?: unknown
  public readonly requestId?: string

  constructor(params: {
    code: string
    statusCode: number
    message: string
    safeMessage: string
    details?: unknown
    requestId?: string
  }) {
    super(params.message)
    this.name = 'AppError'
    this.code = params.code
    this.statusCode = params.statusCode
    this.safeMessage = params.safeMessage
    this.details = params.details
    this.requestId = params.requestId
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}

export function toSafeError(error: unknown, requestId?: string): AppError {
  if (isAppError(error)) {
    if (requestId) (error as any).requestId = requestId
    return error
  }
  return new AppError({
    code: 'INTERNAL_ERROR',
    statusCode: 500,
    message: error instanceof Error ? error.message : 'Unknown error',
    safeMessage: 'An internal error occurred. Please try again later.',
    requestId,
  })
}

export const ERROR_CODES = {
  INTERNAL_ERROR: { statusCode: 500, safeMessage: 'An internal error occurred. Please try again later.' },
  UNAUTHORIZED: { statusCode: 401, safeMessage: 'Authentication required.' },
  FORBIDDEN: { statusCode: 403, safeMessage: 'You do not have permission to perform this action.' },
  NOT_FOUND: { statusCode: 404, safeMessage: 'The requested resource was not found.' },
  RATE_LIMITED: { statusCode: 429, safeMessage: 'Too many requests. Try again later.' },
  VALIDATION_ERROR: { statusCode: 400, safeMessage: 'The request contains invalid data.' },
  COUNTRY_MISMATCH: { statusCode: 403, safeMessage: 'Request cannot be completed for this market.' },
  CURRENCY_MISMATCH: { statusCode: 403, safeMessage: 'Currency operation not permitted.' },
  CONFLICT: { statusCode: 409, safeMessage: 'The request conflicts with current state.' },
  PAYLOAD_TOO_LARGE: { statusCode: 413, safeMessage: 'The request payload is too large.' },
  UNSUPPORTED_MEDIA: { statusCode: 415, safeMessage: 'The request format is not supported.' },
  SERVICE_UNAVAILABLE: { statusCode: 503, safeMessage: 'The service is temporarily unavailable.' },
} as const

export type ErrorCode = keyof typeof ERROR_CODES
