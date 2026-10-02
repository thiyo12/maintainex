-- CRM approval requests may carry a small action-specific payload.
-- Payload is server-generated, size-limited and bound to idempotency.
ALTER TABLE "CrmApprovalRequest"
ADD COLUMN "actionPayload" TEXT;
