import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/encryption/encryption.service';
import { MercadoPagoEnvironment } from '@prisma/client';
import { ConnectMercadoPagoDto } from './dto/connect-mercadopago.dto';

@Injectable()
export class MercadoPagoIntegrationService {
  private readonly logger = new Logger(MercadoPagoIntegrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  /**
   * Connect user's Mercado Pago account by validating and storing Access Token
   * POST /integrations/mercadopago/connect
   */
  async connect(userId: string, dto: ConnectMercadoPagoDto) {
    this.logger.log(`Connecting Mercado Pago account for user ${userId}`);

    const existingIntegration = await this.prisma.mercadoPagoIntegration.findUnique({
      where: { userId },
    });

    if (existingIntegration) {
      throw new ConflictException('Mercado Pago integration already exists. Disconnect first to reconnect.');
    }

    // Validate that the token matches the environment
    const isTestToken = dto.accessToken.startsWith('TEST-');
    const isProdToken = dto.accessToken.startsWith('APP_USR-');

    if (dto.environment === 'SANDBOX' && !isTestToken) {
      throw new BadRequestException('For SANDBOX environment, use a test token (TEST-xxx)');
    }
    if (dto.environment === 'PRODUCTION' && !isProdToken) {
      throw new BadRequestException('For PRODUCTION environment, use a production token (APP_USR-xxx)');
    }

    try {
      // Validate the token by making a test API call
      const accountInfo = await this.validateAndGetAccountInfo(dto.accessToken);

      this.logger.log(`Mercado Pago account validated: ${accountInfo.email}`);

      const accessTokenEncrypted = this.encryption.encrypt(dto.accessToken);

      const integration = await this.prisma.mercadoPagoIntegration.create({
        data: {
          userId,
          accessTokenEncrypted,
          publicKey: dto.publicKey,
          webhookSecret: dto.webhookSecret,
          environment: dto.environment,
          country: dto.country || accountInfo.countryId || 'AR',
          accountName: accountInfo.nickname || accountInfo.firstName,
          accountEmail: accountInfo.email,
          isActive: true,
        },
      });

      return {
        id: integration.id,
        environment: integration.environment,
        country: integration.country,
        isActive: integration.isActive,
        connectedAt: integration.createdAt,
        accountInfo: {
          name: accountInfo.nickname || `${accountInfo.firstName} ${accountInfo.lastName}`,
          email: accountInfo.email,
          country: accountInfo.countryId,
        },
      };
    } catch (error) {
      this.logger.error('Failed to connect Mercado Pago account', error);

      if (error instanceof ConflictException || error instanceof BadRequestException) {
        throw error;
      }

      if (error.message?.includes('401') || error.message?.includes('Invalid')) {
        throw new BadRequestException('Invalid Access Token or insufficient permissions');
      }

      throw new BadRequestException('Failed to connect Mercado Pago account. Please check your Access Token and try again.');
    }
  }

  /**
   * Validate Mercado Pago Access Token and get account info
   */
  private async validateAndGetAccountInfo(accessToken: string): Promise<{
    email: string;
    nickname?: string;
    firstName?: string;
    lastName?: string;
    countryId?: string;
  }> {
    try {
      // Use Mercado Pago API to validate token
      const response = await fetch('https://api.mercadopago.com/users/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new BadRequestException('Invalid Mercado Pago Access Token');
      }

      const data = await response.json();

      return {
        email: data.email || '',
        nickname: data.nickname,
        firstName: data.first_name,
        lastName: data.last_name,
        countryId: data.country_id,
      };
    } catch (error) {
      this.logger.error('Mercado Pago API validation failed', error);
      throw new BadRequestException('Invalid Mercado Pago Access Token');
    }
  }

  /**
   * Get Mercado Pago integration status
   * GET /integrations/mercadopago/status
   */
  async getStatus(userId: string) {
    this.logger.log(`Getting Mercado Pago integration status for user ${userId}`);

    const integration = await this.prisma.mercadoPagoIntegration.findUnique({
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
      const accessToken = this.encryption.decrypt(integration.accessTokenEncrypted);
      const accountInfo = await this.validateAndGetAccountInfo(accessToken);

      return {
        connected: true,
        environment: integration.environment,
        country: integration.country,
        isActive: integration.isActive,
        connectedAt: integration.createdAt,
        publicKey: integration.publicKey,
        accountInfo: {
          name: accountInfo.nickname || integration.accountName,
          email: accountInfo.email || integration.accountEmail,
          country: accountInfo.countryId,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get Mercado Pago account info', error);

      return {
        connected: true,
        environment: integration.environment,
        country: integration.country,
        isActive: false,
        connectedAt: integration.createdAt,
        publicKey: integration.publicKey,
        error: 'Failed to communicate with Mercado Pago API. Access Token may be invalid.',
      };
    }
  }

  /**
   * Disconnect Mercado Pago integration
   * DELETE /integrations/mercadopago/disconnect
   */
  async disconnect(userId: string) {
    this.logger.log(`Disconnecting Mercado Pago integration for user ${userId}`);

    const integration = await this.prisma.mercadoPagoIntegration.findUnique({
      where: { userId },
    });

    if (!integration) {
      throw new NotFoundException('Mercado Pago integration not found');
    }

    await this.prisma.mercadoPagoIntegration.delete({
      where: { userId },
    });

    this.logger.log(`Mercado Pago integration disconnected for user ${userId}`);

    return {
      message: 'Mercado Pago integration disconnected successfully',
    };
  }

  /**
   * Get decrypted Access Token for internal use
   * @internal
   */
  async getAccessToken(userId: string): Promise<{
    accessToken: string;
    publicKey?: string;
    webhookSecret?: string;
    environment: MercadoPagoEnvironment;
    country?: string;
  }> {
    const integration = await this.prisma.mercadoPagoIntegration.findUnique({
      where: { userId },
    });

    if (!integration || !integration.isActive) {
      throw new NotFoundException('Mercado Pago integration not found or inactive');
    }

    const accessToken = this.encryption.decrypt(integration.accessTokenEncrypted);

    return {
      accessToken,
      publicKey: integration.publicKey || undefined,
      webhookSecret: integration.webhookSecret || undefined,
      environment: integration.environment,
      country: integration.country || undefined,
    };
  }

  /**
   * Check if user has active Mercado Pago integration
   */
  async hasActiveIntegration(userId: string): Promise<boolean> {
    const integration = await this.prisma.mercadoPagoIntegration.findUnique({
      where: { userId },
    });
    return !!integration?.isActive;
  }
}
