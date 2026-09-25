-- Release-gate payment hardening:
-- at most one active PayHere PaymentIntent per job.

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY "jobId"
           ORDER BY "createdAt" DESC, id DESC
         ) AS rn
  FROM "PaymentIntent"
  WHERE status IN ('CREATED', 'PENDING')
)
UPDATE "PaymentIntent" p
SET status = 'EXPIRED'
FROM ranked r
WHERE p.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX "PaymentIntent_one_active_per_job"
ON "PaymentIntent" ("jobId")
WHERE status IN ('CREATED', 'PENDING');
