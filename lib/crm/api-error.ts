/**
 * Safe CRM API error parsing.
 *
 * CRM API routes return errors in two different shapes:
 *
 *   1. `{ error: 'Message' }`                          — route validation errors
 *   2. `{ error: { code: 'CRM_...', message: '...' } }` — guardCrmRequest/deny()
 *
 * Reading `body.error` directly from a shape-2 response yields a plain object,
 * and `throw new Error(obj)` stringifies to the literal text `[object Object]`,
 * which hides the real cause from CRM operators.
 *
 * This helper normalises every shape into a single readable string and never
 * surfaces server stack traces or raw diagnostics.
 */

const MAX_ERROR_LENGTH = 300
const SAFE_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,79}$/

function safeText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().replace(/\s+/g, ' ')
  if (!trimmed) return null
  return trimmed.slice(0, MAX_ERROR_LENGTH)
}

function safeCode(value: unknown): string | null {
  const text = safeText(value)
  if (!text) return null
  return SAFE_CODE_PATTERN.test(text) ? text : null
}

/**
 * True when a string looks like an accidental object coercion such as
 * `[object Object]`, which must never reach an operator.
 */
export function isOpaqueObjectString(value: string): boolean {
  return /^\[object [A-Za-z]+\]$/.test(value.trim())
}

function readStructuredError(body: unknown): string | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null

  const rawError = (body as Record<string, unknown>).error

  // Shape 1: { error: 'message' }
  if (typeof rawError === 'string') {
    const text = safeText(rawError)
    if (!text || isOpaqueObjectString(text)) return null
    return text
  }

  // Shape 2: { error: { code, message } }
  if (rawError && typeof rawError === 'object' && !Array.isArray(rawError)) {
    const source = rawError as Record<string, unknown>
    const message = safeText(source.message)
    const code = safeCode(source.code)

    if (message && code) return `${message} (${code})`
    if (message) return message
    if (code) return code
  }

  return null
}

/**
 * Normalises a CRM API error body into a readable message.
 *
 * @param body     Parsed response body (may be null, undefined or non-object).
 * @param fallback Message to use when the body carries nothing usable.
 */
export function readCrmApiErrorMessage(
  body: unknown,
  fallback = 'Request failed'
): string {
  const structured = readStructuredError(body)
  if (structured) return structured

  const fromMessage = safeText(
    body && typeof body === 'object'
      ? (body as Record<string, unknown>).message
      : undefined
  )
  if (fromMessage && !isOpaqueObjectString(fromMessage)) return fromMessage

  return fallback
}

/**
 * Builds an Error whose message is always human-readable, never `[object Object]`.
 */
export function crmApiError(body: unknown, fallback = 'Request failed'): Error {
  return new Error(readCrmApiErrorMessage(body, fallback))
}
