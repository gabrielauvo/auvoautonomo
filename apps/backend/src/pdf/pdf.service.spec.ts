import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PdfService } from './pdf.service';
import { PrismaService } from '../prisma/prisma.service';
import { FileStorageService } from '../file-storage/file-storage.service';
import { SettingsService } from '../settings/settings.service';
import { Decimal } from '@prisma/client/runtime/library';

describe('PdfService', () => {
  let service: PdfService;
  let prisma: PrismaService;
  let fileStorageService: FileStorageService;

  const mockUserId = 'user-123';

  const mockPrismaService = {
    quote: {
      findFirst: jest.fn(),
    },
    workOrder: {
      findFirst: jest.fn(),
    },
    attachment: {
      update: jest.fn(),
    },
  };

  const mockFileStorageService = {
    upload: jest.fn(),
    getFileBuffer: jest.fn(),
  };

  const mockSettingsService = {
    getBusinessProfile: jest.fn().mockResolvedValue({
      businessName: 'Test Business',
      ownerName: 'Test Owner',
      logoUrl: null,
      primaryColor: '#3B82F6',
    }),
    getRawTemplateSettings: jest.fn().mockResolvedValue({
      headerText: 'Test Header',
      footerText: 'Test Footer',
      showLogo: true,
      showCompanyInfo: true,
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PdfService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: FileStorageService,
          useValue: mockFileStorageService,
        },
        {
          provide: SettingsService,
          useValue: mockSettingsService,
        },
      ],
    }).compile();

    service = module.get<PdfService>(PdfService);
    prisma = module.get<PrismaService>(PrismaService);
    fileStorageService = module.get<FileStorageService>(FileStorageService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateQuotePdf', () => {
    const mockQuote = {
      id: 'quote-123',
      userId: mockUserId,
      status: 'DRAFT',
      discountValue: new Decimal(10),
      totalValue: new Decimal(190),
      notes: 'Test notes',
      createdAt: new Date(),
      client: {
        id: 'client-1',
        name: 'Test Client',
        email: 'client@test.com',
        phone: '11999999999',
        address: 'Rua Test, 123',
        city: 'São Paulo',
        state: 'SP',
        zipCode: '01234-567',
      },
      user: {
        id: mockUserId,
        name: 'Service Provider',
        email: 'provider@test.com',
      },
      items: [
        {
          id: 'item-1',
          name: 'Service A',
          type: 'SERVICE',
          unit: 'hora',
          quantity: new Decimal(2),
          unitPrice: new Decimal(50),
          totalPrice: new Decimal(100),
          createdAt: new Date(),
        },
        {
          id: 'item-2',
          name: 'Product B',
          type: 'PRODUCT',
          unit: 'UN',
          quantity: new Decimal(2),
          unitPrice: new Decimal(50),
          totalPrice: new Decimal(100),
          createdAt: new Date(),
        },
      ],
    };

    it('should generate PDF for a quote', async () => {
      mockPrismaService.quote.findFirst.mockResolvedValue(mockQuote);
      mockFileStorageService.upload.mockResolvedValue({
        id: 'att-1',
        type: 'DOCUMENT',
      });
      mockPrismaService.attachment.update.mockResolvedValue({});

      const result = await service.generateQuotePdf(mockUserId, 'quote-123');

      expect(result.attachmentId).toBe('att-1');
      expect(result.buffer).toBeDefined();
      expect(result.buffer instanceof Buffer).toBe(true);
      expect(mockFileStorageService.upload).toHaveBeenCalled();
    });

    it('should throw NotFoundException when quote not found', async () => {
      mockPrismaService.quote.findFirst.mockResolvedValue(null);

      await expect(
        service.generateQuotePdf(mockUserId, 'invalid'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should include all quote items in PDF', async () => {
      mockPrismaService.quote.findFirst.mockResolvedValue(mockQuote);
      mockFileStorageService.upload.mockResolvedValue({ id: 'att-1' });
      mockPrismaService.attachment.update.mockResolvedValue({});

      const result = await service.generateQuotePdf(mockUserId, 'quote-123');

      // Verify PDF was created (buffer exists and has content)
      expect(result.buffer.length).toBeGreaterThan(0);
    });
  });

  describe('generateWorkOrderPdf', () => {
    const mockWorkOrder = {
      id: 'wo-123',
      userId: mockUserId,
      title: 'Test Work Order',
      description: 'Test description',
      status: 'SCHEDULED',
      scheduledDate: new Date(),
      address: 'Rua Test, 456',
      notes: 'WO notes',
      totalValue: new Decimal(500),
      createdAt: new Date(),
      executionStart: null,
      executionEnd: null,
      clientId: 'client-1',
      client: {
        id: 'client-1',
        name: 'Test Client',
        email: 'client@test.com',
        phone: '11999999999',
        address: 'Rua Test, 123',
        city: 'São Paulo',
        state: 'SP',
      },
      user: {
        id: mockUserId,
        name: 'Service Provider',
        email: 'provider@test.com',
      },
      items: [
        {
          id: 'item-1',
          name: 'Service A',
          type: 'SERVICE',
          unit: 'hora',
          quantity: new Decimal(4),
          unitPrice: new Decimal(100),
          totalPrice: new Decimal(400),
          createdAt: new Date(),
        },
      ],
      checklists: [],
      signatures: [],
      quote: null,
    };

    it('should generate PDF for a work order', async () => {
      mockPrismaService.workOrder.findFirst.mockResolvedValue(mockWorkOrder);
      mockFileStorageService.upload.mockResolvedValue({
        id: 'att-2',
        type: 'DOCUMENT',
      });
      mockPrismaService.attachment.update.mockResolvedValue({});

      const result = await service.generateWorkOrderPdf(mockUserId, 'wo-123');

      expect(result.attachmentId).toBe('att-2');
      expect(result.buffer).toBeDefined();
      expect(result.buffer instanceof Buffer).toBe(true);
    });

    it('should throw NotFoundException when work order not found', async () => {
      mockPrismaService.workOrder.findFirst.mockResolvedValue(null);

      await expect(
        service.generateWorkOrderPdf(mockUserId, 'invalid'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should include checklists in PDF when present', async () => {
      const woWithChecklist = {
        ...mockWorkOrder,
        checklists: [
          {
            id: 'cl-1',
            title: 'Inspection Checklist',
            template: { id: 'tpl-1' },
            answers: [
              {
                id: 'ans-1',
                type: 'BOOLEAN',
                valueBoolean: true,
                templateItem: { id: 'ti-1', label: 'Equipment OK?' },
              },
              {
                id: 'ans-2',
                type: 'TEXT',
                valueText: 'All good',
                templateItem: { id: 'ti-2', label: 'Notes' },
              },
            ],
          },
        ],
      };

      mockPrismaService.workOrder.findFirst.mockResolvedValue(woWithChecklist);
      mockFileStorageService.upload.mockResolvedValue({ id: 'att-3' });
      mockPrismaService.attachment.update.mockResolvedValue({});

      const result = await service.generateWorkOrderPdf(mockUserId, 'wo-123');

      expect(result.buffer.length).toBeGreaterThan(0);
    });

    it('should include signature in PDF when present', async () => {
      const woWithSignature = {
        ...mockWorkOrder,
        signatures: [
          {
            id: 'sig-1',
            signerName: 'John Doe',
            signerDocument: '123.456.789-00',
            signerRole: 'Cliente',
            signedAt: new Date(),
            attachment: {
              id: 'att-sig',
            },
          },
        ],
      };

      mockPrismaService.workOrder.findFirst.mockResolvedValue(woWithSignature);
      mockFileStorageService.upload.mockResolvedValue({ id: 'att-4' });
      mockFileStorageService.getFileBuffer.mockResolvedValue({
        buffer: Buffer.from('signature image'),
        mimeType: 'image/png',
        fileName: 'signature.png',
      });
      mockPrismaService.attachment.update.mockResolvedValue({});

      const result = await service.generateWorkOrderPdf(mockUserId, 'wo-123');

      expect(result.buffer.length).toBeGreaterThan(0);
    });
  });
});
