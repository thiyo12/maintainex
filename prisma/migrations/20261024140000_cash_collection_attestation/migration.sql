-- Cash selection is not evidence that the provider received money.
-- New nullable amount/timestamps preserve legacy rows without backfilling cash.
ALTER TABLE "JobEscrow"
  ADD COLUMN "cashCollectedMinor" BIGINT,
  ADD COLUMN "cashCollectionStatus" TEXT NOT NULL DEFAULT 'NOT_REPORTED',
  ADD COLUMN "cashReportedAt" TIMESTAMP(3),
  ADD COLUMN "cashReportedBy" TEXT,
  ADD COLUMN "cashCollectionConfirmedAt" TIMESTAMP(3);
