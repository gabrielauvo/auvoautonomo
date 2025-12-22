import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { QuotesPublicService } from './quotes-public.service';
import { PrismaService } from '../prisma/prisma.service';
import { FileStorageService } from '../file-storage/file-storage.service';
import { SettingsService } from '../settings/settings.service';
import * as crypto from 'crypto';

describe('QuotesPublicService', () => {
  let service: QuotesPublicService;
  let prisma: PrismaService;
  let settingsService: SettingsService;

  const mockUserId = 'user-123';
  const mockQuoteId = 'quote-456';
  const mockShareKey = 'abc123def456ghi789jk';
  const mockClientId = 'client-789';

  const mockFileStorageService = {
    uploadFromBase64: jest.fn().mockResolvedValue({
      id: 'attachment-1',
      publicUrl: '/uploads/signature.png',
    }),
  };

  const mockSettingsService = {
    getAcceptanceTermsForQuote: jest.fn(),
    getTemplateSettings: jest.fn().mockResolvedValue({
      quote: {
        primaryColor: '#7C3AED',
        secondaryColor: '#6D28D9',
        showLogo: true,
        logoPosition: 'left',
        footerText: 'Thank you!',
      },
    }),
  };

  const mockPrisma = {
    quote: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    signature: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuotesPublicService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: FileStorageService, useValue: mockFileStorageService },
        { provide: SettingsService, useValue: mockSettingsService },
      ],
    }).compile();

    service = module.get<QuotesPublicService>(QuotesPublicService);
    prisma = module.get<PrismaService>(PrismaService);
    settingsService = module.get<SettingsService>(SettingsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Acceptance Terms Validation', () => {
    describe('signAndApproveByShareKey', () => {
      const mockQuote = {
        id: mockQuoteId,
        userId: mockUserId,
        clientId: mockClientId,
        status: 'SENT',
        signatures: [],
        client: { name: 'Test Client' },
        user: { name: 'Test User' },
      };

      const validSignatureDto = {
        imageBase64: 'data:image/png;base64,iVBORw0KGgo=',
        signerName: 'John Doe',
        signerDocument: '123.456.789-00',
        signerRole: 'Cliente',
      };

      const requestInfo = {
        ipAddress: '192.168.1.1',
        userAgent: 'Test Browser',
      };

      it('should allow signature when terms are not required', async () => {
        mockPrisma.quote.findUnique.mockResolvedValue(mockQuote);
        mockSettingsService.getAcceptanceTermsForQuote.mockResolvedValue({
          required: false,
          termsContent: null,
          version: 0,
          termsHash: null,
        });
        mockPrisma.signature.create.mockResolvedValue({
          id: 'signature-1',
          signerName: 'John Doe',
        });
        mockPrisma.quote.update.mockResolvedValue({
          ...mockQuote,
          status: 'APPROVED',
        });

        const result = await service.signAndApproveByShareKey(
          mockShareKey,
          validSignatureDto,
          requestInfo,
        );

        expect(result.success).toBe(true);
        expect(result.quoteStatus).toBe('APPROVED');
        expect(mockPrisma.signature.create).toHaveBeenCalled();
      });

      it('should reject signature when terms are required but not accepted', async () => {
        const termsContent = 'These are the acceptance terms.';
        const termsHash = crypto.createHash('sha256').update(termsContent, 'utf8').digest('hex');

        mockPrisma.quote.findUnique.mockResolvedValue(mockQuote);
        mockSettingsService.getAcceptanceTermsForQuote.mockResolvedValue({
          required: true,
          termsContent,
          version: 1,
          termsHash,
        });

        await expect(
          service.signAndApproveByShareKey(mockShareKey, validSignatureDto, requestInfo),
        ).rejects.toThrow(BadRequestException);

        await expect(
          service.signAndApproveByShareKey(mockShareKey, validSignatureDto, requestInfo),
        ).rejects.toThrow('Este orcamento requer aceite dos termos');

        expect(mockPrisma.signature.create).not.toHaveBeenCalled();
      });

      it('should allow signature when terms are required and properly accepted', async () => {
        const termsContent = 'These are the acceptance terms.';
        const termsHash = crypto.createHash('sha256').update(termsContent, 'utf8').digest('hex');

        mockPrisma.quote.findUnique.mockResolvedValue(mockQuote);
        mockSettingsService.getAcceptanceTermsForQuote.mockResolvedValue({
          required: true,
          termsContent,
          version: 1,
          termsHash,
        });
        mockPrisma.signature.create.mockResolvedValue({
          id: 'signature-1',
          signerName: 'John Doe',
          termsAcceptedAt: new Date(),
          termsHash,
          termsVersion: 1,
        });
        mockPrisma.quote.update.mockResolvedValue({
          ...mockQuote,
          status: 'APPROVED',
        });

        const dtoWithTerms = {
          ...validSignatureDto,
          termsAcceptedAt: new Date().toISOString(),
          termsHash,
          termsVersion: 1,
        };

        const result = await service.signAndApproveByShareKey(
          mockShareKey,
          dtoWithTerms,
          requestInfo,
        );

        expect(result.success).toBe(true);
        expect(result.quoteStatus).toBe('APPROVED');

        // Verify signature was created with terms audit fields
        const createCall = mockPrisma.signature.create.mock.calls[0][0];
        expect(createCall.data.termsAcceptedAt).toBeDefined();
        expect(createCall.data.termsHash).toBe(termsHash);
        expect(createCall.data.termsVersion).toBe(1);
      });

      it('should reject signature when terms hash is missing (terms required)', async () => {
        const termsContent = 'These are the acceptance terms.';
        const termsHash = crypto.createHash('sha256').update(termsContent, 'utf8').digest('hex');

        mockPrisma.quote.findUnique.mockResolvedValue(mockQuote);
        mockSettingsService.getAcceptanceTermsForQuote.mockResolvedValue({
          required: true,
          termsContent,
          version: 1,
          termsHash,
        });

        const dtoWithoutHash = {
          ...validSignatureDto,
          termsAcceptedAt: new Date().toISOString(),
          // Missing termsHash
        };

        await expect(
          service.signAndApproveByShareKey(mockShareKey, dtoWithoutHash, requestInfo),
        ).rejects.toThrow(BadRequestException);
      });

      it('should reject signature when termsAcceptedAt is missing (terms required)', async () => {
        const termsContent = 'These are the acceptance terms.';
        const termsHash = crypto.createHash('sha256').update(termsContent, 'utf8').digest('hex');

        mockPrisma.quote.findUnique.mockResolvedValue(mockQuote);
        mockSettingsService.getAcceptanceTermsForQuote.mockResolvedValue({
          required: true,
          termsContent,
          version: 1,
          termsHash,
        });

        const dtoWithoutAcceptedAt = {
          ...validSignatureDto,
          termsHash,
          // Missing termsAcceptedAt
        };

        await expect(
          service.signAndApproveByShareKey(mockShareKey, dtoWithoutAcceptedAt, requestInfo),
        ).rejects.toThrow(BadRequestException);
      });

      it('should log warning but allow when terms hash has changed since acceptance', async () => {
        const termsContent = 'These are the acceptance terms.';
        const currentHash = crypto.createHash('sha256').update(termsContent, 'utf8').digest('hex');
        const oldHash = 'old-hash-from-when-user-accepted';

        mockPrisma.quote.findUnique.mockResolvedValue(mockQuote);
        mockSettingsService.getAcceptanceTermsForQuote.mockResolvedValue({
          required: true,
          termsContent,
          version: 2,
          termsHash: currentHash,
        });
        mockPrisma.signature.create.mockResolvedValue({
          id: 'signature-1',
          signerName: 'John Doe',
        });
        mockPrisma.quote.update.mockResolvedValue({
          ...mockQuote,
          status: 'APPROVED',
        });

        const dtoWithOldHash = {
          ...validSignatureDto,
          termsAcceptedAt: new Date().toISOString(),
          termsHash: oldHash, // Different from current
          termsVersion: 1,
        };

        // Should still allow (with warning logged) - terms might have been updated
        // between reading and signing
        const result = await service.signAndApproveByShareKey(
          mockShareKey,
          dtoWithOldHash,
          requestInfo,
        );

        expect(result.success).toBe(true);
      });

      it('should reject when quote is not in SENT status', async () => {
        mockPrisma.quote.findUnique.mockResolvedValue({
          ...mockQuote,
          status: 'DRAFT',
        });

        await expect(
          service.signAndApproveByShareKey(mockShareKey, validSignatureDto, requestInfo),
        ).rejects.toThrow(BadRequestException);

        await expect(
          service.signAndApproveByShareKey(mockShareKey, validSignatureDto, requestInfo),
        ).rejects.toThrow('ainda não foi enviado');
      });

      it('should reject when quote is already approved', async () => {
        mockPrisma.quote.findUnique.mockResolvedValue({
          ...mockQuote,
          status: 'APPROVED',
        });

        await expect(
          service.signAndApproveByShareKey(mockShareKey, validSignatureDto, requestInfo),
        ).rejects.toThrow(BadRequestException);

        await expect(
          service.signAndApproveByShareKey(mockShareKey, validSignatureDto, requestInfo),
        ).rejects.toThrow('já foi aprovado');
      });

      it('should reject when quote already has a signature', async () => {
        mockPrisma.quote.findUnique.mockResolvedValue({
          ...mockQuote,
          signatures: [{ id: 'existing-sig' }],
        });

        await expect(
          service.signAndApproveByShareKey(mockShareKey, validSignatureDto, requestInfo),
        ).rejects.toThrow(BadRequestException);

        await expect(
          service.signAndApproveByShareKey(mockShareKey, validSignatureDto, requestInfo),
        ).rejects.toThrow('já possui uma assinatura');
      });

      it('should reject when quote not found', async () => {
        mockPrisma.quote.findUnique.mockResolvedValue(null);

        await expect(
          service.signAndApproveByShareKey(mockShareKey, validSignatureDto, requestInfo),
        ).rejects.toThrow(BadRequestException);

        await expect(
          service.signAndApproveByShareKey(mockShareKey, validSignatureDto, requestInfo),
        ).rejects.toThrow('não encontrado');
      });
    });

    describe('getAcceptanceTermsForShareKey', () => {
      it('should return terms when quote exists and has valid terms', async () => {
        const termsContent = 'Valid terms';
        const termsHash = crypto.createHash('sha256').update(termsContent, 'utf8').digest('hex');

        mockPrisma.quote.findUnique.mockResolvedValue({
          userId: mockUserId,
        });
        mockSettingsService.getAcceptanceTermsForQuote.mockResolvedValue({
          required: true,
          termsContent,
          version: 1,
          termsHash,
        });

        const result = await service.getAcceptanceTermsForShareKey(mockShareKey);

        expect(result.required).toBe(true);
        expect(result.termsContent).toBe(termsContent);
        expect(result.termsHash).toBe(termsHash);
      });

      it('should return required=false when quote not found', async () => {
        mockPrisma.quote.findUnique.mockResolvedValue(null);

        const result = await service.getAcceptanceTermsForShareKey(mockShareKey);

        expect(result).toEqual({
          required: false,
          termsContent: null,
          version: 0,
          termsHash: null,
        });
      });

      it('should delegate to settingsService for terms lookup', async () => {
        mockPrisma.quote.findUnique.mockResolvedValue({
          userId: mockUserId,
        });
        mockSettingsService.getAcceptanceTermsForQuote.mockResolvedValue({
          required: false,
          termsContent: null,
          version: 0,
          termsHash: null,
        });

        await service.getAcceptanceTermsForShareKey(mockShareKey);

        expect(mockSettingsService.getAcceptanceTermsForQuote).toHaveBeenCalledWith(mockUserId);
      });
    });

    describe('getAcceptanceTermsForQuote', () => {
      it('should return terms when quote belongs to user', async () => {
        const termsContent = 'Terms content';
        const termsHash = crypto.createHash('sha256').update(termsContent, 'utf8').digest('hex');

        mockPrisma.quote.findFirst.mockResolvedValue({
          id: mockQuoteId,
          userId: mockUserId,
        });
        mockSettingsService.getAcceptanceTermsForQuote.mockResolvedValue({
          required: true,
          termsContent,
          version: 2,
          termsHash,
        });

        const result = await service.getAcceptanceTermsForQuote(mockUserId, mockQuoteId);

        expect(result.required).toBe(true);
        expect(result.version).toBe(2);
      });

      it('should return required=false when quote not found for user', async () => {
        mockPrisma.quote.findFirst.mockResolvedValue(null);

        const result = await service.getAcceptanceTermsForQuote(mockUserId, mockQuoteId);

        expect(result).toEqual({
          required: false,
          termsContent: null,
          version: 0,
          termsHash: null,
        });

        expect(mockSettingsService.getAcceptanceTermsForQuote).not.toHaveBeenCalled();
      });
    });
  });

  describe('findByShareKey', () => {
    it('should return null when quote not found', async () => {
      mockPrisma.quote.findUnique.mockResolvedValue(null);

      const result = await service.findByShareKey(mockShareKey);

      expect(result).toBeNull();
    });

    it('should return formatted quote with template settings', async () => {
      const mockQuote = {
        id: mockQuoteId,
        userId: mockUserId,
        status: 'SENT',
        notes: 'Test notes',
        discountValue: { toNumber: () => 10 },
        totalValue: { toNumber: () => 100 },
        sentAt: new Date(),
        visitScheduledAt: null,
        createdAt: new Date(),
        user: {
          id: mockUserId,
          name: 'Service Provider',
          email: 'provider@test.com',
          phone: '123456789',
          companyName: 'Test Company',
          companyLogoUrl: null,
        },
        client: {
          id: mockClientId,
          name: 'Client Name',
          taxId: '123.456.789-00',
          email: 'client@test.com',
          phone: '987654321',
          address: 'Street 123',
          city: 'City',
          state: 'ST',
          zipCode: '12345-678',
          notes: null,
        },
        items: [
          {
            id: 'item-1',
            name: 'Service',
            type: 'SERVICE',
            unit: 'h',
            quantity: { toNumber: () => 2 },
            unitPrice: { toNumber: () => 50 },
            discountValue: { toNumber: () => 0 },
            totalPrice: { toNumber: () => 100 },
          },
        ],
        signatures: [],
        attachments: [],
      };

      mockPrisma.quote.findUnique.mockResolvedValue(mockQuote);

      const result = await service.findByShareKey(mockShareKey);

      expect(result).toBeDefined();
      expect(result).not.toBeNull();
      if (result) {
        expect(result.id).toBe(mockQuoteId);
        expect(result.company.name).toBe('Test Company');
        expect(result.client.name).toBe('Client Name');
        expect(result.items).toHaveLength(1);
        expect(result.template.primaryColor).toBe('#7C3AED');
      }
    });
  });

  describe('rejectByShareKey', () => {
    const mockQuote = {
      id: mockQuoteId,
      status: 'SENT',
      notes: 'Original notes',
    };

    it('should reject quote successfully', async () => {
      mockPrisma.quote.findUnique.mockResolvedValue(mockQuote);
      mockPrisma.quote.update.mockResolvedValue({
        ...mockQuote,
        status: 'REJECTED',
      });

      const result = await service.rejectByShareKey(mockShareKey, 'Too expensive');

      expect(result.success).toBe(true);
      expect(result.quoteStatus).toBe('REJECTED');
      expect(mockPrisma.quote.update).toHaveBeenCalledWith({
        where: { id: mockQuoteId },
        data: expect.objectContaining({
          status: 'REJECTED',
        }),
      });
    });

    it('should reject without reason', async () => {
      mockPrisma.quote.findUnique.mockResolvedValue(mockQuote);
      mockPrisma.quote.update.mockResolvedValue({
        ...mockQuote,
        status: 'REJECTED',
      });

      const result = await service.rejectByShareKey(mockShareKey);

      expect(result.success).toBe(true);
    });

    it('should throw when quote not found', async () => {
      mockPrisma.quote.findUnique.mockResolvedValue(null);

      await expect(
        service.rejectByShareKey(mockShareKey),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw when quote is not in SENT status', async () => {
      mockPrisma.quote.findUnique.mockResolvedValue({
        ...mockQuote,
        status: 'APPROVED',
      });

      await expect(
        service.rejectByShareKey(mockShareKey),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.rejectByShareKey(mockShareKey),
      ).rejects.toThrow('já foi aprovado');
    });
  });
});
