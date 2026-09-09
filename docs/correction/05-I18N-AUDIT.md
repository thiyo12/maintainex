# MaintainEX i18n Audit

## Current Implementation

| Aspect | Status |
|---|---|
| Libraries | None — manual `getLocalizedValue()` |
| Languages | English (primary), Tamil, Sinhala |
| Storage | TypeScript object arrays in `i18n/` directory |
| Fallback | Always English |
| RTL support | Not implemented (Sinhala/Tamil are LTR) |
| Pluralization | Not implemented |
| Date/number formatting | Not locale-aware |

## i18n Directory Structure

```
apps/mobile/i18n/
├── index.ts              # getLocalizedValue(), hasTranslation()
├── en.ts                 # English strings
├── ta.ts                 # Tamil strings
├── si.ts                 # Sinhala strings
├── en-services.ts        # Service names (English)
├── ta-services.ts        # Service names (Tamil)
├── si-services.ts        # Service names (Sinhala)
├── en-profile.ts         # Profile fields (English)
├── ta-profile.ts         # Profile fields (Tamil)
├── si-profile.ts         # Profile fields (Sinhala)
├── en-booking.ts         # Booking flows (English)
├── ta-booking.ts         # Booking flows (Tamil)
├── si-booking.ts         # Booking flows (Sinhala)
├── en-otp.ts             # OTP screens (English)
├── ta-otp.ts             # OTP screens (Tamil)
├── si-otp.ts             # OTP screens (Sinhala)
├── en-locations.ts       # Location names (English)
├── ta-locations.ts       # Location names (Tamil)
├── si-locations.ts       # Location names (Sinhala)
└── en-privacy.ts         # Privacy settings (English only)
```

## String Count

| Language | Keys | Coverage |
|---|---|---|
| English | ~200+ | Complete |
| Tamil | ~180+ | ~90% |
| Sinhala | ~180+ | ~90% |

## Fallback Behavior

```typescript
export function getLocalizedValue(obj: any, field: string): string {
  if (!obj || !field) return ''
  if (typeof obj[field] === 'string') return obj[field]  // Direct value
  if (obj[field] && typeof obj[field] === 'object') {
    return obj[field][currentLocale] || obj[field]['en'] || ''  // Locale object
  }
  return ''
}
```

Always falls back to English. Missing keys return empty string.

## Known Gaps

1. **No pluralization** — "1 booking" vs "2 bookings" not handled
2. **No date formatting** — All dates use hardcoded `.toLocaleDateString()`
3. **No number formatting** — Currency not locale-aware (always "LKR")
4. **No interpolation** — Can't do `"Hello, {name}"` without string concatenation
5. **No RTL support** — Not needed for Sinhala/Tamil, but limits future languages
6. **`en-privacy.ts` has no Tamil/Sinhala translations**
7. **Service names not translated in backend** — API returns English only
8. **Category names not translated** — DB stores English only
