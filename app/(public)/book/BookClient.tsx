'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import { useRegion } from '@/lib/region-context'
import { marketplaceWebFetch } from '@/lib/auth/web-marketplace-client'
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  Loader2,
  LockKeyhole,
  LogOut,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react'

type SessionUser = {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  role: string
  countryCode?: string | null
  availableProfiles?: string[]
}

type SessionPayload = {
  authenticated: boolean
  user?: SessionUser
}

type TemplateJob = {
  id: string
  categoryId: string
  name: string
  description: string | null
  priceMin: number | null
  priceMax: number | null
  currency: string
  isPopular: boolean
}

type Category = {
  id: string
  name: string
  slug: string
  iconName: string | null
  colorHex: string | null
  jobs: TemplateJob[]
}

type LocationOption = {
  id: string
  label: string
}

type AuthMode = 'signin' | 'register'
type AuthStage = 'identify' | 'verify'

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function flattenLocations(payload: any, countryCode: string): LocationOption[] {
  const countries = Array.isArray(payload?.countries) ? payload.countries : []
  const country = countries.find((item: any) => String(item?.code || '').toUpperCase() === countryCode)
  if (!country) return []

  const options: LocationOption[] = []
  for (const state of Array.isArray(country.states) ? country.states : []) {
    for (const city of Array.isArray(state.cities) ? state.cities : []) {
      const areas = Array.isArray(city.areas) ? city.areas : []
      if (areas.length > 0) {
        for (const area of areas) {
          if (!area?.id) continue
          options.push({
            id: String(area.id),
            label: [area.name, city.name, state.name].filter(Boolean).join(', '),
          })
        }
      } else if (city?.id) {
        options.push({
          id: String(city.id),
          label: [city.name, state.name].filter(Boolean).join(', '),
        })
      }
    }
  }
  return options
}

