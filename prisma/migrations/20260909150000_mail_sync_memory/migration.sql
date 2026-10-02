-- Mail sync: leadId nullable, customerId, folder/match metadata, mailbox sync status.
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
