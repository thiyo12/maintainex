'use client'

import { useEffect, type ReactNode } from 'react'
import { FiAlertTriangle, FiX } from 'react-icons/fi'
import { CrmButton } from './CrmPrimitives'

function useEscape(onClose: () => void, open: boolean) {
  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose, open])
}

export function CrmModal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = 'max-w-xl',
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  maxWidth?: string
}) {
  useEscape(onClose, open)
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close modal"
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative w-full ${maxWidth} overflow-hidden rounded-[14px] border border-[var(--crm-border)] bg-white shadow-[var(--crm-shadow-float)]`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-[var(--crm-border)] px-4 py-3.5">
          <div>
            <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
            {description && <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-800"
            aria-label="Close"
          >
            <FiX size={17} />
          </button>
        </header>
        <div className="max-h-[72vh] overflow-y-auto px-4 py-4">{children}</div>
        {footer && (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--crm-border)] bg-[#fafbfc] px-4 py-3">
            {footer}
          </footer>
        )}
      </section>
    </div>
  )
}

export function CrmDrawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'max-w-xl',
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  width?: string
}) {
  useEscape(onClose, open)
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[90]">
      <button
        type="button"
        aria-label="Close drawer"
        className="absolute inset-0 bg-slate-950/35 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`absolute inset-y-0 right-0 flex w-full ${width} flex-col border-l border-[var(--crm-border)] bg-white shadow-[var(--crm-shadow-float)]`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-[var(--crm-border)] px-4 py-3.5">
          <div>
            <h2 className="text-sm font-semibold text-slate-950">{title}</h2>
            {description && <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-800"
            aria-label="Close"
          >
            <FiX size={17} />
          </button>
        </header>
        <div className="crm-scrollbar flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer && (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--crm-border)] bg-[#fafbfc] px-4 py-3">
            {footer}
          </footer>
        )}
      </section>
    </div>
  )
}

export function CrmConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  dangerous = false,
  busy = false,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  dangerous?: boolean
  busy?: boolean
}) {
  return (
    <CrmModal
      open={open}
      onClose={busy ? () => undefined : onClose}
      title={title}
      maxWidth="max-w-md"
      footer={
        <>
          <CrmButton variant="secondary" onClick={onClose} disabled={busy}>{cancelLabel}</CrmButton>
          <CrmButton variant={dangerous ? 'danger' : 'primary'} onClick={onConfirm} disabled={busy}>
            {busy ? 'Working…' : confirmLabel}
          </CrmButton>
        </>
      }
    >
      <div className="flex gap-3">
        <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
          dangerous
            ? 'bg-[var(--crm-danger-soft)] text-[var(--crm-danger)]'
            : 'bg-[var(--crm-warning-soft)] text-[var(--crm-warning)]'
        }`}>
          <FiAlertTriangle size={18} />
        </div>
        <p className="pt-1 text-sm leading-6 text-slate-600">{description}</p>
      </div>
    </CrmModal>
  )
}
