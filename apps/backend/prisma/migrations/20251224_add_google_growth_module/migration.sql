-- CreateEnum
CREATE TYPE "GoogleIntegrationStatus" AS ENUM ('PENDING', 'CONNECTED', 'ERROR', 'DISCONNECTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "DemandEventSource" AS ENUM ('GOOGLE_BUSINESS', 'TRACKING_LINK', 'MANUAL');

-- CreateEnum
CREATE TYPE "DemandActionType" AS ENUM ('CALL', 'ROUTE', 'WEBSITE_CLICK', 'WHATSAPP_CLICK', 'SITE_CLICK', 'PROFILE_VIEW', 'SEARCH_IMPRESSION', 'MAPS_IMPRESSION');

-- CreateEnum
CREATE TYPE "DemandPeriodType" AS ENUM ('DAY', 'WEEK', 'MONTH');

-- CreateEnum
CREATE TYPE "AttributionLinkType" AS ENUM ('WHATSAPP', 'WEBSITE');

-- CreateEnum
CREATE TYPE "GrowthInsightType" AS ENUM ('CONVERSION_DROP', 'ACTION_SPIKE', 'LOW_CONVERSION_RATE', 'CHANNEL_COMPARISON', 'WEEKLY_SUMMARY', 'GOAL_ACHIEVED');

-- CreateEnum
CREATE TYPE "GrowthInsightSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL', 'SUCCESS');

-- CreateEnum
CREATE TYPE "AttributionConfidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'NONE');

-- CreateEnum
CREATE TYPE "QuoteOriginSource" AS ENUM ('GOOGLE_BUSINESS', 'DIRECT', 'REFERRAL', 'SOCIAL_MEDIA', 'OTHER', 'UNKNOWN');

-- CreateTable
CREATE TABLE "google_integrations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "googleAccountId" TEXT,
    "googleLocationId" TEXT,
    "googleLocationName" TEXT,
    "status" "GoogleIntegrationStatus" NOT NULL DEFAULT 'PENDING',
    "scopes" TEXT[],
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_tokens" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demand_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "DemandEventSource" NOT NULL,
    "actionType" "DemandActionType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "periodType" "DemandPeriodType" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 1,
    "dimensions" JSONB,
    "rawRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demand_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attribution_links" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "AttributionLinkType" NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attribution_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "growth_insights" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "GrowthInsightType" NOT NULL,
    "severity" "GrowthInsightSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "recommendations" JSONB NOT NULL,
    "metrics" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isDismissed" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "growth_insights_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "google_integrations_userId_key" ON "google_integrations"("userId");

-- CreateIndex
CREATE INDEX "google_integrations_userId_idx" ON "google_integrations"("userId");

-- CreateIndex
CREATE INDEX "google_integrations_status_idx" ON "google_integrations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "google_tokens_integrationId_key" ON "google_tokens"("integrationId");

-- CreateIndex
CREATE INDEX "demand_events_userId_idx" ON "demand_events"("userId");

-- CreateIndex
CREATE INDEX "demand_events_userId_occurredAt_idx" ON "demand_events"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "demand_events_userId_actionType_idx" ON "demand_events"("userId", "actionType");

-- CreateIndex
CREATE INDEX "demand_events_userId_source_occurredAt_idx" ON "demand_events"("userId", "source", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "demand_events_userId_source_actionType_periodType_periodSta_key" ON "demand_events"("userId", "source", "actionType", "periodType", "periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "attribution_links_slug_key" ON "attribution_links"("slug");

-- CreateIndex
CREATE INDEX "attribution_links_userId_idx" ON "attribution_links"("userId");

-- CreateIndex
CREATE INDEX "attribution_links_slug_idx" ON "attribution_links"("slug");

-- CreateIndex
CREATE INDEX "growth_insights_userId_idx" ON "growth_insights"("userId");

-- CreateIndex
CREATE INDEX "growth_insights_userId_isRead_idx" ON "growth_insights"("userId", "isRead");

-- CreateIndex
CREATE INDEX "growth_insights_userId_createdAt_idx" ON "growth_insights"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "google_integrations" ADD CONSTRAINT "google_integrations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_tokens" ADD CONSTRAINT "google_tokens_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "google_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demand_events" ADD CONSTRAINT "demand_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attribution_links" ADD CONSTRAINT "attribution_links_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_insights" ADD CONSTRAINT "growth_insights_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
