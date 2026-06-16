-- CreateTable
CREATE TABLE "quick_start_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountCompletedAt" TIMESTAMP(3),
    "firstRuleCompletedAt" TIMESTAMP(3),
    "instagramCompletedAt" TIMESTAMP(3),
    "planChosenCompletedAt" TIMESTAMP(3),
    "goLiveCompletedAt" TIMESTAMP(3),
    "celebratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quick_start_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quick_start_progress_userId_key" ON "quick_start_progress"("userId");

-- AddForeignKey
ALTER TABLE "quick_start_progress" ADD CONSTRAINT "quick_start_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
