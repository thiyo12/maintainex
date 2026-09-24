import { describe, it, expect } from 'vitest'

const LIVE_QA =
  process.env.GITHUB_HEAD_REF === 'qa/live-marketplace-e2e-20260924' ||
  process.env.GITHUB_REF_NAME === 'qa/live-marketplace-e2e-20260924'

const BASE = 'https://maintainex.lk'

async function api(path: string, options: {
  method?: string
  token?: string
  body?: unknown
  expected?: number[]
} = {}) {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (options.token) headers.Authorization = `Bearer ${options.token}`

  const response = await fetch(BASE + path, {
    method: options.method || 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
  const raw = await response.text()
  let data: any = null
  try { data = raw ? JSON.parse(raw) : null } catch { data = { raw: raw.slice(0, 500) } }

  const ok = options.expected
    ? options.expected.includes(response.status)
    : response.ok

  if (!ok) {
    throw new Error(`${options.method || 'GET'} ${path} -> ${response.status}: ${JSON.stringify(data)}`)
  }

  return { status: response.status, data }
}

async function waitForRelease() {
  const wanted = 'company-marketplace-qa-20260924'
  for (let i = 0; i < 45; i += 1) {
    try {
      const { data } = await api(`/api/health?qa=${Date.now()}`)
      if (
        data?.status === 'healthy' &&
        data?.release === wanted &&
        data?.testOtpMode === 'synthetic-only'
      ) {
        console.log('PASS live release marker', wanted)
        return
      }
      console.log('WAIT release', data?.release, data?.testOtpMode)
    } catch (error: any) {
      console.log('WAIT health', error?.message || String(error))
    }
    await new Promise(resolve => setTimeout(resolve, 10_000))
  }
  throw new Error('Timed out waiting for live release marker')
}

async function login(phone: string, expectedRole: string) {
  const send = await api('/api/mobile/auth/otp-login', {
    method: 'POST',
    body: { phone },
    expected: [200],
  })
  expect(send.data?.success).toBe(true)
  expect(send.data?.testMode).toBe(true)

  const verify = await api('/api/mobile/auth/otp-login', {
    method: 'POST',
    body: { phone, code: '000000' },
    expected: [200],
  })
  expect(verify.data?.accessToken).toBeTruthy()
  expect(verify.data?.user?.role).toBe(expectedRole)
  console.log('PASS demo login', expectedRole)

  return {
    token: verify.data.accessToken as string,
    user: verify.data.user,
  }
}

function chooseAcJob(categories: any[]) {
  const jobs = (categories || []).flatMap(category =>
    (category.jobs || [])
      .filter((job: any) => !job.isCompanyOnly)
      .map((job: any) => ({ category, job }))
  )

  return jobs.find(({ category, job }: any) =>
    /\bAC\b|air\s*condition|aircon|appliance|refriger/i.test(
      `${category.name} ${category.slug || ''} ${job.name} ${job.description || ''}`
    )
  )
}

describe.skipIf(!LIVE_QA)('Live MaintainEX marketplace E2E QA', () => {
  it('runs customer → multiple quotes → escrow → location → PIN → completion → payment', { timeout: 12 * 60 * 1000 }, async () => {
    await waitForRelease()

    const customer = await login('+12025550101', 'CUSTOMER')
    const tasker = await login('+12025550102', 'TASKER')
    const company = await login('+12025550103', 'COMPANY')

    const companyProfile = await api('/api/mobile/company/profile', { token: company.token })
    const companyId = companyProfile.data?.id
    expect(companyId).toBeTruthy()
    console.log('PASS company profile resolved')

    const categories = await api('/api/mobile/job-categories?country=LK')
    const chosen = chooseAcJob(categories.data)
    expect(chosen).toBeTruthy()
    const { category, job: templateJob } = chosen
    console.log('PASS AC service selected', category.name, templateJob.name)

    const legacySearch = await api(
      `/api/mobile/find-tasker?jobId=${encodeURIComponent(templateJob.id)}&latitude=6.9271&longitude=79.8612&maxDistance=150`,
      { token: customer.token },
    )
    expect(Array.isArray(legacySearch.data)).toBe(true)
    expect(legacySearch.data.length).toBeGreaterThan(0)
    const visiblyRelevant = legacySearch.data.find((provider: any) =>
      /AC|air|appliance|technician/i.test(
        `${provider.name || ''} ${(provider.skills || []).join(' ')}`
      )
    )
    expect(visiblyRelevant).toBeTruthy()
    console.log('PASS AC search relevant provider', visiblyRelevant.name)

    const create = await api('/api/mobile/v2/jobs', {
      method: 'POST',
      token: customer.token,
      body: {
        title: `[QA] AC repair end-to-end ${Date.now()}`,
        description: 'QA-only AC repair request for complete MaintainEX marketplace lifecycle validation.',
        categoryId: category.id,
        templateJobId: templateJob.id,
        budgetType: 'REQUEST_QUOTES',
        budgetAmount: 10000,
        countryCode: 'LK',
        urgency: 'normal',
        latitude: 6.9271,
        longitude: 79.8612,
        postalCode: '00300',
        workersCount: 1,
        materialHandling: 'quote_both',
      },
      expected: [201],
    })
    const jobId = create.data?.job?.id
    expect(jobId).toBeTruthy()
    console.log('PASS customer created QA job', jobId)

    const match = await api(`/api/mobile/v2/match/${jobId}`, { token: customer.token })
    const providers = match.data?.providers || []
    expect(providers.some((provider: any) =>
      provider.providerType === 'INDIVIDUAL' && provider.id === tasker.user.id
    )).toBe(true)
    expect(providers.some((provider: any) =>
      provider.providerType === 'COMPANY' && provider.id === companyId
    )).toBe(true)
    console.log('PASS canonical matching Tasker + Company')

    const taskerFeed = await api('/api/mobile/v2/jobs?role=provider', { token: tasker.token })
    expect((taskerFeed.data?.jobs || []).some((job: any) => job.id === jobId)).toBe(true)
    console.log('PASS Tasker opportunity feed')

    const companyFeed = await api('/api/mobile/v2/jobs?role=provider', { token: company.token })
    expect((companyFeed.data?.jobs || []).some((job: any) => job.id === jobId)).toBe(true)
    console.log('PASS Company opportunity feed')

    await api('/api/mobile/v2/quotes', {
      method: 'POST',
      token: tasker.token,
      body: {
        jobId,
        providerType: 'INDIVIDUAL',
        price: 6000,
        estimatedCompletionTime: 'Today · around 2 hours',
        message: 'QA Tasker quote: diagnosis, repair and functional check included.',
      },
      expected: [201],
    })
    console.log('PASS Tasker quote')

    await api('/api/mobile/v2/quotes', {
      method: 'POST',
      token: company.token,
      body: {
        jobId,
        providerType: 'COMPANY',
        companyId,
        price: 7000,
        estimatedCompletionTime: 'Today · around 2 hours',
        message: 'QA Company quote: technician dispatch, repair and functional check included.',
      },
      expected: [201],
    })
    console.log('PASS Company quote')

    const companyMyQuotes = await api('/api/mobile/v2/jobs?myQuotes=true', { token: company.token })
    expect((companyMyQuotes.data?.jobs || []).some((job: any) => job.id === jobId)).toBe(true)
    console.log('PASS Company My Quotes')

    const quoteList = await api(`/api/mobile/v2/quotes?jobId=${jobId}`, { token: customer.token })
    const quotes = quoteList.data?.quotes || []
    expect(quotes.length).toBeGreaterThanOrEqual(2)

    const taskerQuote = quotes.find((quote: any) =>
      quote.providerType === 'INDIVIDUAL' && quote.providerId === tasker.user.id
    )
    const companyQuote = quotes.find((quote: any) =>
      quote.providerType === 'COMPANY' && quote.providerId === companyId
    )
    expect(taskerQuote).toBeTruthy()
    expect(companyQuote).toBeTruthy()
    console.log('PASS customer received multiple quotes')

    await api(`/api/mobile/v2/jobs/${jobId}/select-quote`, {
      method: 'POST',
      token: customer.token,
      body: { quoteId: taskerQuote.id },
    })
    console.log('PASS customer accepted quote')

    await api(`/api/mobile/v2/jobs/${jobId}/escrow`, {
      method: 'POST',
      token: customer.token,
      body: { amount: 6000 },
      expected: [201],
    })
    console.log('PASS escrow funded')

    await api(`/api/mobile/v2/jobs/${jobId}/share-address`, {
      method: 'POST',
      token: customer.token,
      body: {
        street: 'QA Test Street',
        building: 'MaintainEX QA',
        apartment: 'Demo',
        landmark: 'QA ONLY - NOT A REAL VISIT',
      },
    })
    console.log('PASS address shared after escrow')

    const pinResult = await api(`/api/mobile/v2/jobs/${jobId}/pin`, {
      method: 'POST',
      token: customer.token,
      expected: [201],
    })
    const pin = pinResult.data?.pin
    expect(pin).toMatch(/^\d{6}$/)
    console.log('PASS customer generated secure PIN')

    await api('/api/mobile/taskers/location', {
      method: 'PUT',
      token: tasker.token,
      body: { latitude: 6.9302, longitude: 79.8618 },
    })

    const location = await api(`/api/mobile/taskers/${jobId}/location`, {
      token: customer.token,
    })
    expect(location.data?.sharing).toBe(true)
    expect(location.data?.location).toBeTruthy()
    console.log('PASS live Tasker location visible')

    const prematureWorkStart = await api(`/api/mobile/v2/jobs/${jobId}/pin/verify`, {
      method: 'POST',
      token: tasker.token,
      body: { pin, purpose: 'WORK_START' },
      expected: [401],
    })
    expect(String(prematureWorkStart.data?.error || '')).toContain('current job state')
    console.log('PASS work start blocked before arrival')

    await api(`/api/mobile/v2/jobs/${jobId}/pin/verify`, {
      method: 'POST',
      token: tasker.token,
      body: { pin, purpose: 'ARRIVAL' },
    })
    console.log('PASS arrival PIN')

    await api(`/api/mobile/v2/jobs/${jobId}/pin/verify`, {
      method: 'POST',
      token: tasker.token,
      body: { pin, purpose: 'WORK_START' },
    })
    console.log('PASS work-start PIN')

    const workspace = await api(`/api/mobile/v2/jobs/${jobId}/workspace`, {
      token: tasker.token,
    })
    expect(workspace.data?.workspace?.progressStatus).toBe('IN_PROGRESS')
    console.log('PASS workspace IN_PROGRESS')

    await api(`/api/mobile/v2/jobs/${jobId}/complete`, {
      method: 'POST',
      token: tasker.token,
      body: { action: 'MARK_COMPLETE' },
    })
    console.log('PASS provider completion request')

    await api(`/api/mobile/v2/jobs/${jobId}/complete`, {
      method: 'POST',
      token: customer.token,
      body: { action: 'APPROVE_COMPLETION' },
    })
    console.log('PASS customer completion approval/payment release')

    const finalJob = await api(`/api/mobile/v2/jobs/${jobId}`, { token: customer.token })
    expect(finalJob.data?.job?.status).toBe('COMPLETED')
    expect(finalJob.data?.job?.workspace?.progressStatus).toBe('COMPLETED')
    expect(finalJob.data?.job?.escrow?.status).toBe('RELEASED')
    console.log('PASS final COMPLETED + RELEASED state')

    await api(`/api/mobile/v2/jobs/${jobId}/reviews`, {
      method: 'POST',
      token: customer.token,
      body: {
        reviewType: 'CUSTOMER_REVIEWS_PROVIDER',
        quality: 5,
        communication: 5,
        timeliness: 5,
        comment: 'Automated QA review for MaintainEX demo lifecycle validation.',
      },
      expected: [201],
    })

    await api(`/api/mobile/v2/jobs/${jobId}/reviews`, {
      method: 'POST',
      token: tasker.token,
      body: {
        reviewType: 'PROVIDER_REVIEWS_CUSTOMER',
        cooperation: 5,
        communication: 5,
        overallExperience: 5,
        comment: 'Automated QA provider review for demo lifecycle validation.',
      },
      expected: [201],
    })
    console.log('PASS two-way review')
    console.log('LIVE_QA_JOB_ID=' + jobId)
    console.log('FINAL_STATUS=PASS')
  })
})
