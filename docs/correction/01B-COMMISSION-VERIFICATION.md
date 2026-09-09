# Phase 1B — Commission Verification

## Verdict: OUTCOME A — Existing Canonical 10% Policy

## Evidence

### 1. Prisma Schema

```prisma
// prisma/schema.prisma:2111
model PlatformSettings {
  commissionRate Float @default(10.0) // Platform commission percentage
}
```

Comment explicitly states "Platform commission percentage" with default 10.0.

### 2. Admin Settings Route

```typescript
// app/api/admin/settings/route.ts:6
commissionRate: { value: '10', type: 'number', label: 'Commission Rate (%)', description: 'Platform commission percentage charged per completed job', groupName: 'billing' }
```

Admin UI defines the field with default value `'10'`.

### 3. Seed Data

```typescript
// prisma/seed.ts:611
commissionRate: 10.0,
```

Seeds use 10.0.

### 4. lib/mxid.ts

```typescript
export async function getCommissionRate(): Promise<number> {
  const settings = await prisma.platformSettings.findFirst()
  return settings?.commissionRate ?? 10.0
}
```

Fallback is 10.0 — matches schema default.

### 5. CompanyProfile Schema

```prisma
// prisma/schema.prisma:1470
model CompanyProfile {
  commissionRate Float @default(10.0) // Changed from 15 to 10
}
```

Comment confirms intentional change from 15% to 10%.

## Resolution Chain

1. `getProviderCommissionRate(providerId)` — checks `CompanyProfile.commissionRate`
2. If no company profile → falls back to `getCommissionRate()`
3. `getCommissionRate()` → reads `PlatformSettings.commissionRate` → defaults to `10.0`
4. `PlatformSettings.commissionRate` → schema default `10.0`
5. Admin UI → default value `'10'`

## Conclusion

The 10% rate is the existing authoritative platform default. It is not an invented value. It is defined in the schema, the admin UI, and seed data.
