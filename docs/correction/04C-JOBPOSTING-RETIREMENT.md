# 04C-JOBPOSTING-RETIREMENT.md — JobPosting V1 New-Write Retirement

> Generated: Phase 4C.4 — JobPosting Retirement
> Scope: V1 JobPosting and Bid write endpoints retired

---

## CHANGES

| Endpoint | Method | Before | After |
|---|---|---|---|
| `/api/mobile/jobs` | POST | Creates V1 JobPosting | Returns 410 Gone + redirect to `/api/mobile/v2/jobs` |
| `/api/mobile/jobs/[id]/bid` | POST | Creates V1 Bid | Returns 410 Gone + redirect to `/api/mobile/v2/quotes` |
| `/api/mobile/jobs` | GET | Lists V1 JobPostings | PRESERVED — reads historical data |
| `/api/mobile/jobs/[id]` | GET | Reads V1 JobPosting | PRESERVED — reads historical data |

---

## PRESERVED

- All V1 JobPosting READ endpoints remain functional
- 5 production JobPosting rows remain readable
- Dispute references to JobPosting continue working
- Historical data accessible for admin CRM

---

## RETIRED

- V1 JobPosting creation via mobile API
- V1 Bid creation via mobile API

---

## V2 REPLACEMENT

| V1 Operation | V2 Replacement |
|---|---|
| Create job | POST /api/mobile/v2/jobs |
| Submit quote | POST /api/mobile/v2/quotes |
| Accept quote | POST /api/mobile/v2/jobs/[id]/select-quote |

---

## PRODUCTION DATA

- JobPosting: 5 rows (3 COMPLETED, 1 OPEN, 1 CANCELLED)
- Bid: 0 rows
- Assignment: 0 rows

All V1 production data preserved and readable.
