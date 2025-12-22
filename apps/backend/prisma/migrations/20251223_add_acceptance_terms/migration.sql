-- Migration: Add Acceptance Terms feature for Quote signatures
-- This is an ADDITIVE migration - no breaking changes
-- Feature: Allows paid plans to configure acceptance terms that must be read/accepted before signing quotes

-- =============================================================================
-- TEMPLATE_SETTINGS: Add acceptance terms configuration
-- =============================================================================

-- Enable/disable acceptance terms requirement for this tenant
ALTER TABLE "template_settings" ADD COLUMN "acceptanceTermsEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Timestamp when terms were last updated (for versioning/audit)
ALTER TABLE "template_settings" ADD COLUMN "acceptanceTermsUpdatedAt" TIMESTAMP(3);

-- Version counter for terms (increments each time terms are updated)
ALTER TABLE "template_settings" ADD COLUMN "acceptanceTermsVersion" INTEGER NOT NULL DEFAULT 0;

-- =============================================================================
-- SIGNATURES: Add terms acceptance audit fields
-- =============================================================================

-- Timestamp when the signer accepted the terms (null if terms not required or not accepted)
ALTER TABLE "signatures" ADD COLUMN "termsAcceptedAt" TIMESTAMP(3);

-- SHA256 hash of the terms text at the time of acceptance (for audit/legal proof)
ALTER TABLE "signatures" ADD COLUMN "termsHash" TEXT;

-- Version of the terms that was accepted (references acceptanceTermsVersion)
ALTER TABLE "signatures" ADD COLUMN "termsVersion" INTEGER;

-- =============================================================================
-- USAGE_LIMITS_CONFIG: Add feature flag for acceptance terms
-- =============================================================================

-- Feature flag: only paid plans can use acceptance terms
-- Default: false (FREE plan cannot use)
ALTER TABLE "usage_limits_config" ADD COLUMN "enableAcceptanceTerms" BOOLEAN NOT NULL DEFAULT false;
