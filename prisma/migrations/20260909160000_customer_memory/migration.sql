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
