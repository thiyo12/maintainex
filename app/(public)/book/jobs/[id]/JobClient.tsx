'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { marketplaceWebFetch } from '@/lib/auth/web-marketplace-client'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  CreditCard,
  Loader2,
  MapPin,
  MessageSquareText,
  RefreshCw,
  ShieldCheck,
  Star,
  UserRound,
} from 'lucide-react'

type Quote = {
  id: string
  providerId: string
  providerType: 'INDIVIDUAL' | 'COMPANY'
  price: number
  currency?: string
  status: string
  message?: string | null
  estimatedCompletionTime?: string | null
  providerRating?: number
  completedJobs?: number
  provider?: {
    id: string
    name?: string | null
    profileImage?: string | null
  } | null
}

type JobPayload = {
  job: {
    id: string
    title: string
    description: string
    status: string
    countryCode: string
    budgetType: string
    budgetAmount: number | null
    preferredDate: string | null
    preferredTimeSlot: string | null
    locationName: string | null
    quotes: Quote[]
    acceptedQuote?: (Quote & { provider?: any }) | null
    escrow?: {
      status: string
      amount: number
      totalAmount: number
      currency?: string
    } | null
  }
}

type PaymentPayload = {
  payment: {
    id: string
    status: string
    amount: number
    currency: string
    merchantOrderId?: string | null
    createdAt: string
    paidAt?: string | null
  } | null
}

const TERMINAL_JOB_STATES = new Set([
  'COMPLETED',
  'CANCELLED',
  'DISPUTED',
])

