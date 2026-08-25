-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "profileEnrichedAt" TIMESTAMP(3);
ALTER TABLE "Lead" ADD COLUMN "rating" DOUBLE PRECISION;
ALTER TABLE "Lead" ADD COLUMN "openingHours" TEXT;
ALTER TABLE "Lead" ADD COLUMN "businessStatus" TEXT;
