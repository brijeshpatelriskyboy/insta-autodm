-- CreateTable
CREATE TABLE "launch_offer_claims" (
    "id" TEXT NOT NULL,
    "instagramUserId" TEXT NOT NULL,
    "userId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'reserved',
    "checkoutSessionId" TEXT,
    "stripeSubscriptionId" TEXT,
    "reservedUntil" TIMESTAMP(3),
    "redeemedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "launch_offer_claims_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "launch_offer_claims_instagramUserId_key" ON "launch_offer_claims"("instagramUserId");

-- CreateIndex
CREATE UNIQUE INDEX "launch_offer_claims_checkoutSessionId_key" ON "launch_offer_claims"("checkoutSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "launch_offer_claims_stripeSubscriptionId_key" ON "launch_offer_claims"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "launch_offer_claims_userId_idx" ON "launch_offer_claims"("userId");

-- AddForeignKey
ALTER TABLE "launch_offer_claims"
ADD CONSTRAINT "launch_offer_claims_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
