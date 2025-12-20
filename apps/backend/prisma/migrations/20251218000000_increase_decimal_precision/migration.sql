-- AlterTable: Increase decimal precision from (10,2) to (15,2) for price/value fields
-- This allows values up to 9,999,999,999,999.99 (over 9 trillion)

-- Quote table (actual table name is "quotes" due to @@map)
ALTER TABLE "quotes" ALTER COLUMN "discountValue" TYPE DECIMAL(15,2);
ALTER TABLE "quotes" ALTER COLUMN "totalValue" TYPE DECIMAL(15,2);

-- QuoteItem table (actual table name is "quote_items")
ALTER TABLE "quote_items" ALTER COLUMN "unitPrice" TYPE DECIMAL(15,2);
ALTER TABLE "quote_items" ALTER COLUMN "discountValue" TYPE DECIMAL(15,2);
ALTER TABLE "quote_items" ALTER COLUMN "totalPrice" TYPE DECIMAL(15,2);

-- WorkOrder table (actual table name is "work_orders")
ALTER TABLE "work_orders" ALTER COLUMN "totalValue" TYPE DECIMAL(15,2);

-- WorkOrderItem table (actual table name is "work_order_items")
ALTER TABLE "work_order_items" ALTER COLUMN "unitPrice" TYPE DECIMAL(15,2);
ALTER TABLE "work_order_items" ALTER COLUMN "discountValue" TYPE DECIMAL(15,2);
ALTER TABLE "work_order_items" ALTER COLUMN "totalPrice" TYPE DECIMAL(15,2);

-- Invoice table (actual table name is "invoices")
ALTER TABLE "invoices" ALTER COLUMN "subtotal" TYPE DECIMAL(15,2);
ALTER TABLE "invoices" ALTER COLUMN "discount" TYPE DECIMAL(15,2);
ALTER TABLE "invoices" ALTER COLUMN "tax" TYPE DECIMAL(15,2);
ALTER TABLE "invoices" ALTER COLUMN "total" TYPE DECIMAL(15,2);

-- ClientPayment table (actual table name is "client_payments")
ALTER TABLE "client_payments" ALTER COLUMN "value" TYPE DECIMAL(15,2);
