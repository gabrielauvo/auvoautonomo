-- AlterTable: Increase decimal precision from (10,2) to (15,2) for price/value fields
-- This allows values up to 9,999,999,999,999.99 (over 9 trillion)

-- Quote table
ALTER TABLE "Quote" ALTER COLUMN "discountValue" TYPE DECIMAL(15,2);
ALTER TABLE "Quote" ALTER COLUMN "totalValue" TYPE DECIMAL(15,2);

-- QuoteItem table
ALTER TABLE "QuoteItem" ALTER COLUMN "unitPrice" TYPE DECIMAL(15,2);
ALTER TABLE "QuoteItem" ALTER COLUMN "discountValue" TYPE DECIMAL(15,2);
ALTER TABLE "QuoteItem" ALTER COLUMN "totalPrice" TYPE DECIMAL(15,2);

-- WorkOrder table
ALTER TABLE "WorkOrder" ALTER COLUMN "totalValue" TYPE DECIMAL(15,2);

-- WorkOrderItem table
ALTER TABLE "WorkOrderItem" ALTER COLUMN "unitPrice" TYPE DECIMAL(15,2);
ALTER TABLE "WorkOrderItem" ALTER COLUMN "discountValue" TYPE DECIMAL(15,2);
ALTER TABLE "WorkOrderItem" ALTER COLUMN "totalPrice" TYPE DECIMAL(15,2);

-- Invoice table
ALTER TABLE "Invoice" ALTER COLUMN "subtotal" TYPE DECIMAL(15,2);
ALTER TABLE "Invoice" ALTER COLUMN "discount" TYPE DECIMAL(15,2);
ALTER TABLE "Invoice" ALTER COLUMN "tax" TYPE DECIMAL(15,2);
ALTER TABLE "Invoice" ALTER COLUMN "total" TYPE DECIMAL(15,2);

-- ClientPayment table
ALTER TABLE "ClientPayment" ALTER COLUMN "value" TYPE DECIMAL(15,2);
