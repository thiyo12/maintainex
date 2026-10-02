'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  FiAlertTriangle,
  FiBriefcase,
  FiCreditCard,
  FiHome,
  FiSearch,
  FiTool,
  FiUser,
  FiUsers,
  FiX,
} from 'react-icons/fi'

interface SearchUser { id: string; name: string; email: string; mxId?: string | null; role: string; isSuspended: boolean; isBanned: boolean; countryCode?: string | null }
interface SearchCompany { id: string; companyName: string; mxId?: string | null; verificationStatus: string; countryCode?: string | null }
interface SearchJob { id: string; title: string; status: string; createdAt: string; countryCode?: string | null }
interface SearchDispute { id: string; jobId: string; reason: string; status: string; countryCode: string; createdAt: string }
interface SearchPayment { id: string; jobId: string; jobTitle?: string | null; merchantOrderId: string; paymentId?: string | null; gateway: string; amount: string; currency: string; status: string; countryCode?: string | null; createdAt: string }
interface SearchListing { id: string; title: string; status: string; propertyType: string; purpose: string; priceLkr: number; countryCode: string; district?: string | null; city?: string | null; createdAt: string }

interface SearchPayload {
  results?: {
    users?: SearchUser[]
    companies?: SearchCompany[]
    jobs?: SearchJob[]
    disputes?: SearchDispute[]
    payments?: SearchPayment[]
    listings?: SearchListing[]
  }
}

export default function CrmGlobalSearch({ market = 'ALL' }: { market?: string }) {
  const [query, setQuery] = useState('')
  const [payload, setPayload] = useState<SearchPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        wrapperRef.current?.querySelector('input')?.focus()
        setOpen(true)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setPayload(null)
      setLoading(false)
      return
    }
    const timer = window.setTimeout(async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/admin/search?q=${encodeURIComponent(trimmed)}&type=all&pageSize=15&market=${encodeURIComponent(market)}`, {
          credentials: 'include',
          cache: 'no-store',
        })
        setPayload(response.ok ? await response.json() : null)
      } catch {
        setPayload(null)
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => window.clearTimeout(timer)
  }, [query, market])

  const groups = payload?.results || {}
  const users = groups.users || []
  const companies = groups.companies || []
  const jobs = groups.jobs || []
  const disputes = groups.disputes || []
  const payments = groups.payments || []
  const listings = groups.listings || []
  const hasResults = users.length + companies.length + jobs.length + disputes.length + payments.length + listings.length > 0

  const close = () => setOpen(false)

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="flex h-10 items-center gap-2 rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface-soft)] px-3 text-slate-400 transition focus-within:border-amber-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-amber-100">
        <FiSearch size={17} />
        <input
          aria-label="Global CRM search"
          value={query}
          onChange={event => { setQuery(event.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Search jobs, people, companies, disputes, payments, listings..."
          className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
        />
        {query ? (
          <button type="button" onClick={() => { setQuery(''); setPayload(null) }} className="rounded p-1 text-slate-400 hover:text-slate-700" aria-label="Clear search">
            <FiX size={14} />
          </button>
        ) : (
          <span className="hidden rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-400 sm:inline">⌘K</span>
        )}
      </div>

      {open && query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-[var(--crm-radius-lg)] border border-[var(--crm-border)] bg-white shadow-[var(--crm-shadow-float)]">
          <div className="flex items-center justify-between border-b border-[var(--crm-border)] px-4 py-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Permission-aware global search</div>
              <div className="mt-0.5 text-sm text-slate-700">Results for “{query.trim()}”</div>
            </div>
            {loading && <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />}
          </div>

          {!loading && !hasResults ? (
            <div className="p-7 text-center">
              <FiSearch className="mx-auto text-slate-300" size={26} />
              <div className="mt-2 text-sm font-medium text-slate-700">No visible matching CRM records</div>
              <div className="mt-1 text-xs text-slate-400">Results are capped and filtered by your permissions and market scope.</div>
            </div>
          ) : (
            <div className="max-h-[520px] overflow-y-auto py-2">
              {jobs.length > 0 && <SearchSection title="Jobs" icon={FiTool}>{jobs.map(job => (
                <ResultLink key={job.id} href={`/admin/jobs/${job.id}`} title={job.title} subtitle={job.id} badge={job.status} onClick={close} />
              ))}</SearchSection>}

              {users.length > 0 && <SearchSection title="People" icon={FiUsers}>{users.map(user => (
                <ResultLink key={user.id} href={`/admin/users/${user.id}`} title={user.name} subtitle={user.mxId || user.email} badge={user.role} onClick={close} icon={<FiUser size={14} />} />
              ))}</SearchSection>}

              {companies.length > 0 && <SearchSection title="Companies" icon={FiBriefcase}>{companies.map(company => (
                <ResultLink key={company.id} href={`/admin/companies/${company.id}`} title={company.companyName} subtitle={company.mxId || company.id} badge={company.verificationStatus} onClick={close} />
              ))}</SearchSection>}

              {disputes.length > 0 && <SearchSection title="Disputes" icon={FiAlertTriangle}>{disputes.map(dispute => (
                <ResultLink key={dispute.id} href={`/admin/jobs/disputes?search=${encodeURIComponent(dispute.id)}`} title={dispute.reason} subtitle={`${dispute.id} · job ${dispute.jobId}`} badge={dispute.status} onClick={close} />
              ))}</SearchSection>}

              {payments.length > 0 && <SearchSection title="Payments" icon={FiCreditCard}>{payments.map(payment => (
                <ResultLink key={payment.id} href={`/admin/financial?search=${encodeURIComponent(payment.id)}`} title={payment.jobTitle || payment.merchantOrderId} subtitle={`${payment.currency} ${formatMinor(payment.amount)} · ${payment.gateway}`} badge={payment.status} onClick={close} />
              ))}</SearchSection>}

              {listings.length > 0 && <SearchSection title="Real Estate" icon={FiHome}>{listings.map(listing => (
                <ResultLink key={listing.id} href={`/admin/real-estate?q=${encodeURIComponent(listing.id)}`} title={listing.title} subtitle={`${listing.propertyType} · ${listing.city || listing.district || listing.countryCode}`} badge={listing.status} onClick={close} />
              ))}</SearchSection>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ResultLink({ href, title, subtitle, badge, icon, onClick }: { href: string; title: string; subtitle: string; badge: string; icon?: React.ReactNode; onClick: () => void }) {
  return (
    <Link href={href} onClick={onClick} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-[var(--crm-surface-soft)]">
      <div className="flex min-w-0 items-center gap-3">
        {icon && <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">{icon}</div>}
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-slate-800">{title}</div>
          <div className="truncate text-xs text-slate-400">{subtitle}</div>
        </div>
      </div>
      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] text-slate-600">{badge.replaceAll('_', ' ')}</span>
    </Link>
  )
}

function SearchSection({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <section className="py-1">
      <div className="flex items-center gap-2 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        <Icon size={13} />
        {title}
      </div>
      {children}
    </section>
  )
}

function formatMinor(value: string) {
  try {
    return (Number(BigInt(value)) / 100).toLocaleString()
  } catch {
    return value
  }
}
