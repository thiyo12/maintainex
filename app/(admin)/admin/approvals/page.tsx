'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import {
  FiAlertTriangle,
  FiArrowUpRight,
  FiCheckCircle,
  FiClock,
  FiLock,
  FiRefreshCw,
  FiShield,
  FiXCircle,
} from 'react-icons/fi'
import {
  CrmBadge,
  CrmButton,
  CrmCard,
  CrmField,
  CrmMetricCard,
  CrmPageHeader,
  CrmState,
  crmInputClass,
  type CrmTone,
} from '@/components/crm/v2/CrmPrimitives'
import { CrmModal } from '@/components/crm/v2/CrmOverlays'
import { crmApiError } from '@/lib/crm/api-error'

interface ApprovalRow {
  id: string
  actionId: string
  actionLabel: string
  status: string
  tier: string
  market: string
  targetType: string
  targetId: string
  amountMinor: string | null
  currency: string | null
  reasonCode: string | null
  note: string | null
  riskFlags: string
  createdAt: string
  expiresAt: string | null
  stepUpRequired: boolean
  canApprove: boolean
  initiatorAdminId: string
  decisions: Array<{
    adminId: string
    adminRole: string
    decision: string
    reason?: string | null
    decidedAt: string
  }>
}

function toneForStatus(status: string): CrmTone {
  if (status === 'ON_HOLD') return 'warning'
  if (status === 'REJECTED' || status === 'FAILED') return 'danger'
  if (status === 'SUCCEEDED' || status === 'APPROVED') return 'success'
  return 'info'
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-LK', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function formatAmount(row: ApprovalRow) {
  if (!row.amountMinor || !row.currency) return '—'
  const value = Number(row.amountMinor) / 100
  if (!Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: row.currency,
    maximumFractionDigits: 2,
  }).format(value)
}

function targetHref(row: ApprovalRow) {
  if (row.actionId === 'jobs.cancel') return `/admin/jobs/${row.targetId}`
  return null
}

