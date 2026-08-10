-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CampaignCodeStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'CLAIMED', 'REDEEMED', 'DISABLED');

-- CreateEnum
CREATE TYPE "CampaignClaimDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'EXHAUSTED');

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "keywordRuleId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "maxClaims" INTEGER NOT NULL,
    "claimedCount" INTEGER NOT NULL DEFAULT 0,
    "dmTemplate" TEXT NOT NULL,
    "soldOutMessage" TEXT NOT NULL,
    "alreadyClaimedMessage" TEXT NOT NULL,
    "notStartedMessage" TEXT,
    "endedMessage" TEXT,
    "redemptionEnabled" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_codes" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "CampaignCodeStatus" NOT NULL DEFAULT 'AVAILABLE',
    "reservedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "redeemedAt" TIMESTAMP(3),
    "qrPayload" TEXT,
    "barcodeValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_claims" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "campaignCodeId" TEXT NOT NULL,
    "sourceCommentId" TEXT NOT NULL,
    "instagramCommenterId" TEXT,
    "instagramUsername" TEXT,
    "dmEventId" TEXT,
    "deliveryStatus" "CampaignClaimDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "claimedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_claims_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "campaigns_userId_status_idx" ON "campaigns"("userId", "status");

-- CreateIndex
CREATE INDEX "campaigns_keywordRuleId_status_idx" ON "campaigns"("keywordRuleId", "status");

-- CreateIndex
CREATE INDEX "campaign_codes_campaignId_status_idx" ON "campaign_codes"("campaignId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_codes_campaignId_code_key" ON "campaign_codes"("campaignId", "code");

-- CreateIndex
CREATE INDEX "campaign_claims_campaignId_claimedAt_idx" ON "campaign_claims"("campaignId", "claimedAt");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_claims_campaignCodeId_key" ON "campaign_claims"("campaignCodeId");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_claims_campaignId_sourceCommentId_key" ON "campaign_claims"("campaignId", "sourceCommentId");

-- Partial unique: one ACTIVE campaign per KeywordRule
CREATE UNIQUE INDEX "campaigns_one_active_per_rule"
ON "campaigns"("keywordRuleId")
WHERE status = 'ACTIVE';

-- Partial unique: one claim per commenter per campaign when commenter id is present
CREATE UNIQUE INDEX "campaign_claims_one_per_commenter"
ON "campaign_claims"("campaignId", "instagramCommenterId")
WHERE "instagramCommenterId" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_keywordRuleId_fkey" FOREIGN KEY ("keywordRuleId") REFERENCES "keyword_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_codes" ADD CONSTRAINT "campaign_codes_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_claims" ADD CONSTRAINT "campaign_claims_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_claims" ADD CONSTRAINT "campaign_claims_campaignCodeId_fkey" FOREIGN KEY ("campaignCodeId") REFERENCES "campaign_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_claims" ADD CONSTRAINT "campaign_claims_dmEventId_fkey" FOREIGN KEY ("dmEventId") REFERENCES "dm_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
