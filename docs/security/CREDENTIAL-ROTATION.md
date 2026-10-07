# MaintainEX Credential Rotation Procedure

This runbook is for production credential compromise, suspected exposure, scheduled rotation, or public-repository history cleanup.

## Rules

1. Treat a credential as compromised if it was ever committed publicly, pasted into a public issue/log, included in a client bundle, or otherwise exposed outside the intended secret store.
2. Removing a secret from Git history does **not** make the old credential safe. Rotate it.
3. Never paste old or new secret values into GitHub issues, PRs, CI logs, screenshots, documentation, or chat transcripts.
4. Rotate one security domain at a time with a rollback plan.
5. Verify the new credential in production, then revoke the old credential.
6. Record only non-secret evidence: credential name, rotation time, owner, verification status, and old-credential revocation status.

## Rotation order after broad compromise

1. Cloudflare / DNS / edge administration
2. GitHub / deployment tokens
3. VPS / SSH credentials
4. PostgreSQL credentials
5. payment-provider credentials
6. JWT / session-signing secrets
7. internal sync / cron secrets
8. KYC/storage/email credentials

Prioritize credentials that can produce infrastructure takeover or financial movement.

## PostgreSQL

- Create a new strong application password.
- Update production `DATABASE_URL` in the deployment secret store.
- Restart/roll the application and verify readiness.
- Confirm Prisma can connect and migration status is clean.
- Revoke the old DB password.
- Verify the DB is not publicly reachable.
- Do not print the URL or password in the rotation receipt.

## JWT / session secrets

Relevant domains include:

- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `MARKETPLACE_JWT_SECRET`
- `STAFF_JWT_SECRET`
- `NEXTAUTH_SECRET` while legacy compatibility remains

Requirements:

- use independent random values
- do not reuse a secret between marketplace and staff authentication
- expect active tokens/sessions signed with replaced keys to become invalid unless a controlled multi-key rotation mechanism exists
- revoke server-side sessions as part of emergency rotation
- verify login, refresh, logout, and revoked-session behavior after rotation

## Peppers / internal service secrets

- `PASSWORD_PEPPER`
- `IDENTITY_CLAIM_PEPPER`
- `INTERNAL_SYNC_SECRET`
- `CRON_SECRET`

Do not reuse these values.

Changing password or identity peppers may require an explicit data-migration/reverification strategy. Do not rotate those blindly on a live database without understanding how existing hashes are verified.

For `INTERNAL_SYNC_SECRET` and `CRON_SECRET`, update all authorized callers and then revoke the old value.

## PayPal

Rotate in the provider dashboard:

- client secret
- webhook configuration/ID when required by the incident
- any compromised client ID where provider procedure requires it

Then:

- update server-only deployment variables
- verify production uses `PAYPAL_SANDBOX=false`
- verify configured live markets explicitly
- run PayPal sandbox/live-safe reconciliation checks as appropriate
- revoke the compromised credential
- verify webhook signature validation still succeeds

Never place PayPal secrets under `NEXT_PUBLIC_*` or `EXPO_PUBLIC_*`.

## PayHere

PayHere is legacy/read-only for new checkout, but historical refund/reconciliation credentials remain sensitive.

Rotate as applicable:

- merchant secret
- Merchant API app secret
- other provider credentials required by PayHere

Then verify:

- `PAYHERE_SANDBOX=false` for production reconciliation
- historical retrieval/refund still works
- new customer checkout remains disabled

## Cloudinary / storage

Rotate server-side API secrets and verify that only public identifiers/URLs needed by clients are exposed. Review KYC/private-file delivery separately before revoking old keys.

## SMTP

Rotate the app password/token, update the secret store, verify password-reset/OTP email delivery, then revoke the old credential.

## GitHub / CI / deployment

- revoke exposed personal access tokens, deploy keys, or app tokens
- use least-privilege GitHub App/workflow permissions where possible
- verify required security workflows still run after rotation
- never store production secret values in repository variables intended for public display

## Rotation receipt

Store only:

- credential name
- incident/change reference
- rotated_at
- rotated_by
- production updated: yes/no
- verification passed: yes/no
- old credential revoked: yes/no
- follow-up required

Never store the secret itself or a reversible derivative.

## Release gate

Phase 2 cannot be PASS if any credential known to have been exposed publicly remains active.
