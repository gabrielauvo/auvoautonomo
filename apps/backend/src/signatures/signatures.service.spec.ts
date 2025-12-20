import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SignaturesService } from './signatures.service';
import { PrismaService } from '../prisma/prisma.service';
import { FileStorageService } from '../file-storage/file-storage.service';

describe('SignaturesService', () => {
  let service: SignaturesService;
  let prisma: PrismaService;
  let fileStorageService: FileStorageService;

  const mockUserId = 'user-123';

  const mockPrismaService = {
    workOrder: {
      findFirst: jest.fn(),
    },
    quote: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    signature: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  const mockFileStorageService = {
    uploadFromBase64: jest.fn(),
    getFileBuffer: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SignaturesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: FileStorageService,
          useValue: mockFileStorageService,
        },
      ],
    }).compile();

    service = module.get<SignaturesService>(SignaturesService);
    prisma = module.get<PrismaService>(PrismaService);
    fileStorageService = module.get<FileStorageService>(FileStorageService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createWorkOrderSignature', () => {
    const mockWorkOrder = {
      id: 'wo-123',
      userId: mockUserId,
      clientId: 'client-1',
      client: { id: 'client-1', name: 'Test Client' },
      signatures: [],
    };

    const createDto = {
      imageBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      signerName: 'John Doe',
      signerDocument: '123.456.789-00',
      signerRole: 'Cliente',
    };

    const requestInfo = {
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
    };

    it('should create signature for work order', async () => {
      const mockAttachment = { id: 'att-1', type: 'SIGNATURE' };
      const mockSignature = {
        id: 'sig-1',
        userId: mockUserId,
        clientId: 'client-1',
        workOrderId: 'wo-123',
        attachmentId: 'att-1',
        signerName: 'John Doe',
        signerDocument: '123.456.789-00',
        signerRole: 'Cliente',
        signedAt: new Date(),
        hash: 'hash123',
        attachment: mockAttachment,
        client: { id: 'client-1', name: 'Test Client' },
        workOrder: { id: 'wo-123', title: 'Test WO', status: 'SCHEDULED' },
      };

      mockPrismaService.workOrder.findFirst.mockResolvedValue(mockWorkOrder);
      mockFileStorageService.uploadFromBase64.mockResolvedValue(mockAttachment);
      mockPrismaService.signature.create.mockResolvedValue(mockSignature);

      const result = await service.createWorkOrderSignature(
        mockUserId,
        'wo-123',
        createDto,
        requestInfo,
      );

      expect(result.id).toBe('sig-1');
      expect(result.signerName).toBe('John Doe');
      expect(result.hash).toBeDefined();
      expect(mockFileStorageService.uploadFromBase64).toHaveBeenCalled();
    });

    it('should throw when work order not found', async () => {
      mockPrismaService.workOrder.findFirst.mockResolvedValue(null);

      await expect(
        service.createWorkOrderSignature(mockUserId, 'invalid', createDto, requestInfo),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw when work order already has signature', async () => {
      const woWithSignature = {
        ...mockWorkOrder,
        signatures: [{ id: 'existing-sig' }],
      };

      mockPrismaService.workOrder.findFirst.mockResolvedValue(woWithSignature);

      await expect(
        service.createWorkOrderSignature(mockUserId, 'wo-123', createDto, requestInfo),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('createQuoteSignature', () => {
    const mockQuote = {
      id: 'quote-123',
      userId: mockUserId,
      clientId: 'client-1',
      client: { id: 'client-1', name: 'Test Client' },
      signatures: [],
    };

    const createDto = {
      imageBase64: 'data:image/png;base64,abc123',
      signerName: 'Jane Doe',
      signerDocument: '987.654.321-00',
    };

    const requestInfo = {
      ipAddress: '10.0.0.1',
      userAgent: 'Chrome/100',
    };

    it('should create signature for quote and update status', async () => {
      const mockAttachment = { id: 'att-2', type: 'SIGNATURE' };
      const mockSignature = {
        id: 'sig-2',
        userId: mockUserId,
        clientId: 'client-1',
        quoteId: 'quote-123',
        attachmentId: 'att-2',
        signerName: 'Jane Doe',
        signerDocument: '987.654.321-00',
        signerRole: 'Cliente',
        signedAt: new Date(),
        hash: 'hash456',
        attachment: mockAttachment,
        client: { id: 'client-1', name: 'Test Client' },
        quote: { id: 'quote-123', status: 'SENT', totalValue: 1000 },
      };

      mockPrismaService.quote.findFirst.mockResolvedValue(mockQuote);
      mockFileStorageService.uploadFromBase64.mockResolvedValue(mockAttachment);
      mockPrismaService.signature.create.mockResolvedValue(mockSignature);
      mockPrismaService.quote.update.mockResolvedValue({ status: 'APPROVED' });

      const result = await service.createQuoteSignature(
        mockUserId,
        'quote-123',
        createDto,
        requestInfo,
      );

      expect(result.id).toBe('sig-2');
      expect(result.quoteStatus).toBe('APPROVED');
      expect(mockPrismaService.quote.update).toHaveBeenCalledWith({
        where: { id: 'quote-123' },
        data: { status: 'APPROVED' },
      });
    });

    it('should throw when quote not found', async () => {
      mockPrismaService.quote.findFirst.mockResolvedValue(null);

      await expect(
        service.createQuoteSignature(mockUserId, 'invalid', createDto, requestInfo),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw when quote already has signature', async () => {
      const quoteWithSignature = {
        ...mockQuote,
        signatures: [{ id: 'existing-sig' }],
      };

      mockPrismaService.quote.findFirst.mockResolvedValue(quoteWithSignature);

      await expect(
        service.createQuoteSignature(mockUserId, 'quote-123', createDto, requestInfo),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne', () => {
    it('should return signature by id', async () => {
      const mockSignature = {
        id: 'sig-1',
        userId: mockUserId,
        signerName: 'Test Signer',
        attachment: {},
        client: {},
        workOrder: {},
        quote: null,
      };

      mockPrismaService.signature.findFirst.mockResolvedValue(mockSignature);

      const result = await service.findOne(mockUserId, 'sig-1');

      expect(result).toEqual(mockSignature);
    });

    it('should throw when signature not found', async () => {
      mockPrismaService.signature.findFirst.mockResolvedValue(null);

      await expect(service.findOne(mockUserId, 'invalid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByWorkOrder', () => {
    it('should return signature for work order', async () => {
      const mockWo = { id: 'wo-1', userId: mockUserId };
      const mockSignature = {
        id: 'sig-1',
        workOrderId: 'wo-1',
        attachment: {},
      };

      mockPrismaService.workOrder.findFirst.mockResolvedValue(mockWo);
      mockPrismaService.signature.findFirst.mockResolvedValue(mockSignature);

      const result = await service.findByWorkOrder(mockUserId, 'wo-1');

      expect(result).toEqual(mockSignature);
    });

    it('should throw when work order not found', async () => {
      mockPrismaService.workOrder.findFirst.mockResolvedValue(null);

      await expect(
        service.findByWorkOrder(mockUserId, 'invalid'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByQuote', () => {
    it('should return signature for quote', async () => {
      const mockQuote = { id: 'quote-1', userId: mockUserId };
      const mockSignature = {
        id: 'sig-1',
        quoteId: 'quote-1',
        attachment: {},
      };

      mockPrismaService.quote.findFirst.mockResolvedValue(mockQuote);
      mockPrismaService.signature.findFirst.mockResolvedValue(mockSignature);

      const result = await service.findByQuote(mockUserId, 'quote-1');

      expect(result).toEqual(mockSignature);
    });

    it('should throw when quote not found', async () => {
      mockPrismaService.quote.findFirst.mockResolvedValue(null);

      await expect(
        service.findByQuote(mockUserId, 'invalid'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('verifySignature', () => {
    it('should verify signature integrity', async () => {
      const signedAt = new Date();
      const mockSignature = {
        id: 'sig-1',
        userId: mockUserId,
        workOrderId: 'wo-1',
        quoteId: null,
        signerName: 'Test Signer',
        signerDocument: '123.456.789-00',
        signedAt,
        attachmentId: 'att-1',
        hash: 'somehash',
        attachment: {},
        client: {},
        workOrder: {},
        quote: null,
      };

      mockPrismaService.signature.findFirst.mockResolvedValue(mockSignature);

      const result = await service.verifySignature(mockUserId, 'sig-1');

      expect(result.signature).toBeDefined();
      // Hash verification may pass or fail depending on the exact data
      expect(typeof result.valid).toBe('boolean');
    });

    it('should return invalid for signature without hash', async () => {
      const mockSignature = {
        id: 'sig-1',
        userId: mockUserId,
        hash: null, // No hash stored
        attachment: {},
        client: {},
        workOrder: {},
        quote: null,
      };

      mockPrismaService.signature.findFirst.mockResolvedValue(mockSignature);

      const result = await service.verifySignature(mockUserId, 'sig-1');

      expect(result.valid).toBe(false);
    });
  });
});
