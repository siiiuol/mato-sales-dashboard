-- AlterTable
ALTER TABLE "Lead"
ADD COLUMN "lossReason" TEXT,
ADD COLUMN "parkedUntil" TIMESTAMP(3),
ADD COLUMN "campaignId" TEXT;

-- AlterTable
ALTER TABLE "Deal"
ADD COLUMN "expectedValue" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "MachinePlacement"
ADD COLUMN "contractEndsAt" TIMESTAMP(3),
ADD COLUMN "noticePeriodDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN "renewalStatus" TEXT NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "User"
ADD COLUMN "mailStyleNotes" TEXT;

-- CreateTable
CREATE TABLE "MailExample" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "approved" BOOLEAN NOT NULL DEFAULT true,
    "sourceMailMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailExample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopWaitlist" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "preferredSlot" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "leadId" TEXT,
    "convertedCustomerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopWaitlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentItem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "plannedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "customerId" TEXT,
    "machinePlacementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Deal_ownerId_stage_expectedCloseAt_idx"
ON "Deal"("ownerId", "stage", "expectedCloseAt");

-- CreateIndex
CREATE INDEX "Deal_stage_updatedAt_idx"
ON "Deal"("stage", "updatedAt");

-- CreateIndex
CREATE INDEX "MachinePlacement_site_status_contractEndsAt_idx"
ON "MachinePlacement"("site", "status", "contractEndsAt");

-- CreateIndex
CREATE INDEX "MailExample_userId_approved_createdAt_idx"
ON "MailExample"("userId", "approved", "createdAt");

-- CreateIndex
CREATE INDEX "ShopWaitlist_status_createdAt_idx"
ON "ShopWaitlist"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_campaignId_idx" ON "Lead"("campaignId");

-- CreateIndex
CREATE INDEX "ContentItem_status_plannedAt_idx"
ON "ContentItem"("status", "plannedAt");

-- AddForeignKey
ALTER TABLE "MailExample"
ADD CONSTRAINT "MailExample_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopWaitlist"
ADD CONSTRAINT "ShopWaitlist_leadId_fkey"
FOREIGN KEY ("leadId") REFERENCES "Lead"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead"
ADD CONSTRAINT "Lead_campaignId_fkey"
FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentItem"
ADD CONSTRAINT "ContentItem_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentItem"
ADD CONSTRAINT "ContentItem_machinePlacementId_fkey"
FOREIGN KEY ("machinePlacementId") REFERENCES "MachinePlacement"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
