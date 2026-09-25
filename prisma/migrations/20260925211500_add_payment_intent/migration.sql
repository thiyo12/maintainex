-- CreateTable
CREATE TABLE IF NOT EXISTS "PaymentIntent" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "escrowId" TEXT NOT NULL,
    "merchantOrderId" TEXT NOT NULL,
    "paymentId" TEXT,
    "amount" BIGINT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'LKR',
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "gatewayResponse" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "PaymentIntent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentIntent_merchantOrderId_key" ON "PaymentIntent"("merchantOrderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaymentIntent_jobId_idx" ON "PaymentIntent"("jobId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaymentIntent_customerId_idx" ON "PaymentIntent"("customerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaymentIntent_status_idx" ON "PaymentIntent"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PaymentIntent_merchantOrderId_idx" ON "PaymentIntent"("merchantOrderId");
