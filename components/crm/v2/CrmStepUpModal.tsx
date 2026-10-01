'use client'

import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { FiKey, FiShield } from 'react-icons/fi'
import { CrmButton, crmInputClass } from './CrmPrimitives'
import { CrmModal } from './CrmOverlays'

export function CrmStepUpModal({
  open,
  actionId,
  title = 'Verify sensitive action',
  description = 'Enter the 6-digit code from your authenticator app. This creates a one-time proof tied to your current CRM session and this exact action.',
  onClose,
  onVerified,
}: {
  open: boolean
  actionId: string
  title?: string
  description?: string
  onClose: () => void
  onVerified: (proof: string) => void | Promise<void>
}) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) setCode('')
  }, [open, actionId])

  async function verify() {
    if (busy) return
    if (!/^\d{6}$/.test(code)) {
      toast.error('Enter the 6-digit authenticator code')
      return
    }

    setBusy(true)
    try {
      const response = await fetch('/api/admin/auth/step-up', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionId,
          totpCode: code,
        }),
      })
      const body = await response.json().catch(() => ({}))

      if (!response.ok || typeof body?.proof !== 'string') {
        throw new Error(body?.error || 'Step-up verification failed')
      }

      await onVerified(body.proof)
      setCode('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Step-up verification failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <CrmModal
      open={open}
      onClose={busy ? () => undefined : onClose}
      title={title}
      description={description}
      maxWidth="max-w-md"
      footer={
        <>
          <CrmButton variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </CrmButton>
          <CrmButton variant="primary" onClick={verify} disabled={busy}>
            <FiKey size={14} />
            {busy ? 'Verifying…' : 'Verify & continue'}
          </CrmButton>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-start gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-amber-700">
              <FiShield size={16} />
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">One-time security proof</div>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                The proof expires quickly, is bound to this session and action, and cannot be reused after consumption.
              </p>
            </div>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-700">
            Authenticator code
          </label>
          <input
            value={code}
            onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={event => {
              if (event.key === 'Enter') verify()
            }}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            className={`${crmInputClass} text-center font-mono text-lg tracking-[0.35em]`}
            placeholder="000000"
          />
        </div>
      </div>
    </CrmModal>
  )
}
