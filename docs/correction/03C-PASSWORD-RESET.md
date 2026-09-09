# 03C — Password Reset Behavior Change

## Phase 3C Fix

**Before**: `POST /api/mobile/auth/reset-password` revoked all sessions then created a new session (auto-login).
**After**: `POST /api/mobile/auth/reset-password` revokes all sessions and returns success. No session created. User must log in fresh.

---

## Frozen Security Policy (Step 4A)

```
PASSWORD RESET
→ verify OTP/token
→ update password securely
→ revoke ALL UserSessions
→ return success (no tokens)
→ mobile clears existing auth state
→ user goes to login
→ fresh login creates the next UserSession
```

---

## API Behavior Change

### Before (Phase 3C initial)
```json
POST /api/mobile/auth/reset-password
Response: { success: true, accessToken: "...", refreshToken: "...", user: {...} }
```

### After (Phase 3C final)
```json
POST /api/mobile/auth/reset-password
Response: { success: true, message: "Password reset successful. Please log in with your new password." }
```

---

## Mobile Client Impact

- `reset-password.tsx` (line 77-80): Already redirects to `/(auth)/login` after reset. Does NOT use response tokens.
- `auth.resetPassword()` in `api.ts`: Returns `AuthResponse` type but mobile screen ignores the token fields.
- No mobile code changes required — mobile already implements the correct flow.

---

## Test Coverage

See `tests/phase3/password-reset.integration.test.ts`:
- Existing Session A revoked
- Existing Session B revoked (different user, not affected)
- Reset succeeds
- Zero active UserSessions remain for user after reset
- Old access token denied
- Old refresh token denied
- Fresh login afterward succeeds
