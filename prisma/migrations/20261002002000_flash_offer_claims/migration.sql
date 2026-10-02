CREATE TABLE "FlashOfferClaim" (
    "id" TEXT NOT NULL,
    "flashOfferId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlashOfferClaim_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FlashOfferClaim_flashOfferId_userId_key"
ON "FlashOfferClaim"("flashOfferId", "userId");

CREATE INDEX "FlashOfferClaim_userId_claimedAt_idx"
ON "FlashOfferClaim"("userId", "claimedAt");

ALTER TABLE "FlashOfferClaim"
ADD CONSTRAINT "FlashOfferClaim_flashOfferId_fkey"
FOREIGN KEY ("flashOfferId") REFERENCES "FlashOffer"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
