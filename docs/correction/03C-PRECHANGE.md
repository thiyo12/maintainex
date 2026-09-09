# 03C — Pre-Change Review

**Date**: 2026-09-07

---

## Current Auth Architecture

### Login Routes Issuing Tokens

| Route | Method | Token Issued | Current Issuer |
|---|---|---|---|
| `/api/mobile/auth/login` | POST | `{ id, email, role }` | `createToken()` via `NEXTAUTH_SECRET` |
| `/api/mobile/auth/otp-login` | POST | `{ id, email, role }` | `createToken()` via `NEXTAUTH_SECRET` |
| `/api/mobile/auth/verify-otp` | POST | `{ id, email, role }` | `createToken()` via `NEXTAUTH_SECRET` (PHONE_VERIFICATION only) |
| `/api/mobile/auth/reset-password` | POST | `{ id, email, role }` | `createToken()` via `NEXTAUTH_SECRET` |

### Routes That Do NOT Issue Tokens

| Route | Behavior |
|---|---|
| `/api/mobile/auth/register` | Creates user + PHONE_VERIFICATION OTP, returns `requiresVerification: true` |
| `/api/mobile/auth/send-otp` | Sends EMAIL_VERIFICATION OTP |
| `/api/mobile/auth/forgot-password` | Sends PASSWORD_RESET OTP |

### `authenticateRequest()` Return Shape

```typescript
{
  id: string
  email: string
  name: string
  phone: string | null
  role: string
  isActive: boolean
  identityStatus: string | null
  lastNameChangedAt: Date | null
  isSuspended: boolean
  isBanned: boolean
  suspendedUntil: Date | null
  suspensionReason: string | null
  banReason: string | null
}
```

### 75-Route Consumer Field Usage

| Field | Files |
|---|---|
| `user.id` | 63 |
| `user.role` | 17 |
| `user.name` | 6 |
| `user.email` | 4 |
| `user.identityStatus` | 3 |
| `user.phone` | 1 |
| `user.lastNameChangedAt` | 1 |

### Mobile Client Architecture

- **Token storage**: `expo-secure-store` (`auth_token`, `auth_user`, `last_active_at`)
- **API client**: Raw `fetch` wrappers (`request()` and `v2Request()`)
- **No refresh mechanism**: 30-day JWT, 18-day client-side inactivity window
- **No 401 interceptor**: Only app-launch validation with 2 retries
- **Auth context**: `AuthProvider` wrapping entire app, `useAuth()` hook consumed by 25+ screens

---

## What Phase 3C Changes

### Backend

1. **`createMarketplaceAuthSession(user, context)`** — centralized login issuance
2. **Migrate 4 login routes** to use canonical session issuance
3. **`authenticateRequest()`** — canonical JWT + UserSession + legacy compat window
4. **Logout endpoint** — `POST /api/mobile/auth/logout`
5. **Password reset** — revoke all sessions after reset

### Mobile Client

1. **Refresh token storage** — `auth_refresh_token` in SecureStore
2. **Single-flight refresh** — coordinate concurrent 401s
3. **Token rotation storage** — replace old refresh on rotation
4. **Logout** — revoke server session + clear local storage
5. **401 interceptor** — auto-refresh on access token expiry

---

## What Phase 3C Does NOT Touch

- Admin/Staff auth
- TOTP
- `getAdminSession()`
- Legacy Admin HMAC
- Staff RBAC
- Marketplace job models
- Financial architecture
- Withdrawal status
- `CRON_SECRET` / `INTERNAL_SYNC_SECRET`
