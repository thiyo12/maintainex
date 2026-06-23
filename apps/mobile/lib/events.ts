let _version = 0
let _subscribers: Set<() => void> = new Set()
let _listeners: Record<string, ((...args: any[]) => void)[]> = {}

export function emit(event: string, ...args: any[]) {
  _version++
  _subscribers.forEach(fn => fn())
  ;(_listeners[event] || []).forEach(fn => fn(...args))
}

export function on(event: string, fn: (...args: any[]) => void) {
  if (!_listeners[event]) _listeners[event] = []
  _listeners[event].push(fn)
  return () => {
    _listeners[event] = (_listeners[event] || []).filter(f => f !== fn)
  }
}

export function subscribe(fn: () => void) {
  _subscribers.add(fn)
  return () => _subscribers.delete(fn)
}

export function getVersion() { return _version }

export const removedJobs = new Set<string>()
