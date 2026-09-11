import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { BASE_URL, MOBILE_USER, ADMIN_USER, SEARCH_QUERIES } from './config.js';

// ── Custom metrics ────────────────────────────────────────────────────────
const healthDuration = new Trend('health_duration', true);
const publicListDuration = new Trend('public_list_duration', true);
const mobileSearchDuration = new Trend('mobile_search_duration', true);
const adminDashDuration = new Trend('admin_dashboard_duration', true);
const loginDuration = new Trend('login_duration', true);
const successRate = new Rate('checks_passed');

// ── Scenario selection ────────────────────────────────────────────────────
// Default to light; override with K6_SCENARIO env var (light | medium | heavy)
const scenarioKey = __ENV.K6_SCENARIO || 'light';
const scenarios = {
  light:  { executor: 'ramping-vus', startVUs: 0, stages: [{ duration: '30s', target: 100 }], exec: 'default' },
  medium: { executor: 'ramping-vus', startVUs: 0, stages: [{ duration: '60s', target: 500 }], exec: 'default' },
  heavy:  { executor: 'ramping-vus', startVUs: 0, stages: [{ duration: '120s', target: 1000 }], exec: 'default' },
};

export const options = {
  scenarios: { [scenarioKey]: scenarios[scenarioKey] },
  thresholds: {
    http_req_duration: ['p(95)<800', 'p(99)<2000'],
    http_req_failed: ['rate<0.10'],
    http_reqs: ['rate>50'],
  },
  noConnectionReuse: false,
  userAgent: 'MaintainEX-LoadTest/1.0',
};

// ── Shared helpers ────────────────────────────────────────────────────────
const headers = { 'Content-Type': 'application/json' };

function randomQuery() {
  return SEARCH_QUERIES[Math.floor(Math.random() * SEARCH_QUERIES.length)];
}

function assert200(res, name) {
  const ok = res.status === 200;
  check(res, { [`${name} status 200`]: (r) => r.status === 200 });
  successRate.add(ok);
  return ok;
}

// ── Auth tokens (cached per VU) ──────────────────────────────────────────
let mobileToken = null;
let adminToken = null;

function getMobileToken() {
  if (mobileToken) return mobileToken;

  const res = http.post(`${BASE_URL}/api/mobile/auth/login`, JSON.stringify({
    email: MOBILE_USER.email,
    password: MOBILE_USER.password,
  }), { headers, tags: { name: 'login_mobile' } });

  loginDuration.add(res.timings.duration);

  if (res.status === 200) {
    const body = res.json();
    mobileToken = body.accessToken || body.token || null;
    check(res, { 'mobile login success': (r) => r.status === 200 });
  } else {
    check(res, { 'mobile login success': () => false });
  }
  return mobileToken;
}

function getAdminToken() {
  if (adminToken) return adminToken;

  if (!ADMIN_USER.password) return null;

  const res = http.post(`${BASE_URL}/api/admin/auth/login`, JSON.stringify({
    email: ADMIN_USER.email,
    password: ADMIN_USER.password,
  }), { headers, tags: { name: 'login_admin' } });

  loginDuration.add(res.timings.duration);

  if (res.status === 200) {
    const body = res.json();
    adminToken = body.accessToken || null;
    check(res, { 'admin login success': (r) => r.status === 200 });
  } else {
    check(res, { 'admin login success': () => false });
  }
  return adminToken;
}

// ── Scenario functions ────────────────────────────────────────────────────

function hitHealth() {
  const res = http.get(`${BASE_URL}/api/health`, { tags: { name: 'health' } });
  healthDuration.add(res.timings.duration);
  assert200(res, 'health');
}

function hitPublicListings() {
  group('public listings', () => {
    const svcRes = http.get(`${BASE_URL}/api/services`, { tags: { name: 'services' } });
    publicListDuration.add(svcRes.timings.duration);
    assert200(svcRes, 'services');

    const catRes = http.get(`${BASE_URL}/api/categories`, { tags: { name: 'categories' } });
    publicListDuration.add(catRes.timings.duration);
    assert200(catRes, 'categories');
  });
}

function hitMobileSearch() {
  const token = getMobileToken();
  if (!token) return;

  const q = randomQuery();
  const res = http.get(`${BASE_URL}/api/mobile/search?q=${q}`, {
    headers: { Authorization: `Bearer ${token}` },
    tags: { name: 'mobile_search' },
  });
  mobileSearchDuration.add(res.timings.duration);
  assert200(res, 'mobile_search');
}

function hitAdminDashboard() {
  const token = getAdminToken();
  if (!token) return;

  const res = http.get(`${BASE_URL}/api/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
    tags: { name: 'admin_dashboard' },
  });
  adminDashDuration.add(res.timings.duration);
  assert200(res, 'admin_dashboard');
}

// ── Main default function (shared across scenarios) ───────────────────────
export default function () {
  // Weighted traffic mix mimicking real usage:
  // 40% health (monitoring), 30% public (anonymous), 20% mobile search, 10% admin
  const roll = Math.random();

  if (roll < 0.40) {
    hitHealth();
  } else if (roll < 0.70) {
    hitPublicListings();
  } else if (roll < 0.90) {
    hitMobileSearch();
  } else {
    hitAdminDashboard();
  }

  sleep(1);
}

// ── Lifecycle hooks ───────────────────────────────────────────────────────
export function setup() {
  console.log(`\nMaintainEX Load Test — scenario: ${scenarioKey}`);
  console.log(`Target: ${BASE_URL}\n`);
}

export function teardown() {
  console.log('\nLoad test complete.');
}
