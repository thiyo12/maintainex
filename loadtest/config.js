// Shared configuration for MaintainEX k6 load tests
// Usage: import { BASE_URL, THRESHOLDS } from './config.js'

export const BASE_URL = __ENV.BASE_URL || 'https://maintainex.lk';

// Credentials for authenticated scenarios
// Override via env: k6 run -e MOBILE_EMAIL=... -e MOBILE_PASSWORD=...
export const MOBILE_USER = {
  email: __ENV.MOBILE_EMAIL || 'test@test.com',
  password: __ENV.MOBILE_PASSWORD || 'test123',
};

export const ADMIN_USER = {
  email: __ENV.ADMIN_EMAIL || 'thiyooo@gmail.com',
  password: __ENV.ADMIN_PASSWORD || '',
};

// Search queries used by mobile search scenario
export const SEARCH_QUERIES = [
  'plumbing', 'cleaning', 'electrical', 'painting',
  'carpentry', 'landscaping', 'appliance', 'hvac',
];

// Scenario presets (VUs, ramp-up duration in seconds)
export const SCENARIOS = {
  light: { vus: 100, rampUp: 30 },
  medium: { vus: 500, rampUp: 60 },
  heavy: { vus: 1000, rampUp: 120 },
};

// Default thresholds — adjust per scenario as needed
export const THRESHOLDS = {
  http_req_duration: ['p(95)<800', 'p(99)<2000'],
  http_req_failed: ['rate<0.10'],
  http_reqs: ['rate>50'],
};
