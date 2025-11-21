-- AlterTable
ALTER TABLE "Document" ADD COLUMN "wasProcessed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Document" ADD COLUMN "validationInfo" TEXT;
ALTER TABLE "Document" ADD COLUMN "errorReason" TEXT;
