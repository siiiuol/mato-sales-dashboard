-- AlterTable
ALTER TABLE "Product" ADD COLUMN "imageUrl" TEXT;

-- CreateTable
CREATE TABLE "LeadComment" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeadComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadComment_leadId_createdAt_idx" ON "LeadComment"("leadId", "createdAt");

-- AddForeignKey
ALTER TABLE "LeadComment" ADD CONSTRAINT "LeadComment_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadComment" ADD CONSTRAINT "LeadComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
