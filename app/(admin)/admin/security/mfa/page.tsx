'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import toast from 'react-hot-toast'
import { FiKey, FiRefreshCw, FiShield } from 'react-icons/fi'
import { useAdminSession } from '@/components/admin/AdminSessionProvider'
import {
  CrmBadge,
  CrmButton,
  CrmCard,
  CrmPageHeader,
} from '@/components/crm/v2/CrmPrimitives'
import { crmApiError } from '@/lib/crm/api-error'

type Phase = 'idle' | 'password' | 'scanning' | 'confirming' | 'enabled'

interface SetupPayload {
  secret: string
  uri: string
}

export default function AdminMfaEnrollmentPage() {
  const { user, loading, refresh } = useAdminSession()
  const [phase, setPhase] = useState<Phase>('idle')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [setup, setSetup] = useState<SetupPayload | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [revealKey, setRevealKey] = useState(false)
  const qrRef = useRef<HTMLCanvasElement | null>(null)

  const totpEnabled = Boolean(user?.totpEnabled)

  useEffect(() => {
    if (phase === 'enabled' && !totpEnabled) {
      // Backend confirmation succeeded but the cached session still shows the
      // old flag; ask the session provider for authoritative state.
      void refresh?.()
    }
  }, [phase, totpEnabled, refresh])

  // Clear enrollment material from memory as soon as it is no longer needed.
  const discardSecret = useCallback(() => {
    setSetup(null)
    setQrDataUrl(null)
    setRevealKey(false)
  }, [])

  const resetAll = useCallback(() => {
    discardSecret()
    setPassword('')
    setCode('')
    setPhase('idle')
  }, [discardSecret])

  const beginSetup = () => {
    discardSecret()
    setCode('')
    setPhase('password')
  }

  const startEnrollment = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!password) return
    setBusy(true)
    try {
      const response = await fetch('/api/admin/auth/2fa/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: password }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || 'Could not start two-factor setup.')
      }

      const nextSetup: SetupPayload = {
        secret: String(payload.secret || ''),
        uri: String(payload.uri || ''),
      }
      if (!nextSetup.secret || !nextSetup.uri) {
        throw new Error('Two-factor setup returned an incomplete response.')
      }

      setSetup(nextSetup)
      setPassword('')
      setPhase('scanning')

      // Render the QR locally in the browser; the secret never leaves the page.
      if (qrRef.current) {
        await QRCode.toCanvas(qrRef.current, nextSetup.uri, {
          width: 208,
          margin: 2,
          errorCorrectionLevel: 'M',
        })
      } else {
        const dataUrl = await QRCode.toDataURL(nextSetup.uri, {
          width: 208,
          margin: 2,
          errorCorrectionLevel: 'M',
        })
        setQrDataUrl(dataUrl)
      }
    } catch (error) {
      toast.error(crmApiError(error, 'Could not start two-factor setup.').message)
      discardSecret()
      setPhase('password')
    } finally {
      setBusy(false)
    }
  }

  const confirmCode = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!/^\d{6}$/.test(code.trim())) return
    setBusy(true)
    try {
      const response = await fetch('/api/admin/auth/2fa/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totpCode: code.trim() }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error || 'Could not confirm two-factor setup.')
      }

      discardSecret()
      setCode('')
      setPhase('enabled')
      toast.success('Two-factor authentication enabled')
      await refresh?.()
    } catch (error) {
      toast.error(crmApiError(error, 'Could not confirm two-factor setup.').message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <CrmCard title="Account security">
        <p className="text-sm text-slate-500">Loading your session…</p>
      </CrmCard>
    )
  }

  return (
    <div className="space-y-4">
      <CrmPageHeader
        eyebrow="Account security"
        title="Two-factor authentication"
        description="Protect this staff account with an authenticator app that issues a one-time code at every sign-in."
        actions={
          <CrmButton variant="secondary" onClick={() => void refresh?.()}>
            <FiRefreshCw size={14} />
            Refresh
          </CrmButton>
        }
        context={
          totpEnabled ? (
            <CrmBadge tone="success" dot>Enabled</CrmBadge>
          ) : (
            <CrmBadge tone="amber" dot>Not enabled</CrmBadge>
          )
        }
      />

      <CrmCard
        title="Two-factor authentication"
        description="Enrollment requires your current password and a real code from your authenticator app. Secrets are shown once and never stored in the browser."
      >
        {totpEnabled ? (
          <div className="flex items-start gap-3">
            <FiShield className="mt-0.5 text-emerald-600" size={18} />
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Two-factor authentication enabled
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Every sign-in for this account requires a current authenticator
                code. Removing or rotating the authenticator requires a separate
                support-verified recovery procedure.
              </p>
            </div>
          </div>
        ) : phase === 'idle' ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Super-admin accounts must enable two-factor authentication before
              production release.
            </p>
            <CrmButton variant="primary" onClick={beginSetup}>
              <FiKey size={14} />
              Enable two-factor authentication
            </CrmButton>
          </div>
        ) : null}

        {!totpEnabled && phase === 'password' && (
          <form onSubmit={startEnrollment} className="space-y-3">
            <label className="block text-xs font-semibold text-slate-700">
              Current password
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--crm-border)] px-3 py-2 text-sm"
                required
              />
            </label>
            <p className="text-xs text-slate-500">
              Your password is verified by the server before any secret is
              generated.
            </p>
            <div className="flex gap-2">
              <CrmButton type="submit" variant="primary" disabled={busy || !password}>
                {busy ? 'Verifying…' : 'Continue'}
              </CrmButton>
              <CrmButton type="button" variant="secondary" onClick={resetAll}>
                Cancel
              </CrmButton>
            </div>
          </form>
        )}

        {!totpEnabled && (phase === 'scanning' || phase === 'confirming') && setup && (
          <div className="space-y-4">
            <ol className="space-y-1 text-xs text-slate-600">
              <li>1. Scan the QR code with your authenticator app.</li>
              <li>2. Enter the 6-digit code it shows.</li>
            </ol>

            <div className="flex flex-wrap items-start gap-4">
              <div className="rounded-xl border border-[var(--crm-border)] bg-white p-3">
                <canvas ref={qrRef} aria-label="Authenticator QR code" />
                {qrDataUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrDataUrl} alt="Authenticator QR code" width={208} height={208} />
                )}
              </div>

              <div className="min-w-[220px] flex-1 space-y-2">
                <div className="rounded-xl border border-[var(--crm-border)] bg-slate-50 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Manual setup key
                  </p>
                  {revealKey ? (
                    <code className="mt-1 block break-all text-xs text-slate-800">
                      {setup.secret}
                    </code>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setRevealKey(true)}
                      className="mt-1 text-xs font-semibold text-slate-700 underline"
                    >
                      Reveal setup key
                    </button>
                  )}
                </div>
                <p className="text-[11px] leading-4 text-slate-500">
                  Type: time-based · Account: your admin email. This key is shown
                  once and is never stored in the browser.
                </p>
              </div>
            </div>

            <form onSubmit={confirmCode} className="space-y-3">
              <label className="block text-xs font-semibold text-slate-700">
                6-digit authenticator code
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={event => setCode(event.target.value.replace(/\D/g, ''))}
                  className="mt-1 w-40 rounded-lg border border-[var(--crm-border)] px-3 py-2 text-sm tracking-widest"
                  required
                />
              </label>
              <div className="flex gap-2">
                <CrmButton
                  type="submit"
                  variant="primary"
                  disabled={busy || !/^\d{6}$/.test(code.trim())}
                >
                  {busy ? 'Confirming…' : 'Confirm and enable'}
                </CrmButton>
                <CrmButton type="button" variant="secondary" onClick={resetAll}>
                  Cancel
                </CrmButton>
              </div>
            </form>
          </div>
        )}

        {phase === 'enabled' && (
          <p className="text-sm font-semibold text-emerald-700">
            Two-factor authentication enabled
          </p>
        )}
      </CrmCard>
    </div>
  )
}