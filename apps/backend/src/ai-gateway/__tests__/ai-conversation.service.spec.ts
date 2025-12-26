import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AiConversationService } from '../services/ai-conversation.service';
import { PrismaService } from '../../prisma/prisma.service';

// Mock enum values since Prisma types may not be available in test
const AiConversationStatus = {
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  ARCHIVED: 'ARCHIVED',
} as const;

describe('AiConversationService', () => {
  let service: AiConversationService;
  let prisma: PrismaService;

  const mockPrismaService = {
    aiConversation: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    aiMessage: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiConversationService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AiConversationService>(AiConversationService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createConversation', () => {
    it('should create a new conversation', async () => {
      const mockConversation = {
        id: 'conv-123',
        userId: 'user-123',
        title: 'Test Conversation',
        status: AiConversationStatus.ACTIVE,
        expiresAt: new Date(),
      };

      mockPrismaService.aiConversation.create.mockResolvedValue(mockConversation);

      const result = await service.createConversation('user-123', 'Test Conversation');

      expect(result).toEqual(mockConversation);
      expect(mockPrismaService.aiConversation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          title: 'Test Conversation',
          status: AiConversationStatus.ACTIVE,
          expiresAt: expect.any(Date),
        }),
      });
    });

    it('should set expiration to 24 hours from now', async () => {
      const now = Date.now();
      jest.spyOn(Date, 'now').mockReturnValue(now);

      mockPrismaService.aiConversation.create.mockImplementation(({ data }) => {
        return Promise.resolve(data);
      });

      await service.createConversation('user-123');

      expect(mockPrismaService.aiConversation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          expiresAt: expect.any(Date),
        }),
      });

      const call = mockPrismaService.aiConversation.create.mock.calls[0][0];
      const expiresAt = call.data.expiresAt.getTime();
      const expectedExpiry = now + 24 * 60 * 60 * 1000;

      // Allow 1 second tolerance
      expect(Math.abs(expiresAt - expectedExpiry)).toBeLessThan(1000);

      jest.restoreAllMocks();
    });
  });

  describe('getConversation', () => {
    it('should return conversation with messages for owner', async () => {
      const mockConversation = {
        id: 'conv-123',
        userId: 'user-123',
        status: AiConversationStatus.ACTIVE,
        messages: [{ id: 'msg-1', content: 'Hello' }],
      };

      mockPrismaService.aiConversation.findFirst.mockResolvedValue(mockConversation);

      const result = await service.getConversation('conv-123', 'user-123');

      expect(result).toEqual(mockConversation);
      expect(mockPrismaService.aiConversation.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'conv-123',
          userId: 'user-123',
          status: AiConversationStatus.ACTIVE,
        },
        include: {
          messages: { orderBy: { createdAt: 'asc' } },
        },
      });
    });

    it('should throw NotFoundException if conversation not found', async () => {
      mockPrismaService.aiConversation.findFirst.mockResolvedValue(null);

      await expect(service.getConversation('conv-123', 'user-123')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should not return conversation from another user (multi-tenant)', async () => {
      mockPrismaService.aiConversation.findFirst.mockResolvedValue(null);

      await expect(service.getConversation('conv-123', 'other-user')).rejects.toThrow(
        NotFoundException,
      );

      expect(mockPrismaService.aiConversation.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId: 'other-user',
        }),
        include: expect.any(Object),
      });
    });
  });

  describe('addMessage', () => {
    it('should add message to conversation and update counts', async () => {
      const mockConversation = { id: 'conv-123', userId: 'user-123' };
      const mockMessage = {
        id: 'msg-123',
        conversationId: 'conv-123',
        role: 'user',
        content: 'Hello',
      };

      mockPrismaService.aiConversation.findFirst.mockResolvedValue(mockConversation);
      mockPrismaService.$transaction.mockResolvedValue([mockMessage, mockConversation]);

      const result = await service.addMessage('conv-123', 'user-123', {
        role: 'user',
        content: 'Hello',
      });

      expect(result).toEqual(mockMessage);
      expect(mockPrismaService.aiConversation.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'conv-123',
          userId: 'user-123',
        },
      });
    });

    it('should throw NotFoundException if conversation not owned by user', async () => {
      mockPrismaService.aiConversation.findFirst.mockResolvedValue(null);

      await expect(
        service.addMessage('conv-123', 'other-user', {
          role: 'user',
          content: 'Hello',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getOrCreateActiveConversation', () => {
    it('should return existing active conversation', async () => {
      const mockConversation = {
        id: 'conv-123',
        userId: 'user-123',
        status: AiConversationStatus.ACTIVE,
      };

      mockPrismaService.aiConversation.findFirst.mockResolvedValue(mockConversation);

      const result = await service.getOrCreateActiveConversation('user-123');

      expect(result).toEqual(mockConversation);
      expect(mockPrismaService.aiConversation.create).not.toHaveBeenCalled();
    });

    it('should create new conversation if none exists', async () => {
      const mockNewConversation = {
        id: 'conv-new',
        userId: 'user-123',
        status: AiConversationStatus.ACTIVE,
      };

      mockPrismaService.aiConversation.findFirst.mockResolvedValue(null);
      mockPrismaService.aiConversation.create.mockResolvedValue(mockNewConversation);

      const result = await service.getOrCreateActiveConversation('user-123');

      expect(result).toEqual(mockNewConversation);
      expect(mockPrismaService.aiConversation.create).toHaveBeenCalled();
    });
  });

  describe('cleanupExpiredConversations', () => {
    it('should expire old conversations', async () => {
      mockPrismaService.aiConversation.updateMany.mockResolvedValue({ count: 5 });

      const result = await service.cleanupExpiredConversations();

      expect(result).toBe(5);
      expect(mockPrismaService.aiConversation.updateMany).toHaveBeenCalledWith({
        where: {
          status: AiConversationStatus.ACTIVE,
          expiresAt: { lt: expect.any(Date) },
        },
        data: {
          status: AiConversationStatus.EXPIRED,
        },
      });
    });
  });
});
