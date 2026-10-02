'use client'

import type { ReactNode } from 'react'
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiChevronRight,
  FiClock,
  FiInfo,
  FiLock,
  FiMinus,
} from 'react-icons/fi'

export type CrmTone = 'neutral' | 'amber' | 'success' | 'warning' | 'danger' | 'info'

const badgeTone: Record<CrmTone, string> = {
  neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  amber: 'bg-[#fff4c2] text-[#7a5200] border-[#f1d66b]',
  success: 'bg-[#e9f8ef] text-[#137a4f] border-[#bfe7cf]',
  warning: 'bg-[#fff3df] text-[#9b5d00] border-[#efd09d]',
  danger: 'bg-[#fff0f0] text-[#b62f3f] border-[#f3c3c8]',
  info: 'bg-[#eef4ff] text-[#2f67b4] border-[#cbdaf4]',
}

export function CrmBadge({
  children,
  tone = 'neutral',
  dot = false,
}: {
  children: ReactNode
  tone?: CrmTone
  dot?: boolean
}) {
  const dotClass = {
    neutral: 'bg-slate-400',
    amber: 'bg-[var(--crm-accent)]',
    success: 'bg-[var(--crm-success)]',
    warning: 'bg-[var(--crm-warning)]',
    danger: 'bg-[var(--crm-danger)]',
    info: 'bg-[var(--crm-info)]',
  }[tone]

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none ${badgeTone[tone]}`}>
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />}
      {children}
    </span>
  )
}

export function CrmButton({
  children,
  variant = 'secondary',
  size = 'md',
  disabled,
  type = 'button',
  onClick,
  className = '',
}: {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  disabled?: boolean
  type?: 'button' | 'submit'
  onClick?: () => void
  className?: string
}) {
  const variants = {
    primary: 'bg-[#ffca18] text-[#111827] border-[#e8b800] hover:bg-[#ffd642] hover:text-[#111827] shadow-sm',
    secondary: 'bg-white text-[#1f2937] border-[#d8dee5] hover:bg-[#f7f9fb] hover:text-[#111827]',
    ghost: 'bg-transparent text-[#475569] border-transparent hover:bg-[#eef2f5] hover:text-[#111827]',
    danger: 'bg-[#d9364f] text-white border-[#c42e45] hover:bg-[#bb293f] hover:text-white',
  }
  const sizes = {
    sm: 'h-8 px-3 text-[11px] rounded-lg',
    md: 'h-9 px-3.5 text-xs rounded-lg',
  }

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 border font-bold leading-none transition-colors focus-visible:ring-2 focus-visible:ring-[#ffca18]/35 disabled:cursor-not-allowed disabled:opacity-45 ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  )
}

export function CrmPageHeader({
  eyebrow,
  title,
  description,
  actions,
  context,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  context?: ReactNode
}) {
  return (
    <header className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
            {eyebrow}
          </div>
        )}
        <h1 className="text-[26px] font-semibold tracking-[-0.025em] text-[var(--crm-text)] md:text-[30px]">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-3xl text-sm leading-6 text-[var(--crm-text-muted)]">
            {description}
          </p>
        )}
        {context && <div className="mt-3 flex flex-wrap items-center gap-2">{context}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

export function CrmCard({
  children,
  title,
  description,
  action,
  className = '',
  padding = 'md',
}: {
  children: ReactNode
  title?: string
  description?: string
  action?: ReactNode
  className?: string
  padding?: 'none' | 'sm' | 'md'
}) {
  const paddingClass = padding === 'none' ? '' : padding === 'sm' ? 'p-3.5' : 'p-4'
  return (
    <section className={`crm-card overflow-hidden ${className}`}>
      {(title || description || action) && (
        <div className="flex items-start justify-between gap-4 border-b border-[var(--crm-border)] px-4 py-3.5">
          <div>
            {title && <h2 className="text-sm font-semibold text-slate-900">{title}</h2>}
            {description && <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={paddingClass}>{children}</div>
    </section>
  )
}

export function CrmMetricCard({
  label,
  value,
  helper,
  icon,
  tone = 'neutral',
  trend,
}: {
  label: string
  value: ReactNode
  helper?: ReactNode
  icon?: ReactNode
  tone?: CrmTone
  trend?: ReactNode
}) {
  const iconTone: Record<CrmTone, string> = {
    neutral: 'bg-slate-100 text-slate-700',
    amber: 'bg-[var(--crm-accent-soft)] text-amber-700',
    success: 'bg-[var(--crm-success-soft)] text-[var(--crm-success)]',
    warning: 'bg-[var(--crm-warning-soft)] text-[var(--crm-warning)]',
    danger: 'bg-[var(--crm-danger-soft)] text-[var(--crm-danger)]',
    info: 'bg-[var(--crm-info-soft)] text-[var(--crm-info)]',
  }

  return (
    <div className="crm-card min-h-[108px] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs font-medium text-slate-500">{label}</div>
        {icon && <div className={`grid h-9 w-9 place-items-center rounded-xl ${iconTone[tone]}`}>{icon}</div>}
      </div>
      <div className="mt-2.5 text-[23px] font-bold tracking-[-0.035em] text-slate-950">{value}</div>
      <div className="mt-2 flex min-h-5 items-center justify-between gap-3 text-xs">
        <span className="text-slate-400">{helper}</span>
        {trend && <span className="font-medium text-slate-600">{trend}</span>}
      </div>
    </div>
  )
}

export function CrmField({
  label,
  hint,
  error,
  children,
}: {
  label?: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-xs font-semibold text-slate-700">{label}</span>}
      {children}
      {(error || hint) && (
        <span className={`mt-1.5 block text-[11px] ${error ? 'text-[var(--crm-danger)]' : 'text-slate-400'}`}>
          {error || hint}
        </span>
      )}
    </label>
  )
}

export const crmInputClass =
  'h-10 w-full rounded-[11px] border border-[var(--crm-border)] bg-white px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-amber-300 focus:ring-2 focus:ring-amber-100 disabled:bg-slate-50 disabled:text-slate-400'

export function CrmFilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="crm-card flex flex-col gap-3 p-3 md:flex-row md:items-center">
      {children}
    </div>
  )
}

export function CrmTableFrame({
  children,
  title,
  description,
  action,
}: {
  children: ReactNode
  title?: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="crm-card overflow-hidden">
      {(title || description || action) && (
        <div className="flex items-center justify-between gap-4 border-b border-[var(--crm-border)] px-5 py-4">
          <div>
            {title && <div className="text-sm font-semibold text-slate-900">{title}</div>}
            {description && <div className="mt-1 text-xs text-slate-500">{description}</div>}
          </div>
          {action}
        </div>
      )}
      <div className="crm-scrollbar overflow-x-auto">{children}</div>
    </div>
  )
}

export const crmTableClass = 'w-full border-collapse text-left'
export const crmThClass =
  'whitespace-nowrap border-b border-[var(--crm-border)] bg-[#fafbf9] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400'
export const crmTdClass =
  'border-b border-[var(--crm-border)] px-4 py-3.5 text-sm text-slate-700'

export function CrmTabs({
  items,
  active,
  onChange,
  variant = 'pill',
}: {
  items: Array<{ id: string; label: string; count?: number }>
  active: string
  onChange: (id: string) => void
  variant?: 'pill' | 'underline'
}) {
  if (variant === 'underline') {
    return (
      <div className="crm-scrollbar flex max-w-full gap-6 overflow-x-auto border-b border-[var(--crm-border)]">
        {items.map(item => {
          const selected = item.id === active
          return (
            <button
              type="button"
              key={item.id}
              onClick={() => onChange(item.id)}
              className={`relative flex h-10 items-center gap-1.5 whitespace-nowrap px-0.5 text-[11px] font-semibold transition-colors ${
                selected ? 'text-slate-950' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {item.label}
              {typeof item.count === 'number' && (
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${selected ? 'bg-[#fff2b2] text-[#7a5200]' : 'bg-slate-100 text-slate-500'}`}>
                  {item.count}
                </span>
              )}
              {selected && <span className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-[#ffca18]" />}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="inline-flex max-w-full gap-1 overflow-x-auto rounded-lg border border-[var(--crm-border)] bg-white p-1">
      {items.map(item => {
        const selected = item.id === active
        return (
          <button
            type="button"
            key={item.id}
            onClick={() => onChange(item.id)}
            className={`flex h-8 items-center gap-2 whitespace-nowrap rounded-md px-3 text-[11px] font-semibold transition-colors ${
              selected
                ? 'bg-[#17212a] text-white'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            {item.label}
            {typeof item.count === 'number' && (
              <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${selected ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'}`}>
                {item.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function CrmState({
  type,
  title,
  description,
  action,
}: {
  type: 'loading' | 'empty' | 'error' | 'permission'
  title?: string
  description?: string
  action?: ReactNode
}) {
  const config = {
    loading: {
      icon: <FiClock size={21} className="animate-pulse" />,
      title: title || 'Loading operational data',
      tone: 'bg-slate-100 text-slate-500',
    },
    empty: {
      icon: <FiMinus size={21} />,
      title: title || 'No records found',
      tone: 'bg-slate-100 text-slate-500',
    },
    error: {
      icon: <FiAlertTriangle size={21} />,
      title: title || 'Unable to load this view',
      tone: 'bg-[var(--crm-danger-soft)] text-[var(--crm-danger)]',
    },
    permission: {
      icon: <FiLock size={21} />,
      title: title || 'Permission required',
      tone: 'bg-[var(--crm-warning-soft)] text-[var(--crm-warning)]',
    },
  }[type]

  return (
    <div className="crm-card flex min-h-[220px] flex-col items-center justify-center px-6 py-10 text-center">
      <div className={`grid h-11 w-11 place-items-center rounded-2xl ${config.tone}`}>{config.icon}</div>
      <h3 className="mt-4 text-sm font-semibold text-slate-900">{config.title}</h3>
      {description && <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function CrmTimeline({
  items,
}: {
  items: Array<{
    id: string
    title: string
    description?: string
    time?: string
    tone?: CrmTone
  }>
}) {
  return (
    <ol className="space-y-0">
      {items.map((item, index) => {
        const tone = item.tone || 'neutral'
        const dotClass = {
          neutral: 'bg-slate-400',
          amber: 'bg-[var(--crm-accent)]',
          success: 'bg-[var(--crm-success)]',
          warning: 'bg-[var(--crm-warning)]',
          danger: 'bg-[var(--crm-danger)]',
          info: 'bg-[var(--crm-info)]',
        }[tone]

        return (
          <li key={item.id} className="relative grid grid-cols-[20px_minmax(0,1fr)] gap-3 pb-5 last:pb-0">
            {index < items.length - 1 && <span className="absolute left-[5px] top-3 h-full w-px bg-slate-200" />}
            <span className={`relative mt-1 h-[11px] w-[11px] rounded-full ring-4 ring-white ${dotClass}`} />
            <div className="min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="text-sm font-semibold text-slate-800">{item.title}</div>
                {item.time && <div className="shrink-0 text-[10px] text-slate-400">{item.time}</div>}
              </div>
              {item.description && <p className="mt-1 text-xs leading-5 text-slate-500">{item.description}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export function CrmFinanceCard({
  title,
  amount,
  currency,
  status,
  detail,
}: {
  title: string
  amount: string
  currency?: string
  status?: ReactNode
  detail?: string
}) {
  return (
    <div className="crm-card p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-slate-500">{title}</span>
        {status}
      </div>
      <div className="mt-3 flex items-end gap-2">
        {currency && <span className="pb-1 text-xs font-bold text-slate-400">{currency}</span>}
        <span className="text-2xl font-semibold tracking-[-0.03em] text-slate-950">{amount}</span>
      </div>
      {detail && <p className="mt-2 text-xs text-slate-400">{detail}</p>}
    </div>
  )
}

export function CrmRiskCard({
  level,
  title,
  description,
  action,
}: {
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  title: string
  description?: string
  action?: ReactNode
}) {
  const tone: CrmTone =
    level === 'LOW' ? 'success' :
    level === 'MEDIUM' ? 'warning' :
    level === 'HIGH' || level === 'CRITICAL' ? 'danger' : 'neutral'

  return (
    <div className="crm-card p-4">
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${badgeTone[tone]}`}>
          {level === 'LOW' ? <FiCheckCircle size={17} /> : level === 'MEDIUM' ? <FiInfo size={17} /> : <FiAlertTriangle size={17} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
            <CrmBadge tone={tone}>{level}</CrmBadge>
          </div>
          {description && <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>}
          {action && <div className="mt-3">{action}</div>}
        </div>
      </div>
    </div>
  )
}

export function CrmInlineLink({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
      {children}
      <FiChevronRight size={12} />
    </span>
  )
}
