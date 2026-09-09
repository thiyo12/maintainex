# 04C-BOOKING-COMPATIBILITY.md — Booking Compatibility Preservation

> Generated: Phase 4C.5 — Booking Compatibility
> Scope: V1 Booking preserved for historical data, mobile writes retired

---

## CHANGES

| Endpoint | Method | Before | After |
|---|---|---|---|
| `/api/mobile/bookings` | POST | Creates V1 Booking | Returns 410 Gone + redirect to `/api/mobile/v2/jobs` |
| `/api/mobile/bookings` | GET | Lists user's Bookings | PRESERVED — reads historical data |
| `/api/mobile/bookings/[id]` | GET | Reads V1 Booking | PRESERVED — reads historical data |
| `/api/bookings` | POST | Creates V1 Booking (web admin) | PRESERVED — admin CRM |
| `/api/bookings` | GET | Lists all Bookings (admin) | PRESERVED — admin CRM |
| `/api/bookings/[id]` | GET | Reads V1 Booking (admin) | PRESERVED — admin CRM |

---

## PRESERVED

- 31 production Booking rows remain readable
- V1 Invoice auto-create behavior intact
- Admin CRM booking management functional
- Customer booking history accessible
- Web admin booking creation functional (CRM)

---

## RETIRED

- Mobile V1 Booking creation via POST /api/mobile/bookings
- Mobile V1 Quick Booking creation via POST /api/mobile/quick-bookings

---

## NEW TRANSACTION POLICY

```
NEW marketplace work → MarketplaceJob (V2)
existing V1 Booking → Booking lifecycle until complete/history
```

No indefinite dual writing. New work goes to V2 only.

---

## ACTIVE BOOKING COMPLETION

Existing active Bookings must be allowed to finish existing lifecycle.
Invoice auto-create behavior must remain intact.
V1 billing logic unchanged in Phase 4.
