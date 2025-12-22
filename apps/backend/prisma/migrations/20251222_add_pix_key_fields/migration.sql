-- Migration: Add Pix Key fields to User and UsageLimitsConfig
-- This is an ADDITIVE migration - no breaking changes

-- Add Pix fields to users table
ALTER TABLE "users" ADD COLUMN "pixKey" TEXT;
ALTER TABLE "users" ADD COLUMN "pixKeyType" TEXT;
ALTER TABLE "users" ADD COLUMN "pixKeyOwnerName" TEXT;
ALTER TABLE "users" ADD COLUMN "pixKeyEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Add enablePixKey to usage_limits_config (feature flag per plan)
ALTER TABLE "usage_limits_config" ADD COLUMN "enablePixKey" BOOLEAN NOT NULL DEFAULT true;
