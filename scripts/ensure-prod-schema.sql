-- Run in Supabase SQL Editor (Dashboard → SQL → New query) as postgres.
-- Idempotent: veilig opnieuw draaien. Repareert schema-drift t.o.v. MATO OS Prisma.

-- User (team/commissie/login)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "monthlyCost" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "commissionType" TEXT NOT NULL DEFAULT 'PERCENT';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "commissionValue" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "rentalCommissionFixed" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sessionVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mailStyleNotes" TEXT;

-- Customer (shop/team)
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'BUYER';
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "ownerId" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "nextActionAt" TIMESTAMP(3);

-- AppSettings (Vandaag/shop)
ALTER TABLE "AppSettings" ADD COLUMN IF NOT EXISTS "shopCapacity" INTEGER NOT NULL DEFAULT 8;
ALTER TABLE "AppSettings" ADD COLUMN IF NOT EXISTS "anthropicApiKey" TEXT NOT NULL DEFAULT '';
ALTER TABLE "AppSettings" ADD COLUMN IF NOT EXISTS "anthropicModel" TEXT NOT NULL DEFAULT 'claude-opus-5';

-- Lead (chat/campagnes/profiel)
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "lossReason" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "parkedUntil" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "campaignId" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "profileEnrichedAt" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "rating" DOUBLE PRECISION;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "openingHours" TEXT;
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "businessStatus" TEXT;

-- Deal
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "expectedValue" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Product
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;

-- MachinePlacement (ontbreekt vaak volledig op oude productie-DB)
CREATE TABLE IF NOT EXISTS "MachinePlacement" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "productId" TEXT,
  "dealId" TEXT,
  "model" TEXT,
  "serialNumber" TEXT,
  "address" TEXT,
  "city" TEXT,
  "site" TEXT NOT NULL DEFAULT 'EXTERNAL',
  "contractType" TEXT,
  "contractRef" TEXT,
  "shopSlot" INTEGER,
  "contractStartedAt" TIMESTAMP(3),
  "contractEndsAt" TIMESTAMP(3),
  "noticePeriodDays" INTEGER NOT NULL DEFAULT 30,
  "renewalStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
  "placedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "removedAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MachinePlacement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MachinePlacement_customerId_idx" ON "MachinePlacement"("customerId");
CREATE INDEX IF NOT EXISTS "MachinePlacement_site_status_idx" ON "MachinePlacement"("site", "status");
CREATE INDEX IF NOT EXISTS "MachinePlacement_site_shopSlot_idx" ON "MachinePlacement"("site", "shopSlot");
CREATE INDEX IF NOT EXISTS "MachinePlacement_site_status_contractStartedAt_idx" ON "MachinePlacement"("site", "status", "contractStartedAt");
CREATE INDEX IF NOT EXISTS "MachinePlacement_site_status_contractEndsAt_idx" ON "MachinePlacement"("site", "status", "contractEndsAt");
CREATE INDEX IF NOT EXISTS "Customer_ownerId_idx" ON "Customer"("ownerId");
CREATE INDEX IF NOT EXISTS "Customer_kind_idx" ON "Customer"("kind");
CREATE INDEX IF NOT EXISTS "Lead_campaignId_idx" ON "Lead"("campaignId");

