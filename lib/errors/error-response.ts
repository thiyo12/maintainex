import { NextResponse } from 'next/server'
import { AppError, isAppError, toSafeError, ERROR_CODES } from './app-error'
import { getRequestId } from '../observability/request-context'

export interface ErrorResponseBody {
  error: {
    code: string
    message: string
    requestId?: string
  }
}

export function errorResponse(error: unknown, fallbackRequestId?: string): NextResponse<ErrorResponseBody> {
  const requestId = fallbackRequestId || getRequestId()
  const appError = isAppError(error) ? error : toSafeError(error, requestId)

  return NextResponse.json(
    {
      error: {
        code: appError.code,
        message: appError.safeMessage,
        requestId,
      },
    },
    { status: appError.statusCode }
  )
}

export function unauthorized(message?: string): NextResponse<ErrorResponseBody> {
  const requestId = getRequestId()
  return NextResponse.json(
    {
      error: {
        code: 'UNAUTHORIZED',
        message: message || ERROR_CODES.UNAUTHORIZED.safeMessage,
        requestId,
      },
    },
    { status: 401 }
  )
}

export function forbidden(message?: string): NextResponse<ErrorResponseBody> {
  const requestId = getRequestId()
  return NextResponse.json(
    {
      error: {
        code: 'FORBIDDEN',
        message: message || ERROR_CODES.FORBIDDEN.safeMessage,
        requestId,
      },
    },
    { status: 403 }
  )
}

export function notFound(message?: string): NextResponse<ErrorResponseBody> {
  const requestId = getRequestId()
  return NextResponse.json(
    {
      error: {
        code: 'NOT_FOUND',
        message: message || ERROR_CODES.NOT_FOUND.safeMessage,
        requestId,
      },
    },
    { status: 404 }
  )
}

export function rateLimited(retryAfterSeconds: number, requestId?: string): NextResponse<ErrorResponseBody> {
  const rid = requestId || getRequestId()
  return NextResponse.json(
    {
      error: {
        code: 'RATE_LIMITED',
        message: ERROR_CODES.RATE_LIMITED.safeMessage,
        requestId: rid,
      },
    },
    {
      status: 429,
      headers: { 'Retry-After': retryAfterSeconds.toString() },
    }
  )
}

export function badRequest(message?: string): NextResponse<ErrorResponseBody> {
  const requestId = getRequestId()
  return NextResponse.json(
    {
      error: {
        code: 'VALIDATION_ERROR',
        message: message || ERROR_CODES.VALIDATION_ERROR.safeMessage,
        requestId,
      },
    },
    { status: 400 }
  )
}
