# MaintainEX — k6 Load Test Harness

## Prerequisites

Install k6 (macOS):

```bash
brew install k6
```

Or via Docker:

```bash
docker pull grafana/k6
```

## Files

| File | Purpose |
|---|---|
| `k6-baseline.js` | Main load test script with 4 scenarios |
| `config.js` | Shared config (base URL, credentials, thresholds) |

## Quick Start

```bash
cd loadtest

# Light — 100 VUs, 30s ramp
k6 run k6-baseline.js

# Medium — 500 VUs, 60s ramp
K6_SCENARIO=medium k6 run k6-baseline.js

# Heavy — 1000 VUs, 120s ramp
K6_SCENARIO=heavy k6 run k6-baseline.js
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `BASE_URL` | `https://maintainex.lk` | Target API base URL |
| `K6_SCENARIO` | `light` | Scenario preset: `light`, `medium`, `heavy` |
| `MOBILE_EMAIL` | `test@test.com` | Mobile API test account email |
| `MOBILE_PASSWORD` | `test123` | Mobile API test account password |
| `ADMIN_EMAIL` | `thiyooo@gmail.com` | Admin dashboard email |
| `ADMIN_PASSWORD` | _(empty)_ | Admin dashboard password (must be set for admin scenario) |

### Examples

```bash
# Test against local dev server
BASE_URL=http://localhost:3000 k6 run k6-baseline.js

# Custom admin credentials
ADMIN_EMAIL=admin@maintainex.lk ADMIN_PASSWORD=secret K6_SCENARIO=medium k6 run k6-baseline.js
```

## Docker Usage

```bash
docker run --rm -i grafana/k6 run - < k6-baseline.js

# With env vars
docker run --rm -i \
  -e BASE_URL=https://maintainex.lk \
  -e K6_SCENARIO=medium \
  grafana/k6 run - < k6-baseline.js
```

## What Gets Tested

| Scenario | Endpoint | Auth | Traffic Weight |
|---|---|---|---|
| Health | `GET /api/health` | None | 40% |
| Public Listings | `GET /api/services`, `GET /api/categories` | None | 30% |
| Mobile Search | `GET /api/mobile/search?q=...` | Bearer JWT | 20% |
| Admin Dashboard | `GET /api/dashboard` | Bearer JWT | 10% |

### Traffic Mix

The test simulates realistic weighted traffic — mostly anonymous browsing (health + public), some authenticated mobile search, and occasional admin dashboard hits.

## Thresholds

Default pass/fail criteria (in `config.js`):

- **p95 latency** < 800ms
- **p99 latency** < 2000ms
- **Error rate** < 10%
- **Throughput** > 50 req/s

Edit thresholds in `config.js` or override via CLI:

```bash
k6 run --threshold 'http_req_duration{tag:health}<200' k6-baseline.js
```

## Interpreting Results

k6 outputs a summary table after each run. Key metrics:

- `http_req_duration` — response time distribution (avg, min, med, max, p90, p95, p99)
- `http_req_failed` — proportion of failed requests
- `http_reqs` — total requests and throughput (req/s)
- Custom trends: `health_duration`, `public_list_duration`, `mobile_search_duration`, `admin_dashboard_duration`, `login_duration`

## CI Integration

```yaml
# Example GitHub Actions step
- name: Run load test
  run: |
    k6 run loadtest/k6-baseline.js \
      --out json=results.json \
      --summary-export=summary.json
    # Fail if p95 > 800ms
    test $(jq '.metrics.http_req_duration.values["p(95)"]' summary.json) < 800
```

## Notes

- The mobile search scenario authenticates once per VU and caches the token for the test duration.
- The admin dashboard scenario requires `ADMIN_PASSWORD` to be set; otherwise it is silently skipped.
- Template-jobs search (`/api/mobile/template-jobs/search`) is public and excluded from the authenticated search scenario.
- For sustained soak testing, use k6's `constant-arrival-rate` executor with the scenario functions from this script.
