import { logger } from './logger'
import { redactObject, redactString } from './redaction'

type LegacyLevel = 'error' | 'warn' | 'info'

type NormalizedLog = {
  message: string
  context: Record<string, unknown>
  error?: Error
}

const IS_PRODUCTION = process.env.NODE_ENV === 'production'

function normalize(level: LegacyLevel, args: unknown[]): NormalizedLog {
  const error = args.find((value): value is Error => value instanceof Error)

  if (IS_PRODUCTION) {
    return {
      message: `Legacy server ${level} event`,
      context: {
        legacyConsole: true,
        argCount: args.length,
        ...(error ? { errorName: error.name || 'Error' } : {}),
      },
      error,
    }
  }

  const first = args[0]
  const message = typeof first === 'string'
    ? redactString(first)
    : `Legacy server ${level} event`

  const safeArgs = args.map(value => {
    if (value instanceof Error) {
      return {
        name: value.name || 'Error',
        message: redactString(value.message || ''),
        ...(value.stack ? { stack: redactString(value.stack) } : {}),
      }
    }
    return redactObject(value)
  })

  return {
    message,
    context: {
      legacyConsole: true,
      legacyArgs: safeArgs,
    },
    error,
  }
}

export const secureConsole = {
  error(...args: unknown[]): void {
    const normalized = normalize('error', args)
    logger.error(normalized.message, {
      ...normalized.context,
      ...(normalized.error ? { err: normalized.error } : {}),
    })
  },

  warn(...args: unknown[]): void {
    const normalized = normalize('warn', args)
    logger.warn(normalized.message, normalized.context)
  },

  log(...args: unknown[]): void {
    const normalized = normalize('info', args)
    logger.info(normalized.message, normalized.context)
  },
}
