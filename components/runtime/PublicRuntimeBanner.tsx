export default function PublicRuntimeBanner({
  enabled,
  message,
  severity,
}: {
  enabled: boolean
  message: string
  severity: 'INFO' | 'WARNING' | 'CRITICAL'
}) {
  if (!enabled || !message.trim()) return null

  const className =
    severity === 'CRITICAL'
      ? 'border-red-200 bg-red-50 text-red-900'
      : severity === 'WARNING'
        ? 'border-amber-200 bg-amber-50 text-amber-900'
        : 'border-blue-200 bg-blue-50 text-blue-900'

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-4 left-1/2 z-[70] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 rounded-2xl border px-4 py-3 text-center text-sm font-semibold shadow-xl ${className}`}
    >
      {message}
    </div>
  )
}
