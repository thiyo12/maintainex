# 03 — Step 6: Replay Detection

**Date**: 2026-09-07

---

## Policy

When a refresh token is presented for rotation:

### Happy Path
- Parse → load session → verify secret → validate user → atomic swap → issue new tokens

### Replay Detection

| Condition | Action |
|---|---|
| Session not found | Throw `INVALID_TOKEN` |
| Session revoked | Log `TOKEN_REPLAY` (HIGH) → Throw `TOKEN_REPLAY` |
| Session expired | Throw `SESSION_EXPIRED` |
| Secret mismatch | Revoke entire `tokenFamilyId` → Log `TOKEN_REPLAY` (HIGH) → Throw `TOKEN_REPLAY` |
| Atomic swap fails (0 rows) | Revoke entire `tokenFamilyId` → Log `TOKEN_REPLAY` (HIGH) → Throw `TOKEN_REPLAY` |
| User inactive | Throw `ACCOUNT_DISABLED` |
| User banned | Throw `ACCOUNT_BANNED` |
| User suspended | Throw `ACCOUNT_SUSPENDED` |

### Client Response

All replay/rejection cases return:
```json
{ "error": "Token reuse detected", "code": "TOKEN_REPLAY" }
```
Status: `401`

No distinction between "session revoked" and "wrong secret" exposed to client.

---

## Security Event Logging

```typescript
recordSecurityEvent(
  'TOKEN_REPLAY',
  'AUTH',
  userId,
  'UserSession',
  sessionId,
  'HIGH',
  { ipAddress, userAgent, timestamp }
)
```

Logs to `SecurityAudit` table. Severity HIGH → `isSuspicious: true`.

---

## Race Condition Handling

Two concurrent requests using the same refresh token:

1. Both parse token → both load session → both verify secret (succeeds for both)
2. Both attempt atomic swap
3. **At most one succeeds** (PostgreSQL conditional update guarantees this)
4. Second request gets 0 rows affected → treated as replay → family revoked

This is safe. The frozen security policy accepts that race/replay may revoke the affected session/family.

---

## Token Family Revocation

When replay is detected:
- ALL sessions sharing the same `tokenFamilyId` are revoked
- `revokeReason` = `replay_detected`
- No further rotations possible for any token in this family
- User must re-authenticate (fresh login)
