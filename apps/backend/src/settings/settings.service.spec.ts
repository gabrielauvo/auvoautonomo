import { Test, TestingModule } from '@nestjs/testing';
import { SettingsService, AcceptanceTermsResponse } from './settings.service';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

describe('SettingsService', () => {
  let service: SettingsService;
  let prisma: PrismaService;

  const mockUserId = 'user-123';

  const mockPrisma = {
    templateSettings: {
      findUnique: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Acceptance Terms', () => {
    describe('getAcceptanceTerms', () => {
      it('should return default values when no settings exist', async () => {
        mockPrisma.templateSettings.findUnique.mockResolvedValue(null);

        const result = await service.getAcceptanceTerms(mockUserId);

        expect(result).toEqual({
          enabled: false,
          termsContent: null,
          version: 0,
          updatedAt: null,
          termsHash: null,
        });
      });

      it('should return acceptance terms with hash when enabled', async () => {
        const termsContent = 'These are the acceptance terms for the quote.';
        const expectedHash = crypto.createHash('sha256').update(termsContent, 'utf8').digest('hex');
        const updatedAt = new Date('2024-01-15T10:00:00Z');

        mockPrisma.templateSettings.findUnique.mockResolvedValue({
          acceptanceTermsEnabled: true,
          quoteTermsConditions: termsContent,
          acceptanceTermsVersion: 2,
          acceptanceTermsUpdatedAt: updatedAt,
        });

        const result = await service.getAcceptanceTerms(mockUserId);

        expect(result).toEqual({
          enabled: true,
          termsContent: termsContent,
          version: 2,
          updatedAt: updatedAt.toISOString(),
          termsHash: expectedHash,
        });
      });

      it('should return null hash when terms content is null', async () => {
        mockPrisma.templateSettings.findUnique.mockResolvedValue({
          acceptanceTermsEnabled: false,
          quoteTermsConditions: null,
          acceptanceTermsVersion: 0,
          acceptanceTermsUpdatedAt: null,
        });

        const result = await service.getAcceptanceTerms(mockUserId);

        expect(result.termsHash).toBeNull();
        expect(result.termsContent).toBeNull();
      });

      it('should return null hash when terms content is empty string', async () => {
        mockPrisma.templateSettings.findUnique.mockResolvedValue({
          acceptanceTermsEnabled: true,
          quoteTermsConditions: '   ',
          acceptanceTermsVersion: 1,
          acceptanceTermsUpdatedAt: new Date(),
        });

        const result = await service.getAcceptanceTerms(mockUserId);

        expect(result.termsHash).toBeNull();
      });
    });

    describe('updateAcceptanceTerms', () => {
      it('should create settings when none exist', async () => {
        const termsContent = 'New acceptance terms';
        const expectedHash = crypto.createHash('sha256').update(termsContent, 'utf8').digest('hex');

        mockPrisma.templateSettings.findUnique.mockResolvedValue(null);
        mockPrisma.templateSettings.upsert.mockResolvedValue({
          acceptanceTermsEnabled: true,
          quoteTermsConditions: termsContent,
          acceptanceTermsVersion: 1,
          acceptanceTermsUpdatedAt: new Date(),
        });

        const result = await service.updateAcceptanceTerms(mockUserId, {
          enabled: true,
          termsContent,
        });

        expect(result.enabled).toBe(true);
        expect(result.termsContent).toBe(termsContent);
        expect(result.version).toBe(1);
        expect(result.termsHash).toBe(expectedHash);
        expect(mockPrisma.templateSettings.upsert).toHaveBeenCalled();
      });

      it('should increment version when content changes', async () => {
        const oldContent = 'Old terms';
        const newContent = 'New terms content';

        mockPrisma.templateSettings.findUnique.mockResolvedValue({
          quoteTermsConditions: oldContent,
          acceptanceTermsVersion: 2,
        });
        mockPrisma.templateSettings.upsert.mockResolvedValue({
          acceptanceTermsEnabled: true,
          quoteTermsConditions: newContent,
          acceptanceTermsVersion: 3,
          acceptanceTermsUpdatedAt: new Date(),
        });

        const result = await service.updateAcceptanceTerms(mockUserId, {
          termsContent: newContent,
        });

        expect(result.version).toBe(3);

        // Verify upsert was called with version increment
        const upsertCall = mockPrisma.templateSettings.upsert.mock.calls[0][0];
        expect(upsertCall.update.acceptanceTermsVersion).toBe(3);
        expect(upsertCall.update.acceptanceTermsUpdatedAt).toBeDefined();
      });

      it('should not increment version when only enabled changes', async () => {
        const content = 'Existing terms';

        mockPrisma.templateSettings.findUnique.mockResolvedValue({
          quoteTermsConditions: content,
          acceptanceTermsVersion: 2,
        });
        mockPrisma.templateSettings.upsert.mockResolvedValue({
          acceptanceTermsEnabled: false,
          quoteTermsConditions: content,
          acceptanceTermsVersion: 2,
          acceptanceTermsUpdatedAt: new Date(),
        });

        const result = await service.updateAcceptanceTerms(mockUserId, {
          enabled: false,
        });

        expect(result.version).toBe(2);

        // Verify version was not incremented
        const upsertCall = mockPrisma.templateSettings.upsert.mock.calls[0][0];
        expect(upsertCall.update.acceptanceTermsVersion).toBeUndefined();
      });

      it('should update only enabled flag', async () => {
        mockPrisma.templateSettings.findUnique.mockResolvedValue({
          quoteTermsConditions: 'Existing content',
          acceptanceTermsVersion: 1,
        });
        mockPrisma.templateSettings.upsert.mockResolvedValue({
          acceptanceTermsEnabled: true,
          quoteTermsConditions: 'Existing content',
          acceptanceTermsVersion: 1,
          acceptanceTermsUpdatedAt: null,
        });

        await service.updateAcceptanceTerms(mockUserId, {
          enabled: true,
        });

        const upsertCall = mockPrisma.templateSettings.upsert.mock.calls[0][0];
        expect(upsertCall.update.acceptanceTermsEnabled).toBe(true);
        expect(upsertCall.update.quoteTermsConditions).toBeUndefined();
      });

      it('should handle setting content to null', async () => {
        mockPrisma.templateSettings.findUnique.mockResolvedValue({
          quoteTermsConditions: 'Old content',
          acceptanceTermsVersion: 2,
        });
        mockPrisma.templateSettings.upsert.mockResolvedValue({
          acceptanceTermsEnabled: false,
          quoteTermsConditions: null,
          acceptanceTermsVersion: 3,
          acceptanceTermsUpdatedAt: new Date(),
        });

        const result = await service.updateAcceptanceTerms(mockUserId, {
          termsContent: null,
        });

        expect(result.termsContent).toBeNull();
        expect(result.termsHash).toBeNull();
      });
    });

    describe('getAcceptanceTermsForQuote', () => {
      it('should return required=true when terms are enabled with content', async () => {
        const termsContent = 'Valid acceptance terms';
        const expectedHash = crypto.createHash('sha256').update(termsContent, 'utf8').digest('hex');

        mockPrisma.templateSettings.findUnique.mockResolvedValue({
          acceptanceTermsEnabled: true,
          quoteTermsConditions: termsContent,
          acceptanceTermsVersion: 3,
        });

        const result = await service.getAcceptanceTermsForQuote(mockUserId);

        expect(result).toEqual({
          required: true,
          termsContent: termsContent,
          version: 3,
          termsHash: expectedHash,
        });
      });

      it('should return required=false when terms are disabled', async () => {
        mockPrisma.templateSettings.findUnique.mockResolvedValue({
          acceptanceTermsEnabled: false,
          quoteTermsConditions: 'Some content',
          acceptanceTermsVersion: 1,
        });

        const result = await service.getAcceptanceTermsForQuote(mockUserId);

        expect(result).toEqual({
          required: false,
          termsContent: null,
          version: 0,
          termsHash: null,
        });
      });

      it('should return required=false when terms content is empty', async () => {
        mockPrisma.templateSettings.findUnique.mockResolvedValue({
          acceptanceTermsEnabled: true,
          quoteTermsConditions: '   ',
          acceptanceTermsVersion: 1,
        });

        const result = await service.getAcceptanceTermsForQuote(mockUserId);

        expect(result.required).toBe(false);
        expect(result.termsContent).toBeNull();
      });

      it('should return required=false when terms content is null', async () => {
        mockPrisma.templateSettings.findUnique.mockResolvedValue({
          acceptanceTermsEnabled: true,
          quoteTermsConditions: null,
          acceptanceTermsVersion: 1,
        });

        const result = await service.getAcceptanceTermsForQuote(mockUserId);

        expect(result.required).toBe(false);
      });

      it('should return required=false when no settings exist', async () => {
        mockPrisma.templateSettings.findUnique.mockResolvedValue(null);

        const result = await service.getAcceptanceTermsForQuote(mockUserId);

        expect(result).toEqual({
          required: false,
          termsContent: null,
          version: 0,
          termsHash: null,
        });
      });
    });

    describe('Hash Calculation', () => {
      it('should generate consistent hash for same content', async () => {
        const content = 'Test terms content';
        const expectedHash = crypto.createHash('sha256').update(content, 'utf8').digest('hex');

        mockPrisma.templateSettings.findUnique.mockResolvedValue({
          acceptanceTermsEnabled: true,
          quoteTermsConditions: content,
          acceptanceTermsVersion: 1,
          acceptanceTermsUpdatedAt: new Date(),
        });

        const result1 = await service.getAcceptanceTerms(mockUserId);
        const result2 = await service.getAcceptanceTerms(mockUserId);

        expect(result1.termsHash).toBe(expectedHash);
        expect(result2.termsHash).toBe(expectedHash);
        expect(result1.termsHash).toBe(result2.termsHash);
      });

      it('should generate different hash for different content', async () => {
        const content1 = 'Terms version 1';
        const content2 = 'Terms version 2';

        mockPrisma.templateSettings.findUnique.mockResolvedValueOnce({
          acceptanceTermsEnabled: true,
          quoteTermsConditions: content1,
          acceptanceTermsVersion: 1,
          acceptanceTermsUpdatedAt: new Date(),
        });

        const result1 = await service.getAcceptanceTerms(mockUserId);

        mockPrisma.templateSettings.findUnique.mockResolvedValueOnce({
          acceptanceTermsEnabled: true,
          quoteTermsConditions: content2,
          acceptanceTermsVersion: 2,
          acceptanceTermsUpdatedAt: new Date(),
        });

        const result2 = await service.getAcceptanceTerms(mockUserId);

        expect(result1.termsHash).not.toBe(result2.termsHash);
      });
    });
  });

  describe('Template Settings', () => {
    it('should create default settings when none exist', async () => {
      mockPrisma.templateSettings.findUnique.mockResolvedValue(null);
      mockPrisma.templateSettings.create.mockResolvedValue({
        userId: mockUserId,
        quoteShowLogo: true,
        quoteLogoPosition: 'left',
        quotePrimaryColor: '#7C3AED',
        quoteSecondaryColor: '#6D28D9',
        quoteHeaderText: null,
        quoteFooterText: 'Obrigado pela preferência!',
        quoteDefaultMessage: 'Segue nosso orçamento conforme solicitado.',
        quoteTermsConditions: null,
        quoteShowSignature: false,
        workOrderShowLogo: true,
        workOrderLogoPosition: 'left',
        workOrderPrimaryColor: '#7C3AED',
        workOrderLayout: 'detailed',
        workOrderShowChecklist: true,
        workOrderFooterText: null,
        workOrderShowSignatureField: true,
        workOrderSignatureLabel: 'Assinatura do Cliente',
        chargeWhatsappMessage: 'Test message',
        chargeEmailSubject: 'Test subject',
        chargeEmailBody: null,
        chargeReminderMessage: 'Test reminder',
      });

      const result = await service.getTemplateSettings(mockUserId);

      expect(mockPrisma.templateSettings.create).toHaveBeenCalled();
      expect(result.quote.showLogo).toBe(true);
      expect(result.quote.primaryColor).toBe('#7C3AED');
    });

    it('should return existing settings', async () => {
      const existingSettings = {
        userId: mockUserId,
        quoteShowLogo: false,
        quoteLogoPosition: 'right',
        quotePrimaryColor: '#FF0000',
        quoteSecondaryColor: '#00FF00',
        quoteHeaderText: 'Custom header',
        quoteFooterText: 'Custom footer',
        quoteDefaultMessage: 'Custom message',
        quoteTermsConditions: 'Custom terms',
        quoteShowSignature: true,
        workOrderShowLogo: false,
        workOrderLogoPosition: 'center',
        workOrderPrimaryColor: '#0000FF',
        workOrderLayout: 'compact',
        workOrderShowChecklist: false,
        workOrderFooterText: 'WO footer',
        workOrderShowSignatureField: false,
        workOrderSignatureLabel: 'Sign here',
        chargeWhatsappMessage: 'WA message',
        chargeEmailSubject: 'Email subject',
        chargeEmailBody: 'Email body',
        chargeReminderMessage: 'Reminder',
      };

      mockPrisma.templateSettings.findUnique.mockResolvedValue(existingSettings);

      const result = await service.getTemplateSettings(mockUserId);

      expect(mockPrisma.templateSettings.create).not.toHaveBeenCalled();
      expect(result.quote.showLogo).toBe(false);
      expect(result.quote.primaryColor).toBe('#FF0000');
      expect(result.workOrder.layout).toBe('compact');
    });
  });
});
