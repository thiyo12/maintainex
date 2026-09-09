# 03E — Deployment Gate

## Pre-Deployment Checklist

### Environment Variables Required

| Variable | Purpose | Required |
|----------|---------|----------|
| MARKETPLACE_JWT_SECRET | Marketplace JWT signing | YES |
| STAFF_JWT_SECRET | Staff JWT signing | YES |
| CRON_SECRET | Machine auth (cron jobs) | YES |
| INTERNAL_SYNC_SECRET | Machine auth (IP blocklist sync) | YES |
| NEXTAUTH_SECRET | Legacy mobile compat (optional) | OPTIONAL |
| LEGACY_MOBILE_AUTH_CUTOFF | Legacy mobile cutoff (optional) | OPTIONAL |

### Migration Order

1. Apply `20260907000001_add_token_family_id_to_admin_session` to production DB
2. Apply `20260907000002_drop_admin_refresh_token` to production DB
3. Deploy new code with both secrets configured
4. All existing staff will be forced to re-login (HMAC tokens rejected)

### What Breaks on Deploy

- All existing admin web sessions invalidated (HMAC → canonical JWT)
- Admin users must re-login with email/password
- 2FA users must complete TOTP verification
- Old `admin_token` cookies are incompatible

### What Does NOT Break

- Mobile app sessions (marketplace auth unchanged)
- Mobile app refresh flow (unchanged)
- API health endpoints (public)
- Waitlist endpoints (public)

### Rollback

If issues arise:
1. Revert to previous Docker image
2. Keep `AdminRefreshToken` table (it's empty, no harm)
3. `tokenFamilyId` column is additive, no harm

### Post-Deployment Verification

1. Login as admin → verify dashboard loads
2. Login with 2FA → verify TOTP flow works
3. Refresh admin page → verify session persists
4. Logout → verify redirect to login
5. Mobile app → verify login/refresh still works
