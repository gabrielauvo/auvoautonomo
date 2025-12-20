import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/encryption/encryption.service';
import { AsaasHttpClient } from '../common/asaas/asaas-http.client';
import { AsaasEnvironment } from '@prisma/client';
import { ConnectAsaasDto } from './dto/connect-asaas.dto';

@Injectable()
export class AsaasIntegrationService {
  private readonly logger = new Logger(AsaasIntegrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly asaasClient: AsaasHttpClient,
  ) {}

  /**
   * Connect user's Asaas account by validating and storing API Key
   * POST /integrations/asaas/connect
   */
  async connect(userId: string, dto: ConnectAsaasDto) {
    this.logger.log(`Connecting Asaas account for user ${userId}`);

    const existingIntegration = await this.prisma.asaasIntegration.findUnique({
      where: { userId },
    });

    if (existingIntegration) {
      throw new ConflictException('Asaas integration already exists. Disconnect first to reconnect.');
    }

    try {
      const accountInfo = await this.asaasClient.getAccountInfo(dto.apiKey, dto.environment);

      this.logger.log(`Asaas account validated: ${accountInfo.name} (${accountInfo.email})`);

      const apiKeyEncrypted = this.encryption.encrypt(dto.apiKey);

      const integration = await this.prisma.asaasIntegration.create({
        data: {
          userId,
          apiKeyEncrypted,
          environment: dto.environment,
          isActive: true,
        },
      });

      return {
        id: integration.id,
        environment: integration.environment,
        isActive: integration.isActive,
        connectedAt: integration.createdAt,
        accountInfo: {
          name: accountInfo.name,
          email: accountInfo.email,
          cpfCnpj: accountInfo.cpfCnpj,
          personType: accountInfo.personType,
        },
      };
    } catch (error) {
      this.logger.error('Failed to connect Asaas account', error);

      if (error.message?.includes('401') || error.message?.includes('403')) {
        throw new BadRequestException('Invalid API Key or insufficient permissions');
      }

      throw new BadRequestException('Failed to connect Asaas account. Please check your API Key and try again.');
    }
  }

  /**
   * Get Asaas integration status
   * GET /integrations/asaas/status
   */
  async getStatus(userId: string) {
    this.logger.log(`Getting Asaas integration status for user ${userId}`);

    const integration = await this.prisma.asaasIntegration.findUnique({
      where: { userId },
    });

    if (!integration) {
      return {
        connected: false,
        environment: null,
        isActive: false,
      };
    }

    const apiKey = this.encryption.decrypt(integration.apiKeyEncrypted);

    try {
      const accountInfo = await this.asaasClient.getAccountInfo(apiKey, integration.environment);

      return {
        connected: true,
        environment: integration.environment,
        isActive: integration.isActive,
        connectedAt: integration.createdAt,
        accountInfo: {
          name: accountInfo.name,
          email: accountInfo.email,
          cpfCnpj: accountInfo.cpfCnpj,
          personType: accountInfo.personType,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get Asaas account info', error);

      return {
        connected: true,
        environment: integration.environment,
        isActive: false,
        connectedAt: integration.createdAt,
        error: 'Failed to communicate with Asaas API. API Key may be invalid.',
      };
    }
  }

  /**
   * Disconnect Asaas integration
   * DELETE /integrations/asaas/disconnect
   */
  async disconnect(userId: string) {
    this.logger.log(`Disconnecting Asaas integration for user ${userId}`);

    const integration = await this.prisma.asaasIntegration.findUnique({
      where: { userId },
    });

    if (!integration) {
      throw new NotFoundException('Asaas integration not found');
    }

    await this.prisma.asaasIntegration.delete({
      where: { userId },
    });

    this.logger.log(`Asaas integration disconnected for user ${userId}`);

    return {
      message: 'Asaas integration disconnected successfully',
    };
  }

  /**
   * Get decrypted API Key for internal use
   * @internal
   */
  async getApiKey(userId: string): Promise<{ apiKey: string; environment: AsaasEnvironment }> {
    const integration = await this.prisma.asaasIntegration.findUnique({
      where: { userId },
    });

    if (!integration || !integration.isActive) {
      throw new NotFoundException('Asaas integration not found or inactive');
    }

    const apiKey = this.encryption.decrypt(integration.apiKeyEncrypted);

    return {
      apiKey,
      environment: integration.environment,
    };
  }
}
