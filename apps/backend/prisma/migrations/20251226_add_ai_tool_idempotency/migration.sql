-- AI Tool Idempotency Migration
-- This migration adds idempotency tracking for AI tool executions

-- CreateTable
CREATE TABLE "ai_tool_idempotency" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "toolName" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "entityIds" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_tool_idempotency_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Unique constraint on userId + toolName + idempotencyKey
CREATE UNIQUE INDEX "ai_tool_idempotency_userId_toolName_idempotencyKey_key" ON "ai_tool_idempotency"("userId", "toolName", "idempotencyKey");

-- CreateIndex: For cleanup queries
CREATE INDEX "ai_tool_idempotency_expiresAt_idx" ON "ai_tool_idempotency"("expiresAt");

-- CreateIndex: For lookups
CREATE INDEX "ai_tool_idempotency_userId_idx" ON "ai_tool_idempotency"("userId");

-- Add expiresAt to ai_payment_previews if not exists
ALTER TABLE "ai_payment_previews" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
ALTER TABLE "ai_payment_previews" ADD COLUMN IF NOT EXISTS "usedAt" TIMESTAMP(3);

-- Update expiresAt for existing records
UPDATE "ai_payment_previews" SET "expiresAt" = "createdAt" + INTERVAL '5 minutes' WHERE "expiresAt" IS NULL;

-- AddForeignKey
ALTER TABLE "ai_tool_idempotency" ADD CONSTRAINT "ai_tool_idempotency_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
