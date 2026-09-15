# ADR-002: 6-Digit PIN for WORK_START Verification

**Status**: Accepted
**Date**: 2026-09-14

## Context

When a service provider arrives at a customer's location, the platform needs a lightweight way for the customer to confirm the provider's identity and authorize job commencement. Traditional methods like photo ID scanning are cumbersome in field conditions, and GPS-only verification does not prove the customer consented to the specific provider.

The verification step must work offline-tolerant, resist social engineering, and complete in under 10 seconds on a mobile device.

Reference: `app/api/mobile/v2/jobs/[id]/pin/route.ts`, `app/api/mobile/v2/jobs/[id]/pin/verify/route.ts`

## Decision

Implement a 6-digit numeric PIN system where:

1. **PIN generation**: The customer generates a 6-digit PIN when the job enters `QUOTE_ACCEPTED` state. The PIN is stored as a salted SHA-256 hash in `JobVerificationPin`.
2. **PIN delivery**: The PIN is communicated out-of-band (verbal, written). It is never transmitted through the platform messaging system to prevent interception.
3. **PIN verification**: The provider enters the PIN on their device. The API hashes the input and compares against the stored hash. On success, the job transitions to `IN_PROGRESS`.
4. **PIN rotation**: Customers can revoke and regenerate a PIN if they suspect compromise (`pin/rotate` endpoint).
5. **PIN revocation**: Customers can explicitly revoke a PIN to cancel the verification attempt (`pin/revoke` endpoint).

### Rate Limiting

- 5 failed verification attempts per PIN triggers a temporary lockout
- PINs expire after 24 hours or when the job status changes, whichever comes first

## Consequences

### Positive
- Zero-friction UX: provider reads 6 digits to the customer over the phone
- Customer controls access: only someone physically present can receive the PIN
- No app installation required on customer side for this step
- Stateless verification: hash comparison with no session management

### Negative
- PIN could be shared verbally to unauthorized parties (mitigated by requiring physical presence)
- 6-digit space (1M combinations) is theoretically brute-forceable (mitigated by rate limiting)

### Neutral
- Aligns with the job lifecycle state machine in `lib/domain/job-lifecycle.ts:44-50`
- Works for both individual and company provider types
