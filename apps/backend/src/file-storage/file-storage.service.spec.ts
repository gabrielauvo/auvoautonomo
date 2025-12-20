import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FileStorageService } from './file-storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { STORAGE_PROVIDER } from './providers/storage-provider.interface';
import { AttachmentType } from './dto/upload-file.dto';

describe('FileStorageService', () => {
  let service: FileStorageService;
  let prisma: PrismaService;

  const mockUserId = 'user-123';

  const mockPrismaService = {
    attachment: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    publicLink: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    client: {
      findFirst: jest.fn(),
    },
    quote: {
      findFirst: jest.fn(),
    },
    workOrder: {
      findFirst: jest.fn(),
    },
  };

  const mockStorageProvider = {
    upload: jest.fn(),
    getBuffer: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileStorageService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: STORAGE_PROVIDER,
          useValue: mockStorageProvider,
        },
      ],
    }).compile();

    service = module.get<FileStorageService>(FileStorageService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('upload', () => {
    const mockFile: Express.Multer.File = {
      buffer: Buffer.from('test image content'),
      mimetype: 'image/png',
      originalname: 'test.png',
      size: 1024,
      fieldname: 'file',
      encoding: '7bit',
      destination: '',
      filename: '',
      path: '',
      stream: null as any,
    };

    it('should upload a file and create attachment record', async () => {
      const dto = {
        type: AttachmentType.PHOTO,
        description: 'Test photo',
      };

      const mockAttachment = {
        id: 'att-1',
        userId: mockUserId,
        type: 'PHOTO',
        mimeType: 'image/png',
        fileNameOriginal: 'test.png',
        fileSize: 1024,
        storagePath: 'user-123/2025/01/test-uuid.png',
        metadata: { description: 'Test photo' },
        createdAt: new Date(),
      };

      mockStorageProvider.upload.mockResolvedValue({
        storagePath: 'user-123/2025/01/test-uuid.png',
      });
      mockPrismaService.attachment.create.mockResolvedValue(mockAttachment);

      const result = await service.upload(mockUserId, mockFile, dto);

      expect(mockStorageProvider.upload).toHaveBeenCalled();
      expect(mockPrismaService.attachment.create).toHaveBeenCalled();
      expect(result.id).toBe('att-1');
      expect(result.type).toBe('PHOTO');
    });

    it('should reject files that are too large', async () => {
      const largeFile: Express.Multer.File = {
        ...mockFile,
        size: 20 * 1024 * 1024, // 20MB
      };

      await expect(
        service.upload(mockUserId, largeFile, { type: AttachmentType.PHOTO }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject invalid mime types', async () => {
      const invalidFile: Express.Multer.File = {
        ...mockFile,
        mimetype: 'application/x-executable',
      };

      await expect(
        service.upload(mockUserId, invalidFile, { type: AttachmentType.PHOTO }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate client exists when clientId provided', async () => {
      mockPrismaService.client.findFirst.mockResolvedValue(null);

      await expect(
        service.upload(mockUserId, mockFile, {
          type: AttachmentType.PHOTO,
          clientId: 'invalid-client',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne', () => {
    it('should return attachment by id', async () => {
      const mockAttachment = {
        id: 'att-1',
        userId: mockUserId,
        type: 'PHOTO',
        client: null,
        quote: null,
        workOrder: null,
        publicLinks: [],
      };

      mockPrismaService.attachment.findFirst.mockResolvedValue(mockAttachment);

      const result = await service.findOne(mockUserId, 'att-1');

      expect(result).toEqual(mockAttachment);
    });

    it('should throw NotFoundException when attachment not found', async () => {
      mockPrismaService.attachment.findFirst.mockResolvedValue(null);

      await expect(service.findOne(mockUserId, 'invalid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByQuote', () => {
    it('should return attachments for a quote', async () => {
      const mockQuote = { id: 'quote-1', userId: mockUserId };
      const mockAttachments = [
        { id: 'att-1', quoteId: 'quote-1' },
        { id: 'att-2', quoteId: 'quote-1' },
      ];

      mockPrismaService.quote.findFirst.mockResolvedValue(mockQuote);
      mockPrismaService.attachment.findMany.mockResolvedValue(mockAttachments);

      const result = await service.findByQuote(mockUserId, 'quote-1');

      expect(result).toEqual(mockAttachments);
    });

    it('should throw when quote not found', async () => {
      mockPrismaService.quote.findFirst.mockResolvedValue(null);

      await expect(
        service.findByQuote(mockUserId, 'invalid'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should delete attachment and file', async () => {
      const mockAttachment = {
        id: 'att-1',
        userId: mockUserId,
        storagePath: 'path/to/file.png',
      };

      mockPrismaService.attachment.findFirst.mockResolvedValue(mockAttachment);
      mockStorageProvider.delete.mockResolvedValue(undefined);
      mockPrismaService.attachment.delete.mockResolvedValue(mockAttachment);

      const result = await service.remove(mockUserId, 'att-1');

      expect(mockStorageProvider.delete).toHaveBeenCalledWith('path/to/file.png');
      expect(mockPrismaService.attachment.delete).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  describe('createPublicLink', () => {
    it('should create a public link for attachment', async () => {
      const mockAttachment = {
        id: 'att-1',
        userId: mockUserId,
      };
      const mockPublicLink = {
        id: 'link-1',
        attachmentId: 'att-1',
        token: 'random-token',
        expiresAt: new Date(),
      };

      mockPrismaService.attachment.findFirst.mockResolvedValue(mockAttachment);
      mockPrismaService.publicLink.create.mockResolvedValue(mockPublicLink);

      const result = await service.createPublicLink(mockUserId, 'att-1', {});

      expect(result.token).toBeDefined();
      expect(result.url).toContain('/api/public/files/');
    });
  });

  describe('getFileByToken', () => {
    it('should return file buffer for valid token', async () => {
      const mockLink = {
        id: 'link-1',
        token: 'valid-token',
        expiresAt: new Date(Date.now() + 86400000), // Tomorrow
        attachment: {
          storagePath: 'path/to/file.png',
          mimeType: 'image/png',
          fileNameOriginal: 'test.png',
        },
      };

      mockPrismaService.publicLink.findUnique.mockResolvedValue(mockLink);
      mockPrismaService.publicLink.update.mockResolvedValue(mockLink);
      mockStorageProvider.getBuffer.mockResolvedValue(Buffer.from('content'));

      const result = await service.getFileByToken('valid-token');

      expect(result.buffer).toBeDefined();
      expect(result.mimeType).toBe('image/png');
    });

    it('should throw for expired link', async () => {
      const mockLink = {
        id: 'link-1',
        token: 'expired-token',
        expiresAt: new Date(Date.now() - 86400000), // Yesterday
        attachment: {},
      };

      mockPrismaService.publicLink.findUnique.mockResolvedValue(mockLink);

      await expect(service.getFileByToken('expired-token')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw for invalid token', async () => {
      mockPrismaService.publicLink.findUnique.mockResolvedValue(null);

      await expect(service.getFileByToken('invalid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('uploadFromBase64', () => {
    it('should upload file from base64 string', async () => {
      const base64Data = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const dto = { type: AttachmentType.SIGNATURE };

      const mockAttachment = {
        id: 'att-1',
        type: 'SIGNATURE',
        mimeType: 'image/png',
        fileNameOriginal: 'signature.png',
        fileSize: 100,
        createdAt: new Date(),
      };

      mockStorageProvider.upload.mockResolvedValue({
        storagePath: 'path/to/signature.png',
      });
      mockPrismaService.attachment.create.mockResolvedValue(mockAttachment);

      const result = await service.uploadFromBase64(mockUserId, base64Data, dto);

      expect(result.type).toBe('SIGNATURE');
    });
  });
});
