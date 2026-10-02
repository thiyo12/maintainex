'use client'

import { useMemo, useState, type ReactNode } from 'react'
import { FiChevronLeft, FiChevronRight, FiFileText, FiLock, FiMessageSquare, FiSend } from 'react-icons/fi'
import { CrmBadge, CrmButton, type CrmTone } from './CrmPrimitives'

export interface CrmActivityItem {
  id: string
  title: string
  description?: string
  actor?: string
  time?: string
  tone?: CrmTone
  icon?: ReactNode
}

export function CrmActivityFeed({
  items,
  emptyLabel = 'No recent activity',
}: {
  items: CrmActivityItem[]
  emptyLabel?: string
}) {
  if (items.length === 0) {
    return (
      <div className="py-8 text-center text-xs text-slate-400">{emptyLabel}</div>
    )
  }

  return (
    <div className="divide-y divide-[var(--crm-border)]">
      {items.map(item => {
        const tone = item.tone || 'neutral'
        return (
          <div key={item.id} className="flex gap-3 px-4 py-3">
            <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-[9px] bg-slate-100 text-slate-500">
              {item.icon || <FiFileText size={14} />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold text-slate-800">{item.title}</div>
                  {item.description && (
                    <p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p>
                  )}
                </div>
                <CrmBadge tone={tone}>{tone === 'neutral' ? 'INFO' : tone.toUpperCase()}</CrmBadge>
              </div>
              {(item.actor || item.time) && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                  {item.actor && <span>{item.actor}</span>}
                  {item.actor && item.time && <span aria-hidden="true">•</span>}
                  {item.time && <span>{item.time}</span>}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export interface CrmNoteItem {
  id: string
  content: string
  author: string
  createdAt: string
  private?: boolean
  type?: string
}

export function CrmNotesPanel({
  notes,
  canAdd = false,
  onAdd,
  loading = false,
}: {
  notes: CrmNoteItem[]
  canAdd?: boolean
  onAdd?: (content: string) => Promise<void>
  loading?: boolean
}) {
  const [draft, setDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit() {
    const content = draft.trim()
    if (!content || !onAdd || submitting) return
    setSubmitting(true)
    try {
      await onAdd(content)
      setDraft('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="crm-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--crm-border)] px-4 py-3">
        <div>
          <div className="text-[13px] font-semibold text-slate-900">Internal notes</div>
          <div className="mt-0.5 text-[11px] text-slate-400">{notes.length} recorded</div>
        </div>
        <FiMessageSquare size={16} className="text-slate-400" />
      </div>

      {canAdd && onAdd && (
        <div className="border-b border-[var(--crm-border)] bg-[#fafbfc] p-3.5">
          <label className="sr-only" htmlFor="crm-note-draft">Internal note</label>
          <textarea
            id="crm-note-draft"
            value={draft}
            onChange={event => setDraft(event.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="Add an internal operational note…"
            className="w-full resize-none rounded-[10px] border border-[var(--crm-border)] bg-white px-3 py-2.5 text-[13px] text-slate-800 outline-none placeholder:text-slate-400 focus:border-amber-300 focus:ring-2 focus:ring-amber-100"
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
              <FiLock size={11} />
              Staff-only note
            </span>
            <CrmButton
              size="sm"
              variant="primary"
              disabled={!draft.trim() || submitting || loading}
              onClick={submit}
            >
              <FiSend size={12} />
              {submitting ? 'Adding…' : 'Add note'}
            </CrmButton>
          </div>
        </div>
      )}

      <div className="crm-scrollbar max-h-[420px] overflow-y-auto">
        {loading ? (
          <div className="p-6 text-center text-xs text-slate-400">Loading notes…</div>
        ) : notes.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">No internal notes yet.</div>
        ) : (
          <div className="divide-y divide-[var(--crm-border)]">
            {notes.map(note => (
              <article key={note.id} className="px-4 py-3">
                <div className="flex items-center gap-2">
                  {note.type && <CrmBadge>{note.type}</CrmBadge>}
                  {note.private && (
                    <CrmBadge tone="warning">
                      <FiLock size={10} />
                      Private
                    </CrmBadge>
                  )}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{note.content}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-400">
                  <span>{note.author}</span>
                  <span aria-hidden="true">•</span>
                  <span>{note.createdAt}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function CrmPagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
}: {
  page: number
  totalPages: number
  total?: number
  pageSize?: number
  onPageChange: (page: number) => void
}) {
  const safeTotalPages = Math.max(1, totalPages)
  const pages = useMemo(() => {
    const candidates = new Set([
      1,
      safeTotalPages,
      page - 1,
      page,
      page + 1,
    ])
    return [...candidates]
      .filter(value => value >= 1 && value <= safeTotalPages)
      .sort((a, b) => a - b)
  }, [page, safeTotalPages])

  const start =
    typeof total === 'number' && pageSize
      ? Math.min(total, (page - 1) * pageSize + 1)
      : null
  const end =
    typeof total === 'number' && pageSize
      ? Math.min(total, page * pageSize)
      : null

  return (
    <div className="flex flex-col gap-3 border-t border-[var(--crm-border)] bg-white px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-xs text-slate-400">
        {start !== null && end !== null && typeof total === 'number'
          ? `Showing ${start}–${end} of ${total}`
          : `Page ${page} of ${safeTotalPages}`}
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          aria-label="Previous page"
          className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--crm-border)] text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35"
        >
          <FiChevronLeft size={14} />
        </button>

        {pages.map((value, index) => {
          const previous = pages[index - 1]
          return (
            <span key={value} className="contents">
              {previous && value - previous > 1 && (
                <span className="px-1 text-xs text-slate-400">…</span>
              )}
              <button
                type="button"
                onClick={() => onPageChange(value)}
                aria-current={value === page ? 'page' : undefined}
                className={`h-8 min-w-8 rounded-lg px-2 text-xs font-semibold ${
                  value === page
                    ? 'bg-[#17191b] text-white'
                    : 'border border-[var(--crm-border)] bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {value}
              </button>
            </span>
          )
        })}

        <button
          type="button"
          disabled={page >= safeTotalPages}
          onClick={() => onPageChange(Math.min(safeTotalPages, page + 1))}
          aria-label="Next page"
          className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--crm-border)] text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35"
        >
          <FiChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}
