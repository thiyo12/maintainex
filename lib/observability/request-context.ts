import { AsyncLocalStorage } from 'async_hooks'
import crypto from 'crypto'

export interface RequestContext {
  requestId: string
  correlationId: string
  actorId?: string
  actorType?: string
  countryCode?: string
  route?: string
  method?: string
  startTime?: number
}

const requestContextStorage = new AsyncLocalStorage<RequestContext>()

export function generateRequestId(): string {
  return crypto.randomUUID()
}

export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return requestContextStorage.run(context, fn)
}

export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore()
}

export function setRequestContext(patch: Partial<RequestContext>): void {
  const current = requestContextStorage.getStore()
  if (current) {
    Object.assign(current, patch)
  }
}

export function getRequestId(): string {
  return getRequestContext()?.requestId || 'unknown'
}

export function getCorrelationId(): string {
  return getRequestContext()?.correlationId || getRequestId()
}

export function parseIncomingRequestId(header: string | null | undefined): string | null {
  if (!header) return null
  const trimmed = header.trim()
  if (trimmed.length > 128) return null
  if (!/^[a-zA-Z0-9\-_]+$/.test(trimmed)) return null
  return trimmed
}
