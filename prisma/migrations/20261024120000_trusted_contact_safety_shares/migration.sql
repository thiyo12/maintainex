CREATE TABLE "TrustedContactShare" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "consentedAt" TIMESTAMP(3) NOT NULL,
    "consentVersion" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrustedContactShare_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrustedContactShare_tokenHash_key" ON "TrustedContactShare"("tokenHash");
CREATE INDEX "TrustedContactShare_jobId_actorUserId_expiresAt_idx" ON "TrustedContactShare"("jobId", "actorUserId", "expiresAt");
CREATE INDEX "TrustedContactShare_expiresAt_revokedAt_idx" ON "TrustedContactShare"("expiresAt", "revokedAt");

ALTER TABLE "TrustedContactShare" ADD CONSTRAINT "TrustedContactShare_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "MarketplaceJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
