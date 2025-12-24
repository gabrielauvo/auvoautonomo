import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GoogleOAuthService } from './google-oauth.service';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/encryption/encryption.service';
import { GoogleIntegrationStatus } from '@prisma/client';

describe('GoogleOAuthService', () => {
  let service: GoogleOAuthService;
  let prismaService: PrismaService;
  let encryptionService: EncryptionService;
  let configService: ConfigService;

  const mockUserId = 'user-123';

  const mockIntegration = {
    id: 'integration-123',
    userId: mockUserId,
    googleAccountId: 'account-123',
    googleLocationId: 'locations/123',
    googleLocationName: 'My Business',
    status: GoogleIntegrationStatus.CONNECTED,
    scopes: ['https://www.googleapis.com/auth/business.manage'],
    lastSyncAt: new Date(),
    lastSyncError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockToken = {
    id: 'token-123',
    integrationId: 'integration-123',
    accessTokenEnc: 'encrypted-access-token',
    refreshTokenEnc: 'encrypted-refresh-token',
    expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    googleIntegration: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    googleToken: {
      upsert: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockEncryptionService = {
    encrypt: jest.fn(),
    decrypt: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: string) => {
      const config: Record<string, string> = {
        GOOGLE_BUSINESS_CLIENT_ID: 'test-client-id',
        GOOGLE_BUSINESS_CLIENT_SECRET: 'test-client-secret',
        GOOGLE_BUSINESS_REDIRECT_URI: 'http://localhost:3000/api/google-business/callback',
      };
      return config[key] || defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleOAuthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: EncryptionService,
          useValue: mockEncryptionService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<GoogleOAuthService>(GoogleOAuthService);
    prismaService = module.get<PrismaService>(PrismaService);
    encryptionService = module.get<EncryptionService>(EncryptionService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('isConfigured', () => {
    it('should return true when credentials are configured', () => {
      expect(service.isConfigured()).toBe(true);
    });
  });

  describe('generateAuthUrl', () => {
    it('should generate OAuth URL with correct parameters', () => {
      const { url, state } = service.generateAuthUrl(mockUserId);

      expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('response_type=code');
      expect(url).toContain('scope=');
      expect(url).toContain('access_type=offline');
      expect(url).toContain('prompt=consent');
      expect(state).toBeDefined();
    });

    it('should include redirect URL in state when provided', () => {
      const redirectUrl = 'https://myapp.com/settings';
      const { state } = service.generateAuthUrl(mockUserId, redirectUrl);

      const decodedState = JSON.parse(Buffer.from(state, 'base64url').toString());
      expect(decodedState.userId).toBe(mockUserId);
      expect(decodedState.redirectUrl).toBe(redirectUrl);
    });
  });

  describe('getStatus', () => {
    it('should return disconnected status when no integration exists', async () => {
      mockPrismaService.googleIntegration.findUnique.mockResolvedValue(null);

      const status = await service.getStatus(mockUserId);

      expect(status.status).toBe('DISCONNECTED');
      expect(status.isConnected).toBe(false);
    });

    it('should return integration status when exists', async () => {
      mockPrismaService.googleIntegration.findUnique.mockResolvedValue(mockIntegration);

      const status = await service.getStatus(mockUserId);

      expect(status.status).toBe(GoogleIntegrationStatus.CONNECTED);
      expect(status.isConnected).toBe(true);
      expect(status.googleLocationName).toBe('My Business');
    });
  });

  describe('getValidAccessToken', () => {
    it('should return decrypted access token when not expired', async () => {
      mockPrismaService.googleIntegration.findUnique.mockResolvedValue({
        ...mockIntegration,
        token: mockToken,
      });
      mockEncryptionService.decrypt.mockReturnValue('decrypted-access-token');

      const token = await service.getValidAccessToken(mockUserId);

      expect(token).toBe('decrypted-access-token');
      expect(mockEncryptionService.decrypt).toHaveBeenCalledWith(mockToken.accessTokenEnc);
    });

    it('should throw NotFoundException when integration not found', async () => {
      mockPrismaService.googleIntegration.findUnique.mockResolvedValue(null);

      await expect(service.getValidAccessToken(mockUserId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('selectLocation', () => {
    it('should throw NotFoundException when integration not found', async () => {
      mockPrismaService.googleIntegration.findUnique.mockResolvedValue(null);

      await expect(service.selectLocation(mockUserId, 'locations/123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('disconnect', () => {
    it('should delete integration and tokens', async () => {
      mockPrismaService.googleIntegration.findUnique.mockResolvedValue(mockIntegration);
      mockPrismaService.$transaction.mockResolvedValue([]);

      await service.disconnect(mockUserId);

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it('should throw NotFoundException when integration not found', async () => {
      mockPrismaService.googleIntegration.findUnique.mockResolvedValue(null);

      await expect(service.disconnect(mockUserId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateSyncStatus', () => {
    it('should update status to CONNECTED on success', async () => {
      await service.updateSyncStatus(mockUserId, true);

      expect(mockPrismaService.googleIntegration.update).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        data: expect.objectContaining({
          status: GoogleIntegrationStatus.CONNECTED,
          lastSyncError: null,
        }),
      });
    });

    it('should update status to ERROR on failure', async () => {
      const errorMessage = 'Sync failed';
      await service.updateSyncStatus(mockUserId, false, errorMessage);

      expect(mockPrismaService.googleIntegration.update).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        data: expect.objectContaining({
          status: GoogleIntegrationStatus.ERROR,
          lastSyncError: errorMessage,
        }),
      });
    });
  });
});
