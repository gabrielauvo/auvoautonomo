-- Migration: Add Work Order Types feature
-- This is an ADDITIVE migration - no breaking changes
-- Feature flag: enableWorkOrderTypes (default false)

-- ============================================
-- 1. Create work_order_types table
-- ============================================
CREATE TABLE "work_order_types" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_order_types_pkey" PRIMARY KEY ("id")
);

-- ============================================
-- 2. Add workOrderTypeId to work_orders (nullable for backwards compatibility)
-- ============================================
ALTER TABLE "work_orders" ADD COLUMN "workOrderTypeId" TEXT;

-- ============================================
-- 3. Add feature flag to usage_limits_config
-- ============================================
ALTER TABLE "usage_limits_config" ADD COLUMN "enableWorkOrderTypes" BOOLEAN NOT NULL DEFAULT false;

-- ============================================
-- 4. Create indexes for performance
-- ============================================
CREATE INDEX "work_order_types_userId_idx" ON "work_order_types"("userId");
CREATE INDEX "work_order_types_isActive_idx" ON "work_order_types"("isActive");
CREATE INDEX "work_order_types_updatedAt_idx" ON "work_order_types"("updatedAt");
CREATE UNIQUE INDEX "work_order_types_userId_name_key" ON "work_order_types"("userId", "name");

CREATE INDEX "work_orders_workOrderTypeId_idx" ON "work_orders"("workOrderTypeId");
CREATE INDEX "work_orders_userId_workOrderTypeId_idx" ON "work_orders"("userId", "workOrderTypeId");
CREATE INDEX "work_orders_userId_createdAt_idx" ON "work_orders"("userId", "createdAt");

-- ============================================
-- 5. Add foreign key constraints
-- ============================================
ALTER TABLE "work_order_types" ADD CONSTRAINT "work_order_types_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "work_orders" ADD CONSTRAINT "work_orders_workOrderTypeId_fkey"
    FOREIGN KEY ("workOrderTypeId") REFERENCES "work_order_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
