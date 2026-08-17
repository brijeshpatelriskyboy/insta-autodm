-- CreateTable
CREATE TABLE "meta_data_deletion_requests" (
    "id" TEXT NOT NULL,
    "confirmationCode" TEXT NOT NULL,
    "metaUserId" TEXT NOT NULL,
    "userId" TEXT,
    "instagramAccountId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'received',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "meta_data_deletion_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "meta_data_deletion_requests_confirmationCode_key" ON "meta_data_deletion_requests"("confirmationCode");

-- CreateIndex
CREATE INDEX "meta_data_deletion_requests_metaUserId_idx" ON "meta_data_deletion_requests"("metaUserId");
