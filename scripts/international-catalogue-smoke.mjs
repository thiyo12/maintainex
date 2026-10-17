#!/usr/bin/env node
/**
 * Phase 11: read-only black-box market isolation checks against a booted app.
 *
 * No authorization header, customer data, mutation, payments, deployment,
 * catalogue activation, or production credentials are needed.
 * Empty market catalogues are valid while offers are inactive; this does NOT
 * certify actual provider coverage, pricing completeness, or booking flow.
 */
import assert from 'node:assert/strict'

const COUNTRIES = Object.freeze({ LK: 'LKR', CA: 'CAD' })

export function verifyCataloguePayload(body, market) {
  if (!Array.isArray(body)) throw new Error(market + ' catalogue must be an array')
  if (market !== 'LK' && market !== 'CA') {
    assert.deepEqual(body, [], 'Unsupported market ' + market + ' exposed catalogue data')
    return { categories: 0, services: 0 }
  }
  let services = 0
  for (const category of body) {
    if (!category || typeof category !== 'object' || Array.isArray(category)) {
      throw new Error(market + ' returned a malformed category')
    }
    if (!Array.isArray(category.countries) || !category.countries.includes(market)) {
      throw new Error(market + ' returned a category outside the requested market')
    }
    if (category.isActive !== true) {
      throw new Error(market + ' exposed an inactive category')
    }
    if (!Array.isArray(category.jobs)) {
      throw new Error(market + ' returned a category without a services list')
    }
    for (const job of category.jobs) {
      if (!job || typeof job !== 'object' || Array.isArray(job) ||
          !Array.isArray(job.countries) || !job.countries.includes(market)) {
        throw new Error(market + ' exposed a cross-market service')
      }
      if (job.currency !== COUNTRIES[market]) {
        throw new Error(market + ' exposed a service in ' + String(job.currency) + ' instead of ' + COUNTRIES[market])
      }
      services++
    }
  }
  return { categories: body.length, services }
}

export function runSelfTests() {
  const lkr = {
    countries: ['LK'], isActive: true,
    jobs: [{ countries: ['LK'], currency: 'LKR' }],
  }
  const cad = {
    countries: ['CA'], isActive: true,
    jobs: [{ countries: ['CA'], currency: 'CAD' }],
  }
  assert.deepEqual(verifyCataloguePayload([lkr], 'LK'), { categories: 1, services: 1 })
  assert.deepEqual(verifyCataloguePayload([cad], 'CA'), { categories: 1, services: 1 })
  assert.deepEqual(verifyCataloguePayload([], 'CA'), { categories: 0, services: 0 })
  assert.deepEqual(verifyCataloguePayload([], 'US'), { categories: 0, services: 0 })
  assert.throws(() => verifyCataloguePayload([lkr], 'CA'), /category outside/)
  assert.throws(() => verifyCataloguePayload([cad], 'LK'), /category outside/)
  assert.throws(() => verifyCataloguePayload([{ ...cad, jobs: [{ countries: ['CA'], currency: 'LKR' }] }], 'CA'), /instead of CAD/)
  assert.throws(() => verifyCataloguePayload([{ ...lkr, jobs: [{ countries: ['CA'], currency: 'LKR' }] }], 'LK'), /cross-market/)
  assert.throws(() => verifyCataloguePayload([{ ...lkr, isActive: false }], 'LK'), /inactive/)
  assert.throws(() => verifyCataloguePayload([lkr], 'US'), /Unsupported market/)
  assert.throws(() => verifyCataloguePayload({ categories: [lkr] }, 'LK'), /must be an array/)
  console.log('PASS: market-isolation smoke payload self-tests')
}

async function fetchJson(url) {
  const res = await fetch(url, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(10000) })
  if (res.status !== 200) throw new Error('HTTP ' + res.status + ' for ' + url.pathname)
  const raw = await res.text()
  if (raw.length > 2000000) throw new Error('Unexpectedly large market-catalogue response')
  try {
    return JSON.parse(raw)
  } catch {
    throw new Error('Invalid JSON at ' + url.pathname)
  }
}

export async function runSmoke(baseUrl) {
  const base = new URL(baseUrl)
  if (base.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(base.hostname)) {
    throw new Error('Only a local isolated app container may be checked; refusing non-local origin')
  }
  if (base.username || base.password || base.search || base.hash) {
    throw new Error('Refusing credentials or query parameters in base URL')
  }

  for (const market of ['LK', 'CA', 'US', 'IN']) {
    const target = new URL('/api/mobile/job-categories', base)
    target.searchParams.set('country', market)
    const payload = await fetchJson(target)
    const counts = verifyCataloguePayload(payload, market)
    console.log('PASS ' + market + ': ' + counts.categories + ' categories, ' +
      counts.services + ' market-isolated services (may be empty while inactive)')
  }
  const lowercaseUrl = new URL('/api/mobile/job-categories?country=ca', base)
  verifyCataloguePayload(await fetchJson(lowercaseUrl), 'CA')
  console.log('PASS: lowercase country parameter still resolves CA market')
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  try {
    if (process.argv[2] === '--self-test') {
      runSelfTests()
    } else if (process.argv.length === 3) {
      await runSmoke(process.argv[2])
    } else {
      throw new Error('Usage: node scripts/international-catalogue-smoke.mjs --self-test | http://127.0.0.1:3199')
    }
  } catch (error) {
    console.error('FAIL: ' + (error instanceof Error ? error.message : String(error)))
    process.exitCode = 1
  }
}
