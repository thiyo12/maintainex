-- Phase 10.2 Closure Hardening: ProviderOpportunity XOR constraint
-- Defense-in-depth: exactly one of taskerId/companyId must be non-null

ALTER TABLE "ProviderOpportunity"
  ADD CONSTRAINT "ProviderOpportunity_xor_provider"
  CHECK (
    ("taskerId" IS NOT NULL AND "companyId" IS NULL)
    OR
    ("taskerId" IS NULL AND "companyId" IS NOT NULL)
  );
