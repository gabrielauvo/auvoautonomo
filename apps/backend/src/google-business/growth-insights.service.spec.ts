import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { GrowthInsightsService } from './growth-insights.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  GrowthInsightType,
  GrowthInsightSeverity,
  GoogleIntegrationStatus,
  QuoteStatus,
} from '@prisma/client';

describe('GrowthInsightsService', () => {
  let service: GrowthInsightsService;
  let prismaService: PrismaService;

  const mockUserId = 'user-123';

  const mockInsight = {
    id: 'insight-123',
    userId: mockUserId,
    type: GrowthInsightType.WEEKLY_SUMMARY,
    severity: GrowthInsightSeverity.INFO,
    title: 'Resumo da semana',
    description: 'Esta semana: 100 impressões, 20 ações',
    recommendations: ['Mantenha o bom trabalho!'],
    metrics: { impressions: 100, actions: 20 },
    isRead: false,
    isDismissed: false,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
  };

  const mockPrismaService = {
    googleIntegration: {
      findMany: jest.fn(),
    },
    demandEvent: {
      groupBy: jest.fn(),
    },
    quote: {
      findMany: jest.fn(),
    },
    growthInsight: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GrowthInsightsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<GrowthInsightsService>(GrowthInsightsService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getActiveInsights', () => {
    it('should return active non-dismissed insights', async () => {
      mockPrismaService.growthInsight.findMany.mockResolvedValue([mockInsight]);

      const result = await service.getActiveInsights(mockUserId);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockInsight.id);
      expect(result[0].type).toBe(mockInsight.type);
      expect(result[0].recommendations).toEqual(mockInsight.recommendations);
    });

    it('should limit to 10 insights', async () => {
      mockPrismaService.growthInsight.findMany.mockResolvedValue([mockInsight]);

      await service.getActiveInsights(mockUserId);

      expect(mockPrismaService.growthInsight.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        }),
      );
    });

    it('should order by read status, severity, and creation date', async () => {
      mockPrismaService.growthInsight.findMany.mockResolvedValue([]);

      await service.getActiveInsights(mockUserId);

      expect(mockPrismaService.growthInsight.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [
            { isRead: 'asc' },
            { severity: 'desc' },
            { createdAt: 'desc' },
          ],
        }),
      );
    });
  });

  describe('markAsRead', () => {
    it('should mark insight as read', async () => {
      mockPrismaService.growthInsight.findFirst.mockResolvedValue(mockInsight);
      mockPrismaService.growthInsight.update.mockResolvedValue({
        ...mockInsight,
        isRead: true,
      });

      await service.markAsRead(mockUserId, mockInsight.id);

      expect(mockPrismaService.growthInsight.update).toHaveBeenCalledWith({
        where: { id: mockInsight.id },
        data: { isRead: true },
      });
    });

    it('should throw NotFoundException when insight not found', async () => {
      mockPrismaService.growthInsight.findFirst.mockResolvedValue(null);

      await expect(service.markAsRead(mockUserId, 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should not allow marking other users insights', async () => {
      mockPrismaService.growthInsight.findFirst.mockResolvedValue(null);

      await expect(service.markAsRead('other-user', mockInsight.id)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('dismiss', () => {
    it('should dismiss insight', async () => {
      mockPrismaService.growthInsight.findFirst.mockResolvedValue(mockInsight);
      mockPrismaService.growthInsight.update.mockResolvedValue({
        ...mockInsight,
        isDismissed: true,
      });

      await service.dismiss(mockUserId, mockInsight.id);

      expect(mockPrismaService.growthInsight.update).toHaveBeenCalledWith({
        where: { id: mockInsight.id },
        data: { isDismissed: true },
      });
    });

    it('should throw NotFoundException when insight not found', async () => {
      mockPrismaService.growthInsight.findFirst.mockResolvedValue(null);

      await expect(service.dismiss(mockUserId, 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getUnreadCount', () => {
    it('should return count of unread insights', async () => {
      mockPrismaService.growthInsight.count.mockResolvedValue(3);

      const count = await service.getUnreadCount(mockUserId);

      expect(count).toBe(3);
      expect(mockPrismaService.growthInsight.count).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          isRead: false,
          isDismissed: false,
          OR: expect.any(Array),
        },
      });
    });
  });

  describe('generateInsights', () => {
    it('should generate insights based on metrics data', async () => {
      // Mock metrics data
      mockPrismaService.demandEvent.groupBy.mockResolvedValue([
        { actionType: 'CALL', _sum: { value: 10 } },
        { actionType: 'ROUTE', _sum: { value: 5 } },
        { actionType: 'WEBSITE_CLICK', _sum: { value: 8 } },
        { actionType: 'WHATSAPP_CLICK', _sum: { value: 12 } },
        { actionType: 'PROFILE_VIEW', _sum: { value: 50 } },
        { actionType: 'SEARCH_IMPRESSION', _sum: { value: 200 } },
      ]);
      mockPrismaService.quote.findMany.mockResolvedValue([
        { status: QuoteStatus.APPROVED },
        { status: QuoteStatus.SENT },
      ]);
      mockPrismaService.growthInsight.findFirst.mockResolvedValue(null);
      mockPrismaService.growthInsight.create.mockResolvedValue(mockInsight);

      await service.generateInsights(mockUserId);

      // Should create weekly summary insight at minimum
      expect(mockPrismaService.growthInsight.create).toHaveBeenCalled();
    });

    it('should not create duplicate insights in same week', async () => {
      mockPrismaService.demandEvent.groupBy.mockResolvedValue([]);
      mockPrismaService.quote.findMany.mockResolvedValue([]);
      // Existing insight found
      mockPrismaService.growthInsight.findFirst.mockResolvedValue(mockInsight);

      await service.generateInsights(mockUserId);

      expect(mockPrismaService.growthInsight.create).not.toHaveBeenCalled();
    });
  });

  describe('generateInsightsForAllUsers', () => {
    it('should generate insights for all connected integrations', async () => {
      mockPrismaService.googleIntegration.findMany.mockResolvedValue([
        { userId: 'user-1' },
        { userId: 'user-2' },
      ]);
      mockPrismaService.demandEvent.groupBy.mockResolvedValue([]);
      mockPrismaService.quote.findMany.mockResolvedValue([]);
      mockPrismaService.growthInsight.findFirst.mockResolvedValue(null);

      await service.generateInsightsForAllUsers();

      expect(mockPrismaService.googleIntegration.findMany).toHaveBeenCalledWith({
        where: { status: GoogleIntegrationStatus.CONNECTED },
        select: { userId: true },
      });
    });
  });
});
