-- CreateEnum
CREATE TYPE "StripeEnvironment" AS ENUM ('TEST', 'LIVE');

-- CreateEnum
CREATE TYPE "MercadoPagoEnvironment" AS ENUM ('SANDBOX', 'PRODUCTION');

-- CreateTable
CREATE TABLE "stripe_integrations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "secretKeyEncrypted" TEXT NOT NULL,
    "publishableKey" TEXT,
    "webhookSecret" TEXT,
    "environment" "StripeEnvironment" NOT NULL DEFAULT 'TEST',
    "accountName" TEXT,
    "accountEmail" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stripe_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mercadopago_integrations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessTokenEncrypted" TEXT NOT NULL,
    "publicKey" TEXT,
    "webhookSecret" TEXT,
    "environment" "MercadoPagoEnvironment" NOT NULL DEFAULT 'SANDBOX',
    "accountName" TEXT,
    "accountEmail" TEXT,
    "country" TEXT DEFAULT 'AR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mercadopago_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stripe_integrations_userId_key" ON "stripe_integrations"("userId");

-- CreateIndex
CREATE INDEX "stripe_integrations_userId_idx" ON "stripe_integrations"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "mercadopago_integrations_userId_key" ON "mercadopago_integrations"("userId");

-- CreateIndex
CREATE INDEX "mercadopago_integrations_userId_idx" ON "mercadopago_integrations"("userId");

-- AddForeignKey
ALTER TABLE "stripe_integrations" ADD CONSTRAINT "stripe_integrations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mercadopago_integrations" ADD CONSTRAINT "mercadopago_integrations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
