import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { AsaasIntegrationService } from './asaas-integration.service';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/encryption/encryption.service';
import { AsaasHttpClient } from '../common/asaas/asaas-http.client';
import { AsaasEnvironment } from '@prisma/client';

describe('AsaasIntegrationService', () => {
  let service: AsaasIntegrationService;
  let prisma: PrismaService;
  let encryption: EncryptionService;
  let asaasClient: AsaasHttpClient;

  const mockPrismaService = {
    asaasIntegration: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockEncryptionService = {
    encrypt: jest.fn(),
    decrypt: jest.fn(),
  };

  const mockAsaasHttpClient = {
    getAccountInfo: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AsaasIntegrationService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: EncryptionService,
          useValue: mockEncryptionService,
        },
        {
          provide: AsaasHttpClient,
          useValue: mockAsaasHttpClient,
        },
      ],
    }).compile();

    service = module.get<AsaasIntegrationService>(AsaasIntegrationService);
    prisma = module.get<PrismaService>(PrismaService);
    encryption = module.get<EncryptionService>(EncryptionService);
    asaasClient = module.get<AsaasHttpClient>(AsaasHttpClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('connect', () => {
    const userId = 'user-123';
    const dto = {
      apiKey: '$aak_test_abc123',
      environment: AsaasEnvironment.SANDBOX,
    };

    const mockAccountInfo = {
      object: 'account',
      id: 'acc_123',
      name: 'Test Account',
      email: 'test@example.com',
      cpfCnpj: '12345678900',
      personType: 'FISICA' as const,
    };

    it('should connect Asaas account successfully', async () => {
      mockPrismaService.asaasIntegration.findUnique.mockResolvedValue(null);
      mockAsaasHttpClient.getAccountInfo.mockResolvedValue(mockAccountInfo);
      mockEncryptionService.encrypt.mockReturnValue('encrypted-key');
      mockPrismaService.asaasIntegration.create.mockResolvedValue({
        id: 'integration-123',
        userId,
        apiKeyEncrypted: 'encrypted-key',
        environment: AsaasEnvironment.SANDBOX,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.connect(userId, dto);

      expect(mockPrismaService.asaasIntegration.findUnique).toHaveBeenCalledWith({
        where: { userId },
      });
      expect(mockAsaasHttpClient.getAccountInfo).toHaveBeenCalledWith(dto.apiKey, dto.environment);
      expect(mockEncryptionService.encrypt).toHaveBeenCalledWith(dto.apiKey);
      expect(mockPrismaService.asaasIntegration.create).toHaveBeenCalledWith({
        data: {
          userId,
          apiKeyEncrypted: 'encrypted-key',
          environment: dto.environment,
          isActive: true,
        },
      });
      expect(result.accountInfo).toEqual({
        name: mockAccountInfo.name,
        email: mockAccountInfo.email,
        cpfCnpj: mockAccountInfo.cpfCnpj,
        personType: mockAccountInfo.personType,
      });
    });

    it('should throw ConflictException if integration already exists', async () => {
      mockPrismaService.asaasIntegration.findUnique.mockResolvedValue({
        id: 'existing-integration',
        userId,
      });

      await expect(service.connect(userId, dto)).rejects.toThrow(ConflictException);
      expect(mockAsaasHttpClient.getAccountInfo).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if API Key is invalid (401)', async () => {
      mockPrismaService.asaasIntegration.findUnique.mockResolvedValue(null);
      mockAsaasHttpClient.getAccountInfo.mockRejectedValue(new Error('Failed to get account info: 401 Unauthorized'));

      await expect(service.connect(userId, dto)).rejects.toThrow(BadRequestException);
      await expect(service.connect(userId, dto)).rejects.toThrow('Invalid API Key');
    });

    it('should throw BadRequestException if API Key has insufficient permissions (403)', async () => {
      mockPrismaService.asaasIntegration.findUnique.mockResolvedValue(null);
      mockAsaasHttpClient.getAccountInfo.mockRejectedValue(new Error('Failed to get account info: 403 Forbidden'));

      await expect(service.connect(userId, dto)).rejects.toThrow(BadRequestException);
      await expect(service.connect(userId, dto)).rejects.toThrow('Invalid API Key');
    });
  });

  describe('getStatus', () => {
    const userId = 'user-123';

    it('should return not connected if no integration exists', async () => {
      mockPrismaService.asaasIntegration.findUnique.mockResolvedValue(null);

      const result = await service.getStatus(userId);

      expect(result).toEqual({
        connected: false,
        environment: null,
        isActive: false,
      });
    });

    it('should return integration status with account info', async () => {
      const integration = {
        id: 'integration-123',
        userId,
        apiKeyEncrypted: 'encrypted-key',
        environment: AsaasEnvironment.SANDBOX,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockAccountInfo = {
        object: 'account',
        id: 'acc_123',
        name: 'Test Account',
        email: 'test@example.com',
        cpfCnpj: '12345678900',
        personType: 'FISICA' as const,
      };

      mockPrismaService.asaasIntegration.findUnique.mockResolvedValue(integration);
      mockEncryptionService.decrypt.mockReturnValue('$aak_test_abc123');
      mockAsaasHttpClient.getAccountInfo.mockResolvedValue(mockAccountInfo);

      const result = await service.getStatus(userId);

      expect(mockEncryptionService.decrypt).toHaveBeenCalledWith('encrypted-key');
      expect(mockAsaasHttpClient.getAccountInfo).toHaveBeenCalledWith('$aak_test_abc123', AsaasEnvironment.SANDBOX);
      expect(result).toEqual({
        connected: true,
        environment: AsaasEnvironment.SANDBOX,
        isActive: true,
        connectedAt: integration.createdAt,
        accountInfo: {
          name: mockAccountInfo.name,
          email: mockAccountInfo.email,
          cpfCnpj: mockAccountInfo.cpfCnpj,
          personType: mockAccountInfo.personType,
        },
      });
    });

    it('should return inactive status if API Key is invalid', async () => {
      const integration = {
        id: 'integration-123',
        userId,
        apiKeyEncrypted: 'encrypted-key',
        environment: AsaasEnvironment.SANDBOX,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.asaasIntegration.findUnique.mockResolvedValue(integration);
      mockEncryptionService.decrypt.mockReturnValue('$aak_test_abc123');
      mockAsaasHttpClient.getAccountInfo.mockRejectedValue(new Error('API error'));

      const result = await service.getStatus(userId);

      expect(result).toEqual({
        connected: true,
        environment: AsaasEnvironment.SANDBOX,
        isActive: false,
        connectedAt: integration.createdAt,
        error: 'Failed to communicate with Asaas API. API Key may be invalid.',
      });
    });
  });

  describe('disconnect', () => {
    const userId = 'user-123';

    it('should disconnect integration successfully', async () => {
      mockPrismaService.asaasIntegration.findUnique.mockResolvedValue({
        id: 'integration-123',
        userId,
      });
      mockPrismaService.asaasIntegration.delete.mockResolvedValue({});

      const result = await service.disconnect(userId);

      expect(mockPrismaService.asaasIntegration.delete).toHaveBeenCalledWith({
        where: { userId },
      });
      expect(result).toEqual({
        message: 'Asaas integration disconnected successfully',
      });
    });

    it('should throw NotFoundException if integration does not exist', async () => {
      mockPrismaService.asaasIntegration.findUnique.mockResolvedValue(null);

      await expect(service.disconnect(userId)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.asaasIntegration.delete).not.toHaveBeenCalled();
    });
  });

  describe('getApiKey', () => {
    const userId = 'user-123';

    it('should return decrypted API Key', async () => {
      mockPrismaService.asaasIntegration.findUnique.mockResolvedValue({
        id: 'integration-123',
        userId,
        apiKeyEncrypted: 'encrypted-key',
        environment: AsaasEnvironment.PRODUCTION,
        isActive: true,
      });
      mockEncryptionService.decrypt.mockReturnValue('$aak_prod_abc123');

      const result = await service.getApiKey(userId);

      expect(mockEncryptionService.decrypt).toHaveBeenCalledWith('encrypted-key');
      expect(result).toEqual({
        apiKey: '$aak_prod_abc123',
        environment: AsaasEnvironment.PRODUCTION,
      });
    });

    it('should throw NotFoundException if integration does not exist', async () => {
      mockPrismaService.asaasIntegration.findUnique.mockResolvedValue(null);

      await expect(service.getApiKey(userId)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if integration is inactive', async () => {
      mockPrismaService.asaasIntegration.findUnique.mockResolvedValue({
        id: 'integration-123',
        userId,
        apiKeyEncrypted: 'encrypted-key',
        environment: AsaasEnvironment.SANDBOX,
        isActive: false,
      });

      await expect(service.getApiKey(userId)).rejects.toThrow(NotFoundException);
    });
  });
});
