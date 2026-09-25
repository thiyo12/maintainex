-- Release-gate hardening: prevent concurrent duplicate active quotes
-- while preserving historical quote revisions.

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY "jobId", "providerId"
           ORDER BY "createdAt" DESC, id DESC
         ) AS rn
  FROM "JobQuote"
  WHERE status = 'PENDING'
)
UPDATE "JobQuote" q
SET status = 'SUPERSEDED'
FROM ranked r
WHERE q.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX "JobQuote_one_pending_per_provider_job"
ON "JobQuote" ("jobId", "providerId")
WHERE status = 'PENDING';