export default function BookClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const region = useRegion()

  const [session, setSession] = useState<SessionPayload>({ authenticated: false })
  const [sessionLoading, setSessionLoading] = useState(true)
  const [authMode, setAuthMode] = useState<AuthMode>('signin')
  const [authStage, setAuthStage] = useState<AuthStage>('identify')
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [registerName, setRegisterName] = useState('')
  const [registerPhone, setRegisterPhone] = useState('')
  const [registerEmail, setRegisterEmail] = useState('')

  const [categories, setCategories] = useState<Category[]>([])
  const [locations, setLocations] = useState<LocationOption[]>([])
  const [catalogLoading, setCatalogLoading] = useState(false)
  const [catalogError, setCatalogError] = useState('')

  const [categoryId, setCategoryId] = useState('')
  const [templateJobId, setTemplateJobId] = useState('')
  const [areaId, setAreaId] = useState('')
  const [preferredDate, setPreferredDate] = useState('')
  const [preferredTimeSlot, setPreferredTimeSlot] = useState('anytime')
  const [budgetType, setBudgetType] = useState('REQUEST_QUOTES')
  const [budgetAmount, setBudgetAmount] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [notes, setNotes] = useState('')
  const [submitBusy, setSubmitBusy] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const defaultCountry = region.currency === 'CAD' ? 'CA' : 'LK'
  const countryCode = (session.user?.countryCode || defaultCountry).toUpperCase()

  const loadSession = useCallback(async () => {
    setSessionLoading(true)
    try {
      const response = await marketplaceWebFetch('/api/web/auth/session', {
        credentials: 'include',
        cache: 'no-store',
      })
      const body = await response.json().catch(() => ({}))
      if (response.ok) {
        setSession(body)
      } else {
        setSession({ authenticated: false })
      }
    } finally {
      setSessionLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSession()
  }, [loadSession])

  useEffect(() => {
    let cancelled = false

    async function loadMarketplaceData() {
      setCatalogLoading(true)
      setCatalogError('')
      try {
        const [catalogResponse, locationsResponse] = await Promise.all([
          fetch(`/api/web/catalog?country=${encodeURIComponent(countryCode)}`, {
            cache: 'no-store',
          }),
          fetch('/api/web/locations', { cache: 'no-store' }),
        ])

        const catalogBody = await catalogResponse.json().catch(() => [])
        const locationsBody = await locationsResponse.json().catch(() => ({}))

        if (!catalogResponse.ok) {
          throw new Error(catalogBody?.error || 'Unable to load service catalog')
        }

        if (cancelled) return
        const loadedCategories = Array.isArray(catalogBody) ? catalogBody : []
        setCategories(loadedCategories)
        setLocations(flattenLocations(locationsBody, countryCode))

        const requestedTemplate = searchParams.get('templateJobId')
        const requestedCategory = searchParams.get('categoryId')
        const requestedService = searchParams.get('service')

        let selectedCategory: Category | undefined
        let selectedJob: TemplateJob | undefined

        if (requestedTemplate) {
          for (const category of loadedCategories) {
            const found = category.jobs?.find((job: TemplateJob) => job.id === requestedTemplate)
            if (found) {
              selectedCategory = category
              selectedJob = found
              break
            }
          }
        }

        if (!selectedCategory && requestedCategory) {
          selectedCategory = loadedCategories.find((category: Category) => category.id === requestedCategory)
        }

        if (!selectedJob && requestedService) {
          const wanted = normalize(requestedService)
          for (const category of loadedCategories) {
            const exact = category.jobs?.find((job: TemplateJob) => normalize(job.name) === wanted)
            const fuzzy = category.jobs?.find((job: TemplateJob) => {
              const candidate = normalize(job.name)
              return candidate.includes(wanted) || wanted.includes(candidate)
            })
            if (exact || fuzzy) {
              selectedCategory = category
              selectedJob = exact || fuzzy
              break
            }
          }
        }

        if (!selectedCategory && loadedCategories.length > 0) {
          selectedCategory = loadedCategories[0]
        }

        if (selectedCategory) {
          setCategoryId(selectedCategory.id)
          const chosen =
            selectedJob && selectedJob.categoryId === selectedCategory.id
              ? selectedJob
              : selectedCategory.jobs?.[0]
          setTemplateJobId(chosen?.id || '')
        }
      } catch (error) {
        if (!cancelled) {
          setCatalogError(error instanceof Error ? error.message : 'Unable to load booking data')
        }
      } finally {
        if (!cancelled) setCatalogLoading(false)
      }
    }

    loadMarketplaceData()
    return () => {
      cancelled = true
    }
  }, [countryCode, searchParams])

  const selectedCategory = useMemo(
    () => categories.find(category => category.id === categoryId) || null,
    [categories, categoryId]
  )

  const selectedJob = useMemo(
    () => selectedCategory?.jobs?.find(job => job.id === templateJobId) || null,
    [selectedCategory, templateJobId]
  )

  const requestLoginOtp = async () => {
    setAuthError('')
    const value = identifier.trim()
    if (!value) {
      setAuthError('Enter your email or mobile number.')
      return
    }

    setAuthBusy(true)
    try {
      const payload = value.includes('@') ? { email: value } : { phone: value }
      const response = await fetch('/api/web/auth/otp-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body?.error || 'Unable to send verification code')
      setAuthStage('verify')
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unable to send verification code')
    } finally {
      setAuthBusy(false)
    }
  }

  const verifyLoginOtp = async () => {
    setAuthError('')
    if (!/^\d{6}$/.test(otpCode.trim())) {
      setAuthError('Enter the 6-digit verification code.')
      return
    }

    setAuthBusy(true)
    try {
      const value = identifier.trim()
      const payload = value.includes('@')
        ? { email: value, code: otpCode.trim() }
        : { phone: value, code: otpCode.trim() }

      const response = await fetch('/api/web/auth/otp-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body?.error || 'Verification failed')
      setOtpCode('')
      setAuthStage('identify')
      await loadSession()
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Verification failed')
    } finally {
      setAuthBusy(false)
    }
  }

  const registerCustomer = async () => {
    setAuthError('')
    if (registerName.trim().length < 2) {
      setAuthError('Enter your full name.')
      return
    }
    if (registerPhone.replace(/\D/g, '').length < 7) {
      setAuthError('Enter a valid mobile number.')
      return
    }

    setAuthBusy(true)
    try {
      const response = await fetch('/api/web/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          role: 'CUSTOMER',
          name: registerName.trim(),
          phone: registerPhone.trim(),
          email: registerEmail.trim() || undefined,
          countryCode: defaultCountry,
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body?.error || 'Registration failed')
      setIdentifier(registerPhone.trim())
      setAuthStage('verify')
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Registration failed')
    } finally {
      setAuthBusy(false)
    }
  }

  const verifyRegistration = async () => {
    setAuthError('')
    if (!/^\d{6}$/.test(otpCode.trim())) {
      setAuthError('Enter the 6-digit verification code.')
      return
    }

    setAuthBusy(true)
    try {
      const response = await fetch('/api/web/auth/verify-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          phone: registerPhone.trim() || identifier.trim(),
          code: otpCode.trim(),
          purpose: 'PHONE_VERIFICATION',
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body?.error || 'Verification failed')
      setOtpCode('')
      setAuthStage('identify')
      await loadSession()
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Verification failed')
    } finally {
      setAuthBusy(false)
    }
  }

  const logout = async () => {
    await fetch('/api/web/auth/logout', {
      method: 'POST',
      credentials: 'include',
    }).catch(() => undefined)
    setSession({ authenticated: false })
  }

  const createJob = async () => {
    setSubmitError('')
    if (!session.authenticated || !session.user) {
      setSubmitError('Sign in before creating a booking.')
      return
    }
    if (!selectedCategory || !selectedJob) {
      setSubmitError('Choose a service.')
      return
    }
    if (!preferredDate) {
      setSubmitError('Choose your preferred date.')
      return
    }

    setSubmitBusy(true)
    try {
      const descriptionParts = [
        selectedJob.description || `Service request for ${selectedJob.name}`,
        notes.trim() ? `Customer notes: ${notes.trim()}` : '',
      ].filter(Boolean)

      const payload: Record<string, unknown> = {
        title: selectedJob.name,
        description: descriptionParts.join('\n\n'),
        categoryId: selectedCategory.id,
        templateJobId: selectedJob.id,
        budgetType,
        areaId: areaId || undefined,
        postalCode: postalCode.trim() || undefined,
        preferredDate,
        preferredTimeSlot,
        countryCode,
        urgency: 'normal',
        smartBookingJson: {
          source: 'WEB',
          locationLabel: locations.find(location => location.id === areaId)?.label || null,
        },
      }

      if (budgetAmount.trim()) {
        payload.budgetAmount = budgetAmount.trim()
      }

      const response = await marketplaceWebFetch('/api/web/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `web-job:${session.user.id}:${crypto.randomUUID()}`,
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (response.status === 401) {
          setSession({ authenticated: false })
        }
        throw new Error(body?.error || 'Unable to create booking')
      }

      const jobId = body?.job?.id
      if (!jobId) throw new Error('Booking was created but no job reference was returned')
      router.push(`/book/jobs/${encodeURIComponent(jobId)}`)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to create booking')
    } finally {
      setSubmitBusy(false)
    }
  }

  const minDate = new Date().toISOString().split('T')[0]

  return (
    <>
      <Header />
      <main className="min-h-screen bg-[#f5f6f2] pt-16 text-slate-950">
        <section className="border-b border-black/5 bg-[#111315] text-white">
          <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:py-14">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-400">
              <Sparkles size={14} />
              MaintainEX web booking
            </div>
            <h1 className="mt-3 max-w-3xl text-3xl font-black tracking-[-0.04em] sm:text-5xl">
              Book through the same marketplace as the app.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/65 sm:text-base">
              One account, one service catalog, one quote flow and the same protected payment lifecycle.
            </p>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-6 px-5 py-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:py-10">
          <div className="space-y-5">
            {sessionLoading ? (
              <Card>
                <div className="flex items-center gap-3 text-sm text-slate-600">
                  <Loader2 className="animate-spin" size={18} />
                  Checking your MaintainEX session…
                </div>
              </Card>
            ) : !session.authenticated ? (
              <Card>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-600">
                      Step 1
                    </div>
                    <h2 className="mt-1 text-xl font-bold">Sign in or create an account</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      We use one-time verification codes. Your access token stays in an HttpOnly cookie.
                    </p>
                  </div>
                  <LockKeyhole className="text-slate-400" size={20} />
                </div>

                <div className="mt-5 flex rounded-xl bg-slate-100 p-1">
                  {(['signin', 'register'] as AuthMode[]).map(mode => (
                    <button
                      key={mode}
                      onClick={() => {
                        setAuthMode(mode)
                        setAuthStage('identify')
                        setOtpCode('')
                        setAuthError('')
                      }}
                      className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                        authMode === mode ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'
                      }`}
                    >
                      {mode === 'signin' ? 'Sign in' : 'Create account'}
                    </button>
                  ))}
                </div>

                {authMode === 'signin' ? (
                  <div className="mt-5 space-y-4">
                    {authStage === 'identify' ? (
                      <>
                        <Field label="Email or mobile number">
                          <input
                            value={identifier}
                            onChange={event => setIdentifier(event.target.value)}
                            className={inputClass}
                            placeholder="you@example.com or +94…"
                            autoComplete="username"
                          />
                        </Field>
                        <PrimaryButton onClick={requestLoginOtp} busy={authBusy}>
                          Send verification code
                        </PrimaryButton>
                      </>
                    ) : (
                      <>
                        <Field label="6-digit verification code">
                          <input
                            value={otpCode}
                            onChange={event => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                            className={inputClass}
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            placeholder="000000"
                          />
                        </Field>
                        <div className="flex gap-2">
                          <button
                            className={secondaryButtonClass}
                            onClick={() => setAuthStage('identify')}
                          >
                            <ArrowLeft size={15} />
                            Back
                          </button>
                          <PrimaryButton onClick={verifyLoginOtp} busy={authBusy}>
                            Verify & sign in
                          </PrimaryButton>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="mt-5 space-y-4">
                    {authStage === 'identify' ? (
                      <>
                        <Field label="Full name">
                          <input
                            value={registerName}
                            onChange={event => setRegisterName(event.target.value)}
                            className={inputClass}
                            autoComplete="name"
                          />
                        </Field>
                        <Field label="Mobile number">
                          <input
                            value={registerPhone}
                            onChange={event => setRegisterPhone(event.target.value)}
                            className={inputClass}
                            autoComplete="tel"
                            placeholder={region.phoneExample}
                          />
                        </Field>
                        <Field label="Email (optional)">
                          <input
                            value={registerEmail}
                            onChange={event => setRegisterEmail(event.target.value)}
                            className={inputClass}
                            autoComplete="email"
                            type="email"
                          />
                        </Field>
                        <PrimaryButton onClick={registerCustomer} busy={authBusy}>
                          Create customer account
                        </PrimaryButton>
                      </>
                    ) : (
                      <>
                        <Field label="6-digit mobile verification code">
                          <input
                            value={otpCode}
                            onChange={event => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                            className={inputClass}
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            placeholder="000000"
                          />
                        </Field>
                        <div className="flex gap-2">
                          <button
                            className={secondaryButtonClass}
                            onClick={() => setAuthStage('identify')}
                          >
                            <ArrowLeft size={15} />
                            Back
                          </button>
                          <PrimaryButton onClick={verifyRegistration} busy={authBusy}>
                            Verify account
                          </PrimaryButton>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {authError && <ErrorMessage>{authError}</ErrorMessage>}
              </Card>
            ) : (
              <>
                <Card>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-xl bg-amber-100 text-amber-700">
                        <UserRound size={18} />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{session.user?.name || 'MaintainEX customer'}</div>
                        <div className="text-xs text-slate-500">
                          {session.user?.phone || session.user?.email} · {countryCode}
                        </div>
                      </div>
                    </div>
                    <button onClick={logout} className={secondaryButtonClass}>
                      <LogOut size={14} />
                      Sign out
                    </button>
                  </div>
                </Card>

                <Card>
                  <StepHeader
                    step="Step 2"
                    title="Choose the work you need"
                    description="This catalog is the same canonical taxonomy consumed by the mobile app."
                  />

                  {catalogLoading ? (
                    <div className="mt-5 flex items-center gap-3 text-sm text-slate-500">
                      <Loader2 size={17} className="animate-spin" />
                      Loading marketplace catalog…
                    </div>
                  ) : catalogError ? (
                    <ErrorMessage>{catalogError}</ErrorMessage>
                  ) : (
                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <Field label="Category">
                        <div className="relative">
                          <select
                            value={categoryId}
                            onChange={event => {
                              const next = event.target.value
                              setCategoryId(next)
                              const category = categories.find(item => item.id === next)
                              setTemplateJobId(category?.jobs?.[0]?.id || '')
                            }}
                            className={inputClass}
                          >
                            {categories.map(category => (
                              <option key={category.id} value={category.id}>{category.name}</option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-3 top-3 text-slate-400" size={16} />
                        </div>
                      </Field>

                      <Field label="Service">
                        <div className="relative">
                          <select
                            value={templateJobId}
                            onChange={event => setTemplateJobId(event.target.value)}
                            className={inputClass}
                          >
                            {(selectedCategory?.jobs || []).map(job => (
                              <option key={job.id} value={job.id}>{job.name}</option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-3 top-3 text-slate-400" size={16} />
                        </div>
                      </Field>
                    </div>
                  )}

                  {selectedJob && (
                    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <div className="font-semibold text-slate-900">{selectedJob.name}</div>
                      <div className="mt-1 text-sm leading-5 text-slate-600">
                        {selectedJob.description || 'Describe the work and providers will quote through MaintainEX.'}
                      </div>
                      {(selectedJob.priceMin || selectedJob.priceMax) && (
                        <div className="mt-2 text-xs font-semibold text-amber-700">
                          Typical range: {selectedJob.currency} {selectedJob.priceMin || '—'} – {selectedJob.priceMax || '—'}
                        </div>
                      )}
                    </div>
                  )}
                </Card>

                <Card>
                  <StepHeader
                    step="Step 3"
                    title="Location, schedule and budget"
                    description="Your market is locked to the authenticated account country."
                  />

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <Field label="Service area">
                      <div className="relative">
                        <select
                          value={areaId}
                          onChange={event => setAreaId(event.target.value)}
                          className={inputClass}
                        >
                          <option value="">Choose area later / not listed</option>
                          {locations.map(location => (
                            <option key={location.id} value={location.id}>{location.label}</option>
                          ))}
                        </select>
                        <MapPin className="pointer-events-none absolute right-3 top-3 text-slate-400" size={16} />
                      </div>
                    </Field>

                    <Field label="Postal code (optional)">
                      <input
                        value={postalCode}
                        onChange={event => setPostalCode(event.target.value.slice(0, 20))}
                        className={inputClass}
                        autoComplete="postal-code"
                      />
                    </Field>

                    <Field label="Preferred date">
                      <input
                        type="date"
                        min={minDate}
                        value={preferredDate}
                        onChange={event => setPreferredDate(event.target.value)}
                        className={inputClass}
                      />
                    </Field>

                    <Field label="Preferred time">
                      <select
                        value={preferredTimeSlot}
                        onChange={event => setPreferredTimeSlot(event.target.value)}
                        className={inputClass}
                      >
                        <option value="anytime">Any time</option>
                        <option value="morning">Morning</option>
                        <option value="afternoon">Afternoon</option>
                        <option value="evening">Evening</option>
                      </select>
                    </Field>

                    <Field label="Pricing">
                      <select
                        value={budgetType}
                        onChange={event => setBudgetType(event.target.value)}
                        className={inputClass}
                      >
                        <option value="REQUEST_QUOTES">Request quotes</option>
                        <option value="NEGOTIABLE">Negotiable budget</option>
                        <option value="FIXED">Fixed budget</option>
                      </select>
                    </Field>

                    <Field label={`Budget (${region.currency}) · optional`}>
                      <input
                        inputMode="decimal"
                        value={budgetAmount}
                        onChange={event => setBudgetAmount(event.target.value.replace(/[^0-9.]/g, ''))}
                        className={inputClass}
                        placeholder="Leave blank for provider quotes"
                      />
                    </Field>
                  </div>

                  <div className="mt-4">
                    <Field label="Anything providers should know?">
                      <textarea
                        value={notes}
                        onChange={event => setNotes(event.target.value.slice(0, 1800))}
                        className={`${inputClass} min-h-28 resize-y`}
                        placeholder="Access details, size, symptoms, material preferences, special instructions…"
                      />
                    </Field>
                  </div>
                </Card>

                <Card>
                  <StepHeader
                    step="Step 4"
                    title="Create your marketplace job"
                    description="Eligible taskers/companies receive the same job used by the MaintainEX app."
                  />
                  <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-2 text-sm text-slate-500">
                      <ShieldCheck size={18} className="mt-0.5 text-emerald-600" />
                      <span>
                        Your request uses server-side country checks, idempotency, provider eligibility and canonical pricing.
                      </span>
                    </div>
                    <PrimaryButton onClick={createJob} busy={submitBusy}>
                      Create booking
                      <ArrowRight size={16} />
                    </PrimaryButton>
                  </div>
                  {submitError && <ErrorMessage>{submitError}</ErrorMessage>}
                </Card>
              </>
            )}
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                Booking summary
              </div>
              <div className="mt-4 space-y-4">
                <SummaryRow icon={<Sparkles size={16} />} label="Service" value={selectedJob?.name || 'Choose a service'} />
                <SummaryRow icon={<MapPin size={16} />} label="Market" value={countryCode} />
                <SummaryRow icon={<CalendarDays size={16} />} label="Date" value={preferredDate || 'Choose a date'} />
                <SummaryRow icon={<Phone size={16} />} label="Account" value={session.user?.phone || session.user?.email || 'Sign in required'} />
              </div>
            </div>

            <div className="rounded-2xl bg-[#111315] p-5 text-white shadow-sm">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck size={17} className="text-amber-400" />
                One marketplace lifecycle
              </div>
              <div className="mt-4 space-y-3 text-sm text-white/60">
                {['Create job', 'Receive quotes', 'Choose provider', 'Protected payment', 'Track work'].map((item, index) => (
                  <div key={item} className="flex items-center gap-3">
                    <div className="grid h-6 w-6 place-items-center rounded-full bg-white/10 text-[11px] font-bold text-amber-300">
                      {index + 1}
                    </div>
                    {item}
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

const inputClass =
  'h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-9 text-sm text-slate-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100 disabled:bg-slate-100'

const secondaryButtonClass =
  'inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50'

function Card({ children }: { children: React.ReactNode }) {
  return <section className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm sm:p-6">{children}</section>
}

function StepHeader({
  step,
  title,
  description,
}: {
  step: string
  title: string
  description: string
}) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-600">{step}</div>
      <h2 className="mt-1 text-xl font-bold tracking-[-0.02em] text-slate-950">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  )
}

function PrimaryButton({
  children,
  onClick,
  busy,
}: {
  children: React.ReactNode
  onClick: () => void
  busy: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 text-sm font-bold text-black transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {busy && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  )
}

function ErrorMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
      {children}
    </div>
  )
}

function SummaryRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-slate-400">{icon}</div>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
        <div className="mt-0.5 truncate text-sm font-semibold text-slate-800">{value}</div>
      </div>
    </div>
  )
}
