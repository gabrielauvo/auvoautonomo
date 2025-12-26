-- AI Copilot Module Migration
-- This migration adds the AI Copilot tables for the transactional AI assistant

-- CreateEnum
CREATE TYPE "AiConversationStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AiPlanStatus" AS ENUM ('PENDING_CONFIRMATION', 'CONFIRMED', 'EXECUTING', 'COMPLETED', 'FAILED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AiActionType" AS ENUM ('READ', 'CREATE', 'UPDATE', 'DELETE', 'SEND', 'PAYMENT_CREATE', 'PAYMENT_SEND');

-- CreateEnum
CREATE TYPE "AiAuditCategory" AS ENUM ('TOOL_CALL', 'PLAN_CREATED', 'PLAN_CONFIRMED', 'PLAN_REJECTED', 'PLAN_EXECUTED', 'ACTION_SUCCESS', 'ACTION_FAILED', 'SECURITY_BLOCK', 'RATE_LIMIT');

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "status" "AiConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "lastMessageAt" TIMESTAMP(3),
    "metadata" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "toolCalls" JSONB,
    "toolResults" JSONB,
    "tokenCount" INTEGER,
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_plans" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "actions" JSONB NOT NULL,
    "status" "AiPlanStatus" NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    "idempotencyKey" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "resultSummary" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_payment_previews" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "billingType" TEXT NOT NULL,
    "value" DECIMAL(15,2) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "valid" BOOLEAN NOT NULL DEFAULT true,
    "validatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdPaymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_payment_previews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT,
    "planId" TEXT,
    "category" "AiAuditCategory" NOT NULL,
    "tool" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "inputPayload" JSONB,
    "outputPayload" JSONB,
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_conversations_userId_idx" ON "ai_conversations"("userId");

-- CreateIndex
CREATE INDEX "ai_conversations_userId_status_idx" ON "ai_conversations"("userId", "status");

-- CreateIndex
CREATE INDEX "ai_conversations_expiresAt_idx" ON "ai_conversations"("expiresAt");

-- CreateIndex
CREATE INDEX "ai_messages_conversationId_idx" ON "ai_messages"("conversationId");

-- CreateIndex
CREATE INDEX "ai_messages_conversationId_createdAt_idx" ON "ai_messages"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ai_plans_idempotencyKey_key" ON "ai_plans"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ai_plans_conversationId_idx" ON "ai_plans"("conversationId");

-- CreateIndex
CREATE INDEX "ai_plans_userId_idx" ON "ai_plans"("userId");

-- CreateIndex
CREATE INDEX "ai_plans_status_idx" ON "ai_plans"("status");

-- CreateIndex
CREATE INDEX "ai_plans_expiresAt_idx" ON "ai_plans"("expiresAt");

-- CreateIndex
CREATE INDEX "ai_payment_previews_planId_idx" ON "ai_payment_previews"("planId");

-- CreateIndex
CREATE INDEX "ai_payment_previews_clientId_idx" ON "ai_payment_previews"("clientId");

-- CreateIndex
CREATE INDEX "ai_audit_logs_userId_idx" ON "ai_audit_logs"("userId");

-- CreateIndex
CREATE INDEX "ai_audit_logs_userId_createdAt_idx" ON "ai_audit_logs"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_audit_logs_conversationId_idx" ON "ai_audit_logs"("conversationId");

-- CreateIndex
CREATE INDEX "ai_audit_logs_planId_idx" ON "ai_audit_logs"("planId");

-- CreateIndex
CREATE INDEX "ai_audit_logs_category_idx" ON "ai_audit_logs"("category");

-- CreateIndex
CREATE INDEX "ai_audit_logs_entityType_entityId_idx" ON "ai_audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ai_audit_logs_createdAt_idx" ON "ai_audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_plans" ADD CONSTRAINT "ai_plans_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_payment_previews" ADD CONSTRAINT "ai_payment_previews_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ai_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_audit_logs" ADD CONSTRAINT "ai_audit_logs_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ai_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
