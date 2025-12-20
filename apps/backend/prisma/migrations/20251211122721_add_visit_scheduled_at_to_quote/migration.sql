-- AlterTable
ALTER TABLE "quotes" ADD COLUMN     "visitScheduledAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "quotes_visitScheduledAt_idx" ON "quotes"("visitScheduledAt");
