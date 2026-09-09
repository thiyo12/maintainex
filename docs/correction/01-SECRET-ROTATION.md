# MaintainEX Secret Rotation Report

Created: Phase 1

## MUST ROTATE BEFORE DEPLOYMENT

These secrets were potentially exposed via the path traversal vulnerability (`/api/files/../../.env`). Any attacker with production access before the fix could have read the `.env` file.

| Variable | Location | Reason |
|---|---|---|
| `NEXTAUTH_SECRET` | VPS env, Dokploy | Used for JWT signing + HMAC. Compromise = full auth bypass |
| `JWT_SECRET` | VPS env, Dokploy | Admin JWT signing. Compromise = admin impersonation |
| `JWT_REFRESH_SECRET` | VPS env, Dokploy | Admin refresh token signing |
| `PASSWORD_PEPPER` | VPS env, Dokploy | Password hash pepper. Compromise = offline brute-force possible |
| `DATABASE_URL` | VPS env, Dokploy | Contains DB credentials. Compromise = full data access |
| `CRON_SECRET` | VPS env, Dokploy | Cron job authentication. Compromise = unauthorized cron execution |

### Rotation Procedure

1. Generate new values for all 6 variables
2. Update VPS environment: `docker exec maintainex-mx-vcaohy env` to verify current values
3. Update Dokploy service configuration with new values
4. Restart container
5. Verify all auth flows work (mobile login, admin login, OTP)
6. Verify cron jobs work
7. Old mobile JWTs will be invalidated — users must re-login

## REVIEW/ROTATE IF EXPOSED

These secrets are lower risk but should be reviewed.

| Variable | Location | Reason |
|---|---|---|
| `CLOUDINARY_API_SECRET` | VPS env, Dokploy | File upload access. Rotate if concerned |
| `CLOUDINARY_API_KEY` | VPS env, Dokploy | File upload access |
| `CLOUDINARY_CLOUD_NAME` | VPS env, Dokploy | Low risk — not a secret per se |

## NO ACTION REQUIRED

| Variable | Reason |
|---|---|
| `NEXTAUTH_URL` | Not a secret — public URL |
| `NODE_ENV` | Not a secret |
| `EXPO_PUBLIC_API_URL` | Public URL |
| `EXPO_PUBLIC_SOCKET_URL` | Public URL |

## Notes

- The path traversal fix is now deployed. The `.env` file is no longer accessible via `/api/files/`.
- After rotation, monitor for any unusual auth activity.
- Consider adding `.env` to a secrets manager rather than plain environment variables.
