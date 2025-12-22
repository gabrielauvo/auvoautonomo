-- AddInventoryModule
-- Migration to add inventory/stock control functionality

-- Create enum types for inventory
CREATE TYPE "InventoryMovementType" AS ENUM ('ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'WORK_ORDER_OUT', 'INITIAL');
CREATE TYPE "InventoryMovementSource" AS ENUM ('MANUAL', 'WORK_ORDER', 'IMPORT', 'SYSTEM');

-- Add feature flag to usage_limits_config
ALTER TABLE "usage_limits_config" ADD COLUMN "enableInventory" BOOLEAN NOT NULL DEFAULT false;

-- Create inventory_settings table (per user configuration)
CREATE TABLE "inventory_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "deductOnStatus" "WorkOrderStatus" NOT NULL DEFAULT 'DONE',
    "allowNegativeStock" BOOLEAN NOT NULL DEFAULT false,
    "deductOnlyOncePerWorkOrder" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_settings_pkey" PRIMARY KEY ("id")
);

-- Create inventory_balances table (current stock per product)
CREATE TABLE "inventory_balances" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DECIMAL(15,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_balances_pkey" PRIMARY KEY ("id")
);

-- Create inventory_movements table (ledger for audit trail)
CREATE TABLE "inventory_movements" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "type" "InventoryMovementType" NOT NULL,
    "source" "InventoryMovementSource" NOT NULL,
    "quantity" DECIMAL(15,4) NOT NULL,
    "balanceAfter" DECIMAL(15,4) NOT NULL,
    "sourceId" TEXT,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- Create work_order_inventory_deductions table (idempotency control)
CREATE TABLE "work_order_inventory_deductions" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "deductedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "itemsCount" INTEGER NOT NULL,
    "notes" TEXT,

    CONSTRAINT "work_order_inventory_deductions_pkey" PRIMARY KEY ("id")
);

-- Add unique constraints
ALTER TABLE "inventory_settings" ADD CONSTRAINT "inventory_settings_userId_key" UNIQUE ("userId");
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_itemId_key" UNIQUE ("itemId");
ALTER TABLE "work_order_inventory_deductions" ADD CONSTRAINT "work_order_inventory_deductions_workOrderId_key" UNIQUE ("workOrderId");

-- Add idempotency constraint for movements (prevents duplicate deductions)
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movement_idempotency" UNIQUE ("itemId", "source", "sourceId");

-- Add foreign key constraints
ALTER TABLE "inventory_settings" ADD CONSTRAINT "inventory_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "work_order_inventory_deductions" ADD CONSTRAINT "work_order_inventory_deductions_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "work_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create indexes for performance
CREATE INDEX "inventory_settings_userId_idx" ON "inventory_settings"("userId");
CREATE INDEX "inventory_balances_itemId_idx" ON "inventory_balances"("itemId");
CREATE INDEX "inventory_movements_itemId_idx" ON "inventory_movements"("itemId");
CREATE INDEX "inventory_movements_source_idx" ON "inventory_movements"("source");
CREATE INDEX "inventory_movements_sourceId_idx" ON "inventory_movements"("sourceId");
CREATE INDEX "inventory_movements_createdAt_idx" ON "inventory_movements"("createdAt");
CREATE INDEX "work_order_inventory_deductions_workOrderId_idx" ON "work_order_inventory_deductions"("workOrderId");
CREATE INDEX "work_order_inventory_deductions_deductedAt_idx" ON "work_order_inventory_deductions"("deductedAt");
