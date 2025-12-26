import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/encryption/encryption.service';
import { StripeEnvironment } from '@prisma/client';
import { ConnectStripeDto } from './dto/connect-stripe.dto';

@Injectable()
export class StripeIntegrationService {
  private readonly logger = new Logger(StripeIntegrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  /**
   * Connect user's Stripe account by validating and storing API Key
   * POST /integrations/stripe/connect
   */
  async connect(userId: string, dto: ConnectStripeDto) {
    this.logger.log(`Connecting Stripe account for user ${userId}`);

    const existingIntegration = await this.prisma.stripeIntegration.findUnique({
      where: { userId },
    });

    if (existingIntegration) {
      throw new ConflictException('Stripe integration already exists. Disconnect first to reconnect.');
    }

    // Validate that the key matches the environment
    const isTestKey = dto.secretKey.startsWith('sk_test_');
    const isLiveKey = dto.secretKey.startsWith('sk_live_');

    if (dto.environment === 'TEST' && !isTestKey) {
      throw new BadRequestException('For TEST environment, use a test key (sk_test_xxx)');
    }
    if (dto.environment === 'LIVE' && !isLiveKey) {
      throw new BadRequestException('For LIVE environment, use a live key (sk_live_xxx)');
    }

    try {
      // Validate the key by making a test API call
      const accountInfo = await this.validateAndGetAccountInfo(dto.secretKey);

      this.logger.log(`Stripe account validated: ${accountInfo.email}`);

      const secretKeyEncrypted = this.encryption.encrypt(dto.secretKey);

      const integration = await this.prisma.stripeIntegration.create({
        data: {
          userId,
          secretKeyEncrypted,
          publishableKey: dto.publishableKey,
          webhookSecret: dto.webhookSecret,
          environment: dto.environment,
          accountName: accountInfo.businessName || accountInfo.email,
          accountEmail: accountInfo.email,
          isActive: true,
        },
      });

      return {
        id: integration.id,
        environment: integration.environment,
        isActive: integration.isActive,
        connectedAt: integration.createdAt,
        accountInfo: {
          name: accountInfo.businessName,
          email: accountInfo.email,
          country: accountInfo.country,
        },
      };
    } catch (error) {
      this.logger.error('Failed to connect Stripe account', error);

      if (error instanceof ConflictException || error instanceof BadRequestException) {
        throw error;
      }

      if (error.message?.includes('401') || error.message?.includes('Invalid API Key')) {
        throw new BadRequestException('Invalid API Key or insufficient permissions');
      }

      throw new BadRequestException('Failed to connect Stripe account. Please check your API Key and try again.');
    }
  }

  /**
   * Validate Stripe API key and get account info
   */
  private async validateAndGetAccountInfo(secretKey: string): Promise<{
    email: string;
    businessName?: string;
    country?: string;
  }> {
    try {
      // Use dynamic import for Stripe
      const Stripe = require('stripe');
      const stripe = new Stripe(secretKey, { apiVersion: '2023-10-16' });

      // Get account info to validate the key
      const account = await stripe.accounts.retrieve();

      return {
        email: account.email || '',
        businessName: account.business_profile?.name || account.settings?.dashboard?.display_name,
        country: account.country,
      };
    } catch (error) {
      this.logger.error('Stripe API validation failed', error);
      throw new BadRequestException('Invalid Stripe API Key');
    }
  }

  /**
   * Get Stripe integration status
   * GET /integrations/stripe/status
   */
  async getStatus(userId: string) {
    this.logger.log(`Getting Stripe integration status for user ${userId}`);

    const integration = await this.prisma.stripeIntegration.findUnique({
      where: { userId },
    });

    if (!integration) {
      return {
        connected: false,
        environment: null,
        isActive: false,
      };
    }

    try {
      const secretKey = this.encryption.decrypt(integration.secretKeyEncrypted);
      const accountInfo = await this.validateAndGetAccountInfo(secretKey);

      return {
        connected: true,
        environment: integration.environment,
        isActive: integration.isActive,
        connectedAt: integration.createdAt,
        publishableKey: integration.publishableKey,
        accountInfo: {
          name: accountInfo.businessName || integration.accountName,
          email: accountInfo.email || integration.accountEmail,
          country: accountInfo.country,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get Stripe account info', error);

      return {
        connected: true,
        environment: integration.environment,
        isActive: false,
        connectedAt: integration.createdAt,
        publishableKey: integration.publishableKey,
        error: 'Failed to communicate with Stripe API. API Key may be invalid.',
      };
    }
  }

  /**
   * Disconnect Stripe integration
   * DELETE /integrations/stripe/disconnect
   */
  async disconnect(userId: string) {
    this.logger.log(`Disconnecting Stripe integration for user ${userId}`);

    const integration = await this.prisma.stripeIntegration.findUnique({
      where: { userId },
    });

    if (!integration) {
      throw new NotFoundException('Stripe integration not found');
    }

    await this.prisma.stripeIntegration.delete({
      where: { userId },
    });

    this.logger.log(`Stripe integration disconnected for user ${userId}`);

    return {
      message: 'Stripe integration disconnected successfully',
    };
  }

  /**
   * Get decrypted API Key for internal use
   * @internal
   */
  async getApiKey(userId: string): Promise<{
    secretKey: string;
    publishableKey?: string;
    webhookSecret?: string;
    environment: StripeEnvironment;
  }> {
    const integration = await this.prisma.stripeIntegration.findUnique({
      where: { userId },
    });

    if (!integration || !integration.isActive) {
      throw new NotFoundException('Stripe integration not found or inactive');
    }

    const secretKey = this.encryption.decrypt(integration.secretKeyEncrypted);

    return {
      secretKey,
      publishableKey: integration.publishableKey || undefined,
      webhookSecret: integration.webhookSecret || undefined,
      environment: integration.environment,
    };
  }

  /**
   * Check if user has active Stripe integration
   */
  async hasActiveIntegration(userId: string): Promise<boolean> {
    const integration = await this.prisma.stripeIntegration.findUnique({
      where: { userId },
    });
    return !!integration?.isActive;
  }
}