export default function ApprovalQueuePage() {
  const [rows, setRows] = useState<ApprovalRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<ApprovalRow | null>(null)
  const [decision, setDecision] = useState<'APPROVE' | 'REJECT'>('APPROVE')
  const [reason, setReason] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/approvals', {
        credentials: 'include',
        cache: 'no-store',
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        crmApiError(body, 'Unable to load approvals')
      }
      setRows(Array.isArray(body?.approvals) ? body.approvals : [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load approvals')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const metrics = useMemo(() => ({
    total: rows.length,
    holds: rows.filter(row => row.status === 'ON_HOLD').length,
    stepUp: rows.filter(row => row.stepUpRequired && row.canApprove).length,
    actionable: rows.filter(row => row.canApprove).length,
  }), [rows])

  function openDecision(row: ApprovalRow, nextDecision: 'APPROVE' | 'REJECT') {
    setSelected(row)
    setDecision(nextDecision)
    setReason('')
    setTotpCode('')
  }

  async function submitDecision() {
    if (!selected || submitting) return
    if (selected.stepUpRequired && !/^\d{6}$/.test(totpCode)) {
      toast.error('Enter the 6-digit authenticator code')
      return
    }

    setSubmitting(true)
    try {
      let proof: string | null = null

      if (selected.stepUpRequired) {
        const stepUpResponse = await fetch('/api/admin/auth/step-up', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            actionId: selected.actionId,
            totpCode,
          }),
        })
        const stepUpBody = await stepUpResponse.json().catch(() => ({}))
        if (!stepUpResponse.ok || !stepUpBody?.proof) {
          throw new Error(stepUpBody?.error || 'Step-up authentication failed')
        }
        proof = stepUpBody.proof
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (proof) headers['X-CRM-Step-Up'] = proof

      const response = await fetch(
        `/api/admin/approvals/${encodeURIComponent(selected.id)}/decision`,
        {
          method: 'POST',
          credentials: 'include',
          headers,
          body: JSON.stringify({
            decision,
            reason: reason.trim() || undefined,
          }),
        }
      )
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        crmApiError(body, 'Approval decision failed')
      }

      const status = body?.approval?.status
      if (status === 'SUCCEEDED') {
        toast.success('Approved and executed successfully')
      } else if (decision === 'REJECT') {
        toast.success('Approval request rejected')
      } else if (status === 'PENDING_APPROVAL') {
        toast.success('Approval recorded; another approval is still required')
      } else {
        toast.success('Approval decision recorded')
      }

      setSelected(null)
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Approval decision failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">
      <CrmPageHeader
        eyebrow="Governance"
        title="Approval Queue"
        description="Review high-impact CRM actions that require maker-checker approval, live risk revalidation, or step-up authentication."
        actions={
          <CrmButton variant="secondary" onClick={load} disabled={loading}>
            <FiRefreshCw size={14} />
            Refresh
          </CrmButton>
        }
      />

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <CrmMetricCard
          label="Visible approvals"
          value={metrics.total}
          helper="Scoped to your role and markets"
          icon={<FiShield size={16} />}
          tone="neutral"
        />
        <CrmMetricCard
          label="Actionable"
          value={metrics.actionable}
          helper="You can decide now"
          icon={<FiCheckCircle size={16} />}
          tone="success"
        />
        <CrmMetricCard
          label="On hold"
          value={metrics.holds}
          helper="Risk condition must clear"
          icon={<FiAlertTriangle size={16} />}
          tone="warning"
        />
        <CrmMetricCard
          label="Step-up required"
          value={metrics.stepUp}
          helper="Fresh TOTP proof needed"
          icon={<FiLock size={16} />}
          tone="amber"
        />
      </section>

      {loading ? (
        <CrmState
          type="loading"
          title="Loading approval queue"
          description="Checking live role, market and maker-checker eligibility."
        />
      ) : rows.length === 0 ? (
        <CrmState
          type="empty"
          title="No approvals need your attention"
          description="Only approvals that match your live role, market scope and approval slot are shown here."
        />
      ) : (
        <div className="space-y-3">
          {rows.map(row => {
            const href = targetHref(row)
            return (
              <CrmCard key={row.id} padding="none">
                <div className="p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <CrmBadge tone={toneForStatus(row.status)} dot>
                          {row.status.replaceAll('_', ' ')}
                        </CrmBadge>
                        <CrmBadge tone="amber">{row.tier}</CrmBadge>
                        <CrmBadge>{row.market}</CrmBadge>
                        {row.stepUpRequired && (
                          <CrmBadge tone="warning">
                            <FiLock size={10} />
                            Step-up
                          </CrmBadge>
                        )}
                      </div>

                      <h2 className="mt-3 text-base font-semibold text-slate-950">
                        {row.actionLabel}
                      </h2>
                      <div className="mt-1 font-mono text-[11px] text-slate-400">
                        {row.targetType} · {row.targetId}
                      </div>

                      <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2 xl:grid-cols-4">
                        <div>
                          <div className="text-slate-400">Amount</div>
                          <div className="mt-1 font-semibold text-slate-800">{formatAmount(row)}</div>
                        </div>
                        <div>
                          <div className="text-slate-400">Requested</div>
                          <div className="mt-1 font-semibold text-slate-800">{formatDate(row.createdAt)}</div>
                        </div>
                        <div>
                          <div className="text-slate-400">Expires</div>
                          <div className="mt-1 font-semibold text-slate-800">{formatDate(row.expiresAt)}</div>
                        </div>
                        <div>
                          <div className="text-slate-400">Reason</div>
                          <div className="mt-1 font-semibold text-slate-800">{row.reasonCode || '—'}</div>
                        </div>
                      </div>

                      {row.note && (
                        <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">{row.note}</p>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      {href && (
                        <Link
                          href={href}
                          className="inline-flex h-10 items-center gap-2 rounded-[11px] border border-[var(--crm-border)] bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Open target
                          <FiArrowUpRight size={14} />
                        </Link>
                      )}
                      {row.canApprove && (
                        <>
                          <CrmButton
                            variant="secondary"
                            onClick={() => openDecision(row, 'REJECT')}
                          >
                            <FiXCircle size={14} />
                            Reject
                          </CrmButton>
                          <CrmButton
                            variant="primary"
                            onClick={() => openDecision(row, 'APPROVE')}
                          >
                            <FiCheckCircle size={14} />
                            Approve
                          </CrmButton>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </CrmCard>
            )
          })}
        </div>
      )}

      <CrmModal
        open={Boolean(selected)}
        onClose={() => {
          if (!submitting) setSelected(null)
        }}
        title={decision === 'APPROVE' ? 'Approve action' : 'Reject action'}
        description={
          selected
            ? `${selected.actionLabel} · ${selected.tier} · ${selected.market}`
            : undefined
        }
        maxWidth="max-w-lg"
        footer={
          <>
            <CrmButton
              variant="secondary"
              onClick={() => setSelected(null)}
              disabled={submitting}
            >
              Cancel
            </CrmButton>
            <CrmButton
              variant={decision === 'APPROVE' ? 'primary' : 'danger'}
              onClick={submitDecision}
              disabled={submitting}
            >
              {submitting
                ? 'Working…'
                : decision === 'APPROVE'
                  ? 'Confirm approval'
                  : 'Confirm rejection'}
            </CrmButton>
          </>
        }
      >
        <div className="space-y-4">
          <CrmField
            label="Decision reason"
            hint="Recorded in the immutable approval audit trail."
          >
            <textarea
              value={reason}
              onChange={event => setReason(event.target.value)}
              rows={4}
              maxLength={2000}
              className="w-full resize-none rounded-[11px] border border-[var(--crm-border)] bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
              placeholder="Add an operational reason or review note…"
            />
          </CrmField>

          {selected?.stepUpRequired && (
            <CrmField
              label="Authenticator code"
              hint="A fresh one-time proof is bound to this action and session."
            >
              <input
                value={totpCode}
                onChange={event => setTotpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                className={crmInputClass}
                placeholder="000000"
              />
            </CrmField>
          )}

          {selected && (
            <div className="rounded-xl border border-[var(--crm-border)] bg-[#fafbf9] p-3 text-xs leading-5 text-slate-500">
              The server will re-read the target state, risk conditions, market scope and approval tier before execution. A stale approval can be held, re-tiered or rejected.
            </div>
          )}
        </div>
      </CrmModal>
    </div>
  )
}
