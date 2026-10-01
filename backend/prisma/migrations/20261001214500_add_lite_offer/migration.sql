CREATE TABLE "lite_offer_claims" (
    "id" TEXT NOT NULL,
    "instagramUserId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lite_offer_claims_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lite_offer_claims_instagramUserId_key" ON "lite_offer_claims"("instagramUserId");
CREATE UNIQUE INDEX "lite_offer_claims_userId_key" ON "lite_offer_claims"("userId");

ALTER TABLE "lite_offer_claims"
ADD CONSTRAINT "lite_offer_claims_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
