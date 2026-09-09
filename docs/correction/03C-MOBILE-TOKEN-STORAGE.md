# 03C — Mobile Token Storage

**Date**: 2026-09-07

---

## Storage Mechanism

`expo-secure-store` — OS-backed secure storage (Keychain on iOS, EncryptedSharedPreferences on Android).

---

## Storage Keys

| Key | Type | Purpose | Lifetime |
|---|---|---|---|
| `auth_token` | string | Access JWT (15-minute expiry) | Until logout or refresh |
| `auth_refresh_token` | string | Opaque refresh token (30-day expiry) | Until logout or refresh |
| `auth_user` | JSON string | Cached user object for offline bootstrap | Until logout |
| `last_active_at` | epoch ms string | Heartbeat timestamp for 18-day inactivity | Updated every 60s |

---

## Security Properties

- **Encrypted at rest** by OS (Keychain/EncryptedSharedPreferences)
- **Not accessible** by other apps (sandboxed)
- **Not logged** by the app
- **Not stored** in AsyncStorage, plain local storage, or Redux persistence

---

## Token Lifecycle

### Login
```
Server returns { accessToken, refreshToken, user }
↓
setAuthToken(accessToken) → SecureStore
↓
setAuthRefreshToken(refreshToken) → SecureStore
↓
SecureStore.setItem('auth_user', JSON.stringify(user))
```

### Refresh
```
Access token expires (401)
↓
Single-flight refresh coordinator
↓
POST /api/mobile/auth/refresh { refreshToken }
↓
Server returns { accessToken, refreshToken }
↓
setAuthToken(newAccessToken) → SecureStore
↓
setAuthRefreshToken(newRefreshToken) → SecureStore
```

### Logout
```
POST /api/mobile/auth/logout
↓
clearAuth() → SecureStore.deleteItem('auth_token')
           → SecureStore.deleteItem('auth_refresh_token')
           → SecureStore.deleteItem('last_active_at')
           → SecureStore.deleteItem('auth_user')
```

---

## In-Memory Cache

```typescript
let authToken: string | null = null      // fast path
let authRefreshToken: string | null = null // fast path
```

Module-level variables cache tokens for the current session. SecureStore provides durable persistence across app restarts.