export default function JobClient({ jobId }: { jobId: string }) {
  const [job, setJob] = useState<JobPayload['job'] | null>(null)
  const [payment, setPayment] = useState<PaymentPayload['payment']>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionBusy, setActionBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError('')
    try {
      const [jobResponse, paymentResponse] = await Promise.all([
        marketplaceWebFetch(`/api/web/jobs/${encodeURIComponent(jobId)}`),
        marketplaceWebFetch(`/api/web/jobs/${encodeURIComponent(jobId)}/payment`),
      ])

      const jobBody = await jobResponse.json().catch(() => ({}))
      if (!jobResponse.ok) {
        throw new Error(jobBody?.error || 'Unable to load booking')
      }

      const paymentBody = await paymentResponse.json().catch(() => ({}))
      setJob(jobBody.job || null)
      setPayment(paymentResponse.ok ? paymentBody.payment || null : null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load booking')
    } finally {
      setLoading(false)
    }
  }, [jobId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!job || TERMINAL_JOB_STATES.has(job.status)) return

    const timer = window.setInterval(() => {
      load()
    }, 20_000)

    return () => window.clearInterval(timer)
  }, [job, load])

  const quotes = useMemo(
    () => [...(job?.quotes || [])].sort((a, b) => Number(a.price) - Number(b.price)),
    [job?.quotes]
  )

  const acceptQuote = async (quoteId: string) => {
    setActionBusy(`quote:${quoteId}`)
    setError('')
    try {
      const response = await marketplaceWebFetch(
        `/api/web/jobs/${encodeURIComponent(jobId)}/select-quote`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quoteId }),
        }
      )
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body?.error || 'Unable to accept quote')
      await load()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to accept quote')
    } finally {
      setActionBusy(null)
    }
  }

  const startPayment = async () => {
    setActionBusy('payment')
    setError('')
    try {
      const response = await marketplaceWebFetch(
        `/api/web/jobs/${encodeURIComponent(jobId)}/payment`,
        { method: 'POST' }
      )
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body?.error || 'Unable to start payment')
      if (typeof body?.checkoutUrl === 'string' && body.checkoutUrl) {
        window.location.assign(body.checkoutUrl)
        return
      }
      await load()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to start payment')
    } finally {
      setActionBusy(null)
    }
  }

  if (loading) {
    return (
      <>
        <Header />
        <main className="min-h-screen bg-[#f5f6f2] pt-16">
          <div className="mx-auto max-w-5xl px-5 py-16 sm:px-8">
            <div className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white p-6 text-sm text-slate-600 shadow-sm">
              <Loader2 size={18} className="animate-spin" />
              Loading booking…
            </div>
          </div>
        </main>
      </>
    )
  }

  if (!job) {
    return (
      <>
        <Header />
        <main className="min-h-screen bg-[#f5f6f2] pt-16">
          <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8">
            <div className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
              <h1 className="text-xl font-bold text-slate-950">Booking unavailable</h1>
              <p className="mt-2 text-sm text-red-700">{error || 'This booking could not be loaded.'}</p>
              <Link href="/book" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-amber-700">
                <ArrowLeft size={15} />
                Back to booking
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </>
    )
  }

  const accepted = job.acceptedQuote || quotes.find(quote => quote.status === 'ACCEPTED') || null
  const paymentProtected = payment?.status === 'SUCCESS' || job.escrow?.status === 'PROTECTED'
  const quoteAccepted = job.status === 'QUOTE_ACCEPTED' || Boolean(accepted)

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#f5f6f2] pt-16 text-slate-950">
        <section className="border-b border-black/5 bg-[#111315] text-white">
          <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
            <Link href="/book" className="inline-flex items-center gap-2 text-xs font-semibold text-white/55 hover:text-white">
              <ArrowLeft size={14} />
              New booking
            </Link>
            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.15em] text-amber-400">
                  Booking {job.id.slice(-8).toUpperCase()}
                </div>
                <h1 className="mt-2 text-3xl font-black tracking-[-0.04em]">{job.title}</h1>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-white/60">
                  <span>{job.countryCode}</span>
                  <span>•</span>
                  <span>{job.status.replaceAll('_', ' ')}</span>
                  {job.locationName && (
                    <>
                      <span>•</span>
                      <span>{job.locationName}</span>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={load}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 text-sm font-semibold text-white hover:bg-white/10"
              >
                <RefreshCw size={14} />
                Refresh
              </button>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-6 px-5 py-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5">
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <Card>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-600">
                    Marketplace request
                  </div>
                  <h2 className="mt-1 text-xl font-bold">Your job</h2>
                </div>
                <StatusBadge status={job.status} />
              </div>
              <p className="mt-4 whitespace-pre-line text-sm leading-6 text-slate-600">{job.description}</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <Info icon={<MapPin size={16} />} label="Location" value={job.locationName || 'Area not specified'} />
                <Info icon={<Clock3 size={16} />} label="Preferred time" value={job.preferredTimeSlot || 'Any time'} />
                <Info
                  icon={<CreditCard size={16} />}
                  label="Budget"
                  value={job.budgetAmount != null ? String(job.budgetAmount) : job.budgetType.replaceAll('_', ' ')}
                />
              </div>
            </Card>

            <Card>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-600">
                    Provider quotes
                  </div>
                  <h2 className="mt-1 text-xl font-bold">
                    {quotes.length > 0 ? `${quotes.length} quote${quotes.length === 1 ? '' : 's'} received` : 'Waiting for quotes'}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Quotes, provider eligibility and acceptance use the same marketplace workflow as the app.
                  </p>
                </div>
                <MessageSquareText size={20} className="text-slate-400" />
              </div>

              {quotes.length === 0 ? (
                <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                  Eligible providers have been notified. This page refreshes automatically while the job is active.
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  {quotes.map(quote => {
                    const isAccepted = quote.status === 'ACCEPTED'
                    return (
                      <div
                        key={quote.id}
                        className={`rounded-xl border p-4 ${
                          isAccepted ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-slate-600">
                                <UserRound size={17} />
                              </div>
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-slate-900">
                                  {quote.provider?.name || (quote.providerType === 'COMPANY' ? 'MaintainEX company' : 'MaintainEX provider')}
                                </div>
                                <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                                  <span className="inline-flex items-center gap-1">
                                    <Star size={12} className="text-amber-500" />
                                    {(quote.providerRating || 0).toFixed(1)}
                                  </span>
                                  <span>•</span>
                                  <span>{quote.completedJobs || 0} completed</span>
                                </div>
                              </div>
                            </div>
                            {quote.message && (
                              <p className="mt-3 text-sm leading-5 text-slate-600">{quote.message}</p>
                            )}
                            {quote.estimatedCompletionTime && (
                              <p className="mt-2 text-xs text-slate-500">
                                Estimate: {quote.estimatedCompletionTime}
                              </p>
                            )}
                          </div>

                          <div className="flex shrink-0 items-center gap-3">
                            <div className="text-right">
                              <div className="text-lg font-bold text-slate-950">{quote.price}</div>
                              <div className="text-[11px] uppercase text-slate-400">{job.countryCode === 'CA' ? 'CAD' : 'LKR'}</div>
                            </div>
                            {isAccepted ? (
                              <div className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-100 px-3 text-sm font-semibold text-emerald-700">
                                <CheckCircle2 size={15} />
                                Accepted
                              </div>
                            ) : !quoteAccepted && quote.status === 'PENDING' ? (
                              <button
                                onClick={() => acceptQuote(quote.id)}
                                disabled={actionBusy !== null}
                                className="inline-flex h-10 items-center gap-2 rounded-xl bg-amber-500 px-3 text-sm font-bold text-black hover:bg-amber-400 disabled:opacity-50"
                              >
                                {actionBusy === `quote:${quote.id}` && <Loader2 size={14} className="animate-spin" />}
                                Accept
                              </button>
                            ) : (
                              <StatusBadge status={quote.status} />
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <Card>
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                Payment protection
              </div>
              <div className="mt-3 flex items-center gap-3">
                <div className={`grid h-10 w-10 place-items-center rounded-xl ${
                  paymentProtected ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  <ShieldCheck size={19} />
                </div>
                <div>
                  <div className="text-sm font-semibold">
                    {paymentProtected ? 'Payment protected' : quoteAccepted ? 'Ready for payment' : 'Choose a quote first'}
                  </div>
                  <div className="text-xs text-slate-500">
                    {job.escrow?.status || payment?.status || 'Not started'}
                  </div>
                </div>
              </div>

              {quoteAccepted && !paymentProtected && (
                <button
                  onClick={startPayment}
                  disabled={actionBusy !== null}
                  className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 text-sm font-bold text-black hover:bg-amber-400 disabled:opacity-50"
                >
                  {actionBusy === 'payment' ? <Loader2 size={15} className="animate-spin" /> : <CreditCard size={15} />}
                  Continue to secure payment
                  <ArrowRight size={15} />
                </button>
              )}

              {payment && (
                <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
                  <div className="flex justify-between gap-3">
                    <span>Status</span>
                    <span className="font-semibold text-slate-700">{payment.status}</span>
                  </div>
                  <div className="mt-2 flex justify-between gap-3">
                    <span>Amount</span>
                    <span className="font-semibold text-slate-700">
                      {payment.currency} {payment.amount}
                    </span>
                  </div>
                </div>
              )}
            </Card>

            <div className="rounded-2xl bg-[#111315] p-5 text-white shadow-sm">
              <div className="text-sm font-semibold">What happens next</div>
              <div className="mt-4 space-y-3 text-sm text-white/60">
                {[
                  ['Quotes', quotes.length > 0],
                  ['Provider selected', quoteAccepted],
                  ['Payment protected', paymentProtected],
                  ['Work starts with verification', ['IN_PROGRESS', 'COMPLETED'].includes(job.status)],
                  ['Completion & review', job.status === 'COMPLETED'],
                ].map(([label, done], index) => (
                  <div key={String(label)} className="flex items-center gap-3">
                    <div className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold ${
                      done ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-amber-300'
                    }`}>
                      {done ? <CheckCircle2 size={13} /> : index + 1}
                    </div>
                    {String(label)}
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>
      </main>
      <Footer />
    </>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return <section className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm sm:p-6">{children}</section>
}

function Info({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="flex items-center gap-2 text-xs text-slate-400">
        {icon}
        {label}
      </div>
      <div className="mt-1.5 text-sm font-semibold text-slate-800">{value}</div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toUpperCase()
  const positive = ['ACCEPTED', 'SUCCESS', 'PROTECTED', 'COMPLETED'].some(value => normalized.includes(value))
  const warning = ['OPEN', 'PENDING', 'QUOTE_ACCEPTED'].some(value => normalized.includes(value))
  const tone = positive
    ? 'bg-emerald-100 text-emerald-700'
    : warning
      ? 'bg-amber-100 text-amber-700'
      : 'bg-slate-100 text-slate-600'

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${tone}`}>
      {status.replaceAll('_', ' ')}
    </span>
  )
}