-- LeadComment (teamchat op leadfiche)
CREATE TABLE IF NOT EXISTS "LeadComment" (
  "id" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadComment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "LeadComment_leadId_createdAt_idx" ON "LeadComment"("leadId", "createdAt");

-- MailExample
CREATE TABLE IF NOT EXISTS "MailExample" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "approved" BOOLEAN NOT NULL DEFAULT true,
  "sourceMailMessageId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MailExample_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MailExample_userId_approved_createdAt_idx" ON "MailExample"("userId", "approved", "createdAt");

-- ShopWaitlist
CREATE TABLE IF NOT EXISTS "ShopWaitlist" (
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
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShopWaitlist_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ShopWaitlist_status_createdAt_idx" ON "ShopWaitlist"("status", "createdAt");

-- ContentItem
CREATE TABLE IF NOT EXISTS "ContentItem" (
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
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContentItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ContentItem_status_plannedAt_idx" ON "ContentItem"("status", "plannedAt");

-- Deal indexes (team/rapporten)
CREATE INDEX IF NOT EXISTS "Deal_ownerId_stage_expectedCloseAt_idx" ON "Deal"("ownerId", "stage", "expectedCloseAt");
CREATE INDEX IF NOT EXISTS "Deal_stage_updatedAt_idx" ON "Deal"("stage", "updatedAt");

-- Mail sync (fase 1): klantgeheugen vereist nullable leadId + customerId
ALTER TABLE "MailMessage" ALTER COLUMN "leadId" DROP NOT NULL;
ALTER TABLE "MailMessage" ADD COLUMN IF NOT EXISTS "customerId" TEXT;
ALTER TABLE "MailMessage" ADD COLUMN IF NOT EXISTS "folder" TEXT;
ALTER TABLE "MailMessage" ADD COLUMN IF NOT EXISTS "matchedBy" TEXT;
ALTER TABLE "MailMessage" ADD COLUMN IF NOT EXISTS "matchConfidence" DOUBLE PRECISION;
CREATE INDEX IF NOT EXISTS "MailMessage_customerId_idx" ON "MailMessage"("customerId");
CREATE INDEX IF NOT EXISTS "MailMessage_userId_direction_occurredAt_idx" ON "MailMessage"("userId", "direction", "occurredAt");
CREATE INDEX IF NOT EXISTS "MailMessage_leadId_matchedBy_idx" ON "MailMessage"("leadId", "matchedBy");

ALTER TABLE "MailboxConnection" ADD COLUMN IF NOT EXISTS "lastSyncAt" TIMESTAMP(3);
ALTER TABLE "MailboxConnection" ADD COLUMN IF NOT EXISTS "syncError" TEXT;

-- Customer Memory (fase 2)
CREATE TABLE IF NOT EXISTS "CustomerFact" (
  "id" TEXT NOT NULL,
  "customerId" TEXT,
  "leadId" TEXT,
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'SUGGESTED',
  "source" TEXT NOT NULL,
  "sourceMailId" TEXT,
  "sourceCommentId" TEXT,
  "confirmedById" TEXT,
  "confirmedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerFact_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CustomerFact_customerId_status_idx" ON "CustomerFact"("customerId", "status");
CREATE INDEX IF NOT EXISTS "CustomerFact_leadId_status_idx" ON "CustomerFact"("leadId", "status");
CREATE INDEX IF NOT EXISTS "CustomerFact_sourceMailId_idx" ON "CustomerFact"("sourceMailId");
CREATE INDEX IF NOT EXISTS "CustomerFact_key_status_idx" ON "CustomerFact"("key", "status");

ALTER TABLE "MailMessage" ADD COLUMN IF NOT EXISTS "aiExtract" TEXT;
ALTER TABLE "MailMessage" ADD COLUMN IF NOT EXISTS "aiExtractedAt" TIMESTAMP(3);

-- Website inbound
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "sourceDetail" TEXT;

CREATE TABLE IF NOT EXISTS "InboundSubmission" (
  "id" TEXT NOT NULL,
  "payload" TEXT NOT NULL,
  "channel" TEXT NOT NULL DEFAULT 'website',
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "leadId" TEXT,
  "error" TEXT,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  CONSTRAINT "InboundSubmission_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "InboundSubmission_status_receivedAt_idx" ON "InboundSubmission"("status", "receivedAt");
CREATE INDEX IF NOT EXISTS "InboundSubmission_leadId_idx" ON "InboundSubmission"("leadId");

-- Deal economics
ALTER TABLE "DealLine" ADD COLUMN IF NOT EXISTS "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "setupCost" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "monthlyCost" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Deal" ADD COLUMN IF NOT EXISTS "commissionCost" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Shop economics
ALTER TABLE "MachinePlacement" ADD COLUMN IF NOT EXISTS "monthlyFee" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "MachinePlacement" ADD COLUMN IF NOT EXISTS "commissionPct" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "MachinePlacement" ADD COLUMN IF NOT EXISTS "minimumTurnover" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "MachinePlacement" ADD COLUMN IF NOT EXISTS "terminalCost" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "MachinePlacement" ADD COLUMN IF NOT EXISTS "installCost" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Kaigo / supplier orders
CREATE TABLE IF NOT EXISTS "SupplierOrder" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "supplierId" TEXT NOT NULL,
  "dealId" TEXT,
  "customerId" TEXT,
  "sourcingRequestId" TEXT,
  "notes" TEXT,
  "orderedAt" TIMESTAMP(3),
  "expectedAt" TIMESTAMP(3),
  "receivedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierOrder_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SupplierOrder_code_key" ON "SupplierOrder"("code");
CREATE INDEX IF NOT EXISTS "SupplierOrder_status_expectedAt_idx" ON "SupplierOrder"("status", "expectedAt");
CREATE INDEX IF NOT EXISTS "SupplierOrder_supplierId_idx" ON "SupplierOrder"("supplierId");
CREATE INDEX IF NOT EXISTS "SupplierOrder_dealId_idx" ON "SupplierOrder"("dealId");
CREATE INDEX IF NOT EXISTS "SupplierOrder_customerId_idx" ON "SupplierOrder"("customerId");
CREATE INDEX IF NOT EXISTS "SupplierOrder_sourcingRequestId_idx" ON "SupplierOrder"("sourcingRequestId");

-- Cameraverkeer: persoonsdetecties die UniFi Protect via de Alarm Manager-webhook doorstuurt.
CREATE TABLE IF NOT EXISTS "CameraEvent" (
  "id" TEXT NOT NULL,
  "cameraName" TEXT,
  "cameraId" TEXT,
  "eventType" TEXT NOT NULL DEFAULT 'person',
  "occurredAt" TIMESTAMP(3),
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "raw" TEXT NOT NULL,
  CONSTRAINT "CameraEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CameraEvent_occurredAt_idx" ON "CameraEvent"("occurredAt");
CREATE INDEX IF NOT EXISTS "CameraEvent_cameraName_occurredAt_idx" ON "CameraEvent"("cameraName", "occurredAt");

-- Geheim voor de UniFi-webhook, naast de andere sleutels in AppSettings.
ALTER TABLE "AppSettings" ADD COLUMN IF NOT EXISTS "unifiWebhookSecret" TEXT NOT NULL DEFAULT '';

-- Deelbare livestreams per camera (naam = url, één per regel).
ALTER TABLE "AppSettings" ADD COLUMN IF NOT EXISTS "cameraStreams" TEXT NOT NULL DEFAULT '';
