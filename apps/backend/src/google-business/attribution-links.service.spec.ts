import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AttributionLinksService } from './attribution-links.service';
import { PrismaService } from '../prisma/prisma.service';
import { AttributionLinkType, DemandEventSource, DemandActionType, DemandPeriodType } from '@prisma/client';

describe('AttributionLinksService', () => {
  let service: AttributionLinksService;
  let prismaService: PrismaService;

  const mockUserId = 'user-123';

  const mockLink = {
    id: 'link-123',
    userId: mockUserId,
    slug: 'abc12345',
    type: AttributionLinkType.WHATSAPP,
    targetUrl: 'https://wa.me/5511999999999',
    clickCount: 10,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    attributionLink: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    demandEvent: {
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: string) => {
      if (key === 'APP_URL') return 'https://app.example.com';
      return defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttributionLinksService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AttributionLinksService>(AttributionLinksService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a WhatsApp attribution link', async () => {
      mockPrismaService.attributionLink.findUnique.mockResolvedValue(null);
      mockPrismaService.attributionLink.create.mockResolvedValue(mockLink);

      const result = await service.create(mockUserId, {
        type: AttributionLinkType.WHATSAPP,
        targetUrl: 'https://wa.me/5511999999999',
      });

      expect(result.type).toBe(AttributionLinkType.WHATSAPP);
      expect(result.trackingUrl).toContain('https://app.example.com/t/');
      expect(mockPrismaService.attributionLink.create).toHaveBeenCalled();
    });

    it('should create a website attribution link', async () => {
      const websiteLink = {
        ...mockLink,
        type: AttributionLinkType.WEBSITE,
        targetUrl: 'https://example.com',
      };
      mockPrismaService.attributionLink.findUnique.mockResolvedValue(null);
      mockPrismaService.attributionLink.create.mockResolvedValue(websiteLink);

      const result = await service.create(mockUserId, {
        type: AttributionLinkType.WEBSITE,
        targetUrl: 'https://example.com',
      });

      expect(result.type).toBe(AttributionLinkType.WEBSITE);
    });

    it('should reject invalid WhatsApp URL', async () => {
      await expect(
        service.create(mockUserId, {
          type: AttributionLinkType.WHATSAPP,
          targetUrl: 'https://google.com',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject website URL without protocol', async () => {
      await expect(
        service.create(mockUserId, {
          type: AttributionLinkType.WEBSITE,
          targetUrl: 'example.com',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException for duplicate custom slug', async () => {
      mockPrismaService.attributionLink.findUnique.mockResolvedValue(mockLink);

      await expect(
        service.create(mockUserId, {
          type: AttributionLinkType.WHATSAPP,
          targetUrl: 'https://wa.me/5511999999999',
          customSlug: 'my-link',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return all links for user with tracking URLs', async () => {
      mockPrismaService.attributionLink.findMany.mockResolvedValue([mockLink]);

      const result = await service.findAll(mockUserId);

      expect(result).toHaveLength(1);
      expect(result[0].trackingUrl).toBe(`https://app.example.com/t/${mockLink.slug}`);
    });
  });

  describe('findOne', () => {
    it('should return link by ID', async () => {
      mockPrismaService.attributionLink.findFirst.mockResolvedValue(mockLink);

      const result = await service.findOne(mockUserId, mockLink.id);

      expect(result.id).toBe(mockLink.id);
      expect(result.trackingUrl).toBeDefined();
    });

    it('should throw NotFoundException when link not found', async () => {
      mockPrismaService.attributionLink.findFirst.mockResolvedValue(null);

      await expect(service.findOne(mockUserId, 'non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update link properties', async () => {
      const updatedLink = { ...mockLink, targetUrl: 'https://wa.me/5511888888888' };
      mockPrismaService.attributionLink.findFirst.mockResolvedValue(mockLink);
      mockPrismaService.attributionLink.update.mockResolvedValue(updatedLink);

      const result = await service.update(mockUserId, mockLink.id, {
        targetUrl: 'https://wa.me/5511888888888',
      });

      expect(result.targetUrl).toBe('https://wa.me/5511888888888');
    });

    it('should throw NotFoundException when link not found', async () => {
      mockPrismaService.attributionLink.findFirst.mockResolvedValue(null);

      await expect(
        service.update(mockUserId, 'non-existent', { isActive: false }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete link', async () => {
      mockPrismaService.attributionLink.findFirst.mockResolvedValue(mockLink);
      mockPrismaService.attributionLink.delete.mockResolvedValue(mockLink);

      await expect(service.delete(mockUserId, mockLink.id)).resolves.toBeUndefined();
      expect(mockPrismaService.attributionLink.delete).toHaveBeenCalledWith({
        where: { id: mockLink.id },
      });
    });
  });

  describe('trackClick', () => {
    it('should increment click count and create demand event', async () => {
      mockPrismaService.attributionLink.findUnique.mockResolvedValue(mockLink);
      mockPrismaService.attributionLink.update.mockResolvedValue({
        ...mockLink,
        clickCount: 11,
      });
      mockPrismaService.demandEvent.upsert.mockResolvedValue({});

      const result = await service.trackClick(mockLink.slug);

      expect(result.targetUrl).toBe(mockLink.targetUrl);
      expect(result.type).toBe(mockLink.type);
      expect(mockPrismaService.attributionLink.update).toHaveBeenCalledWith({
        where: { id: mockLink.id },
        data: { clickCount: { increment: 1 } },
      });
      expect(mockPrismaService.demandEvent.upsert).toHaveBeenCalled();
    });

    it('should throw NotFoundException for unknown slug', async () => {
      mockPrismaService.attributionLink.findUnique.mockResolvedValue(null);

      await expect(service.trackClick('unknown')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for inactive link', async () => {
      mockPrismaService.attributionLink.findUnique.mockResolvedValue({
        ...mockLink,
        isActive: false,
      });

      await expect(service.trackClick(mockLink.slug)).rejects.toThrow(BadRequestException);
    });

    it('should pass UTM parameters to demand event', async () => {
      mockPrismaService.attributionLink.findUnique.mockResolvedValue(mockLink);
      mockPrismaService.attributionLink.update.mockResolvedValue(mockLink);
      mockPrismaService.demandEvent.upsert.mockResolvedValue({});

      await service.trackClick(mockLink.slug, {
        source: 'google',
        medium: 'cpc',
        campaign: 'summer_sale',
      });

      expect(mockPrismaService.demandEvent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            dimensions: {
              utm: {
                source: 'google',
                medium: 'cpc',
                campaign: 'summer_sale',
              },
            },
          }),
        }),
      );
    });
  });

  describe('getStats', () => {
    it('should return click statistics', async () => {
      mockPrismaService.attributionLink.findFirst.mockResolvedValue(mockLink);
      mockPrismaService.demandEvent.findMany.mockResolvedValue([
        {
          occurredAt: new Date(),
          value: 5,
        },
      ]);

      const stats = await service.getStats(mockUserId, mockLink.id);

      expect(stats.totalClicks).toBe(mockLink.clickCount);
      expect(stats.dailyClicks).toBeDefined();
    });
  });
});
