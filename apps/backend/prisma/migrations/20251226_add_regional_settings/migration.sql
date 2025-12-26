-- Add regional settings for internationalization support
-- This migration adds timezone to UserSubscription and currency to all monetary models

-- Add timezone to user_subscriptions (company-level setting)
ALTER TABLE "user_subscriptions" ADD COLUMN IF NOT EXISTS "timezone" TEXT DEFAULT 'America/Sao_Paulo';

-- Add currency to items (catalog)
ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "currency" TEXT DEFAULT 'BRL';

-- Add currency to quotes
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "currency" TEXT DEFAULT 'BRL';

-- Add currency to quote_items
ALTER TABLE "quote_items" ADD COLUMN IF NOT EXISTS "currency" TEXT DEFAULT 'BRL';

-- Add currency to work_orders
ALTER TABLE "work_orders" ADD COLUMN IF NOT EXISTS "currency" TEXT DEFAULT 'BRL';

-- Add currency to work_order_items
ALTER TABLE "work_order_items" ADD COLUMN IF NOT EXISTS "currency" TEXT DEFAULT 'BRL';

-- Add currency to invoices
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "currency" TEXT DEFAULT 'BRL';

-- Add currency to client_payments
ALTER TABLE "client_payments" ADD COLUMN IF NOT EXISTS "currency" TEXT DEFAULT 'BRL';

-- Add currency to expenses
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "currency" TEXT DEFAULT 'BRL';

-- Create indexes for currency filtering (useful for reports and filtering by currency)
CREATE INDEX IF NOT EXISTS "quotes_currency_idx" ON "quotes"("currency");
CREATE INDEX IF NOT EXISTS "work_orders_currency_idx" ON "work_orders"("currency");
CREATE INDEX IF NOT EXISTS "expenses_currency_idx" ON "expenses"("currency");
CREATE INDEX IF NOT EXISTS "invoices_currency_idx" ON "invoices"("currency");
CREATE INDEX IF NOT EXISTS "client_payments_currency_idx" ON "client_payments"("currency");
