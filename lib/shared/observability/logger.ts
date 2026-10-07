import pino from 'pino'
import { redactObject, redactString } from './redaction'
import { getRequestContext } from './request-context'

const RELEASE_SHA = process.env.APP_RELEASE_SHA || 'unknown'
const ENVIRONMENT = process.env.NODE_ENV || 'development'
const SERVICE = 'maintainex'

interface LogContext {
  requestId?: string
  correlationId?: string
  actorId?: string
  actorType?: string
  countryCode?: string
  route?: string
  method?: string
  statusCode?: number
  durationMs?: number
  jobId?: string
  currency?: string
  errorCode?: string
  eventType?: string
  [key: string]: unknown
}

function enrichContext(context?: LogContext): Record<string, unknown> {
  const reqCtx = getRequestContext()
  const merged = {
    service: SERVICE,
    environment: ENVIRONMENT,
    releaseSha: RELEASE_SHA,
    ...(reqCtx && {
      requestId: reqCtx.requestId,
      correlationId: reqCtx.correlationId,
      actorId: reqCtx.actorId,
      actorType: reqCtx.actorType,
      countryCode: reqCtx.countryCode,
    }),
    ...context,
  }
  return redactObject(merged) as Record<string, unknown>
}

const isDev = ENVIRONMENT === 'development'

const transport = isDev
  ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' } }
  : undefined

const baseLogger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  transport,
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
})

export interface AppLogger {
  debug(message: string, context?: LogContext): void
  info(message: string, context?: LogContext): void
  warn(message: string, context?: LogContext): void
  error(message: string, context?: LogContext): void
}

function sanitizeErrorForLog(error: unknown): Record<string, unknown> | undefined {
  if (!error) return undefined

  if (error instanceof Error) {
    const code = typeof (error as Error & { code?: unknown }).code === 'string'
      ? (error as Error & { code?: string }).code
      : undefined

    if (ENVIRONMENT === 'production') {
      return {
        name: error.name || 'Error',
        ...(code ? { code } : {}),
        message: '[REDACTED]',
      }
    }

    return {
      name: error.name || 'Error',
      ...(code ? { code } : {}),
      message: redactString(error.message || ''),
      ...(error.stack ? { stack: redactString(error.stack) } : {}),
    }
  }

  return {
    name: 'NonError',
    message: ENVIRONMENT === 'production' ? '[REDACTED]' : redactString(String(error)),
  }
}

function createLogger(): AppLogger {
  return {
    debug(message: string, context?: LogContext) {
      try {
        baseLogger.debug(enrichContext(context), message)
      } catch {
        // Logger must never crash the caller
      }
    },
    info(message: string, context?: LogContext) {
      try {
        baseLogger.info(enrichContext(context), message)
      } catch {
        // Logger must never crash the caller
      }
    },
    warn(message: string, context?: LogContext) {
      try {
        baseLogger.warn(enrichContext(context), message)
      } catch {
        // Logger must never crash the caller
      }
    },
    error(message: string, context?: LogContext) {
      try {
        const { err, ...rest } = context || {}
        const enriched = enrichContext(rest)
        const safeError = sanitizeErrorForLog(err)
        if (safeError) {
          baseLogger.error({ ...enriched, error: safeError }, message)
        } else {
          baseLogger.error(enriched, message)
        }
      } catch {
        // Logger must never crash the caller
      }
    },
  }
}

export const logger: AppLogger = createLogger()

export function childLogger(context: LogContext): AppLogger {
  return {
    debug(message: string, ctx?: LogContext) {
      logger.debug(message, { ...context, ...ctx })
    },
    info(message: string, ctx?: LogContext) {
      logger.info(message, { ...context, ...ctx })
    },
    warn(message: string, ctx?: LogContext) {
      logger.warn(message, { ...context, ...ctx })
    },
    error(message: string, ctx?: LogContext) {
      logger.error(message, { ...context, ...ctx })
    },
  }
}
