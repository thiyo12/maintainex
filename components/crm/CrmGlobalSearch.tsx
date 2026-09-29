'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { FiBriefcase, FiSearch, FiTool, FiUser, FiUsers, FiX } from 'react-icons/fi'

interface SearchUser {
  id: string
  name: string
  email: string
  mxId?: string | null
  role: string
  isSuspended: boolean
  isBanned: boolean
  countryCode?: string | null
}

interface SearchCompany {
  id: string
  companyName: string
  mxId?: string | null
  verificationStatus: string
  countryCode?: string | null
}

interface SearchJob {
  id: string
  title: string
  status: string
  createdAt: string
  countryCode?: string | null
}

interface SearchPayload {
  results?: {
    users?: SearchUser[]
    companies?: SearchCompany[]
    jobs?: SearchJob[]
  }
}

export default function CrmGlobalSearch() {
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
        const input = wrapperRef.current?.querySelector('input')
        input?.focus()
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
        const response = await fetch(`/api/admin/search?q=${encodeURIComponent(trimmed)}&type=all&pageSize=15`, {
          credentials: 'include',
        })
        if (!response.ok) {
          setPayload(null)
          return
        }
        setPayload(await response.json())
      } catch {
        setPayload(null)
      } finally {
        setLoading(false)
      }
    }, 250)

    return () => window.clearTimeout(timer)
  }, [query])

  const users = payload?.results?.users || []
  const companies = payload?.results?.companies || []
  const jobs = payload?.results?.jobs || []
  const hasResults = users.length + companies.length + jobs.length > 0

  function close() {
    setOpen(false)
  }

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="h-10 rounded-xl border border-slate-200 bg-slate-50 flex items-center px-3 gap-2 text-slate-400 focus-within:border-amber-300 focus-within:ring-2 focus-within:ring-amber-100 transition">
        <FiSearch size={17} />
        <input
          aria-label="Global CRM search"
          value={query}
          onChange={event => {
            setQuery(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search jobs, customers, taskers, companies..."
          className="w-full bg-transparent outline-none text-sm text-slate-700 placeholder:text-slate-400"
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setPayload(null)
            }}
            className="p-1 rounded text-slate-400 hover:text-slate-700"
            aria-label="Clear search"
          >
            <FiX size={14} />
          </button>
        ) : (
          <span className="hidden sm:inline text-[10px] border border-slate-200 bg-white px-1.5 py-0.5 rounded text-slate-400">⌘K</span>
        )}
      </div>

      {open && query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-12 z-50 rounded-2xl border border-slate-200 bg-white shadow-[0_24px_70px_-20px_rgba(15,23,42,0.35)] overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Global search</div>
              <div className="text-sm text-slate-700 mt-0.5">Results for “{query.trim()}”</div>
            </div>
            {loading && <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />}
          </div>

          {!loading && !hasResults ? (
            <div className="p-7 text-center">
              <FiSearch className="mx-auto text-slate-300" size={26} />
              <div className="mt-2 text-sm font-medium text-slate-700">No matching CRM records</div>
              <div className="text-xs text-slate-400 mt-1">Try a job ID, MX ID, name, email or company name.</div>
            </div>
          ) : (
            <div className="max-h-[430px] overflow-y-auto py-2">
              {jobs.length > 0 && (
                <SearchSection title="Jobs" icon={FiTool}>
                  {jobs.map(job => (
                    <Link
                      key={job.id}
                      href={`/admin/jobs/${job.id}`}
                      onClick={close}
                      className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-800 truncate">{job.title}</div>
                        <div className="text-xs text-slate-400 font-mono truncate">{job.id}</div>
                      </div>
                      <span className="text-[10px] px-2 py-1 rounded-full bg-slate-100 text-slate-600">{job.status.replaceAll('_', ' ')}</span>
                    </Link>
                  ))}
                </SearchSection>
              )}

              {users.length > 0 && (
                <SearchSection title="People" icon={FiUsers}>
                  {users.map(user => (
                    <Link
                      key={user.id}
                      href={`/admin/users/${user.id}`}
                      onClick={close}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-slate-50"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                          <FiUser size={14} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-800 truncate">{user.name}</div>
                          <div className="text-xs text-slate-400 truncate">{user.mxId || user.email}</div>
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-1 rounded-full bg-blue-50 text-blue-700">{user.role}</span>
                    </Link>
                  ))}
                </SearchSection>
              )}

              {companies.length > 0 && (
                <SearchSection title="Companies" icon={FiBriefcase}>
                  {companies.map(company => (
                    <Link
                      key={company.id}
                      href={`/admin/companies/${company.id}`}
                      onClick={close}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-800 truncate">{company.companyName}</div>
                        <div className="text-xs text-slate-400 truncate">{company.mxId || company.id}</div>
                      </div>
                      <span className="text-[10px] px-2 py-1 rounded-full bg-violet-50 text-violet-700">{company.verificationStatus}</span>
                    </Link>
                  ))}
                </SearchSection>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SearchSection({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: any
  children: React.ReactNode
}) {
  return (
    <section className="py-1">
      <div className="px-4 py-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        <Icon size={13} />
        {title}
      </div>
      {children}
    </section>
  )
}
