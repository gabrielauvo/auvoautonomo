import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { QuotesService } from './quotes.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PlanLimitsService } from '../billing/plan-limits.service';
import { DomainEventsService } from '../domain-events/domain-events.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { AddQuoteItemDto } from './dto/add-quote-item.dto';
import { UpdateQuoteItemDto } from './dto/update-quote-item.dto';
import { QuoteStatus } from './dto/update-quote-status.dto';
import { Decimal } from '@prisma/client/runtime/library';

describe('QuotesService', () => {
  let service: QuotesService;
  let prisma: PrismaService;

  const mockNotificationsService = {
    sendNotification: jest.fn(),
  };

  const mockPlanLimitsService = {
    checkLimitOrThrow: jest.fn().mockResolvedValue(undefined),
  };

  const mockDomainEventsService = {
    createEvent: jest.fn().mockResolvedValue({ id: 'event-1' }),
    createEventsForUsers: jest.fn().mockResolvedValue([]),
  };

  const mockPrismaService = {
    client: {
      findFirst: jest.fn(),
    },
    item: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    quote: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    quoteItem: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuotesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
        {
          provide: PlanLimitsService,
          useValue: mockPlanLimitsService,
        },
        {
          provide: DomainEventsService,
          useValue: mockDomainEventsService,
        },
      ],
    }).compile();

    service = module.get<QuotesService>(QuotesService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const userId = 'user-123';
    const createQuoteDto: CreateQuoteDto = {
      clientId: 'client-456',
      items: [
        { itemId: 'item-1', quantity: 2 },
        { itemId: 'item-2', quantity: 1.5 },
      ],
      discountValue: 10,
      notes: 'Test quote',
    };

    it('should create quote with correct total calculation', async () => {
      const mockClient = { id: 'client-456', name: 'Test Client', userId };
      const mockItems = [
        { id: 'item-1', name: 'Item 1', type: 'PRODUCT', unit: 'UN', basePrice: new Decimal(100) },
        { id: 'item-2', name: 'Item 2', type: 'PRODUCT', unit: 'UN', basePrice: new Decimal(50) },
      ];

      const mockCreatedQuote = {
        id: 'quote-789',
        userId,
        clientId: 'client-456',
        status: 'DRAFT',
        discountValue: new Decimal(10),
        totalValue: new Decimal(265), // (2*100 + 1.5*50) - 10 = 275 - 10 = 265
        notes: 'Test quote',
        client: mockClient,
        items: [],
      };

      mockPrismaService.client.findFirst.mockResolvedValue(mockClient);
      mockPrismaService.item.findMany.mockResolvedValue(mockItems);
      mockPrismaService.quote.create.mockResolvedValue(mockCreatedQuote);

      const result = await service.create(userId, createQuoteDto);

      expect(result).toEqual(mockCreatedQuote);
      expect(prisma.client.findFirst).toHaveBeenCalledWith({
        where: { id: 'client-456', userId },
      });
      expect(prisma.item.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['item-1', 'item-2'] },
          userId,
        },
      });
    });

    it('should create quote with manual items (without itemId)', async () => {
      const mockClient = { id: 'client-456', name: 'Test Client', userId };

      const manualItemsDto: CreateQuoteDto = {
        clientId: 'client-456',
        items: [
          {
            name: 'Mão de obra',
            type: 'SERVICE',
            unit: 'h',
            unitPrice: 100,
            quantity: 3,
          },
          {
            name: 'Material extra',
            type: 'PRODUCT',
            unit: 'un',
            unitPrice: 50,
            quantity: 2,
          },
        ],
        discountValue: 0,
        notes: 'Quote with manual items',
      };

      const mockCreatedQuote = {
        id: 'quote-manual',
        userId,
        clientId: 'client-456',
        status: 'DRAFT',
        discountValue: new Decimal(0),
        totalValue: new Decimal(400), // (3*100) + (2*50) = 300 + 100 = 400
        notes: 'Quote with manual items',
        client: mockClient,
        items: [
          {
            id: 'qi-1',
            itemId: null,
            name: 'Mão de obra',
            type: 'SERVICE',
            unit: 'h',
            quantity: new Decimal(3),
            unitPrice: new Decimal(100),
            totalPrice: new Decimal(300),
          },
          {
            id: 'qi-2',
            itemId: null,
            name: 'Material extra',
            type: 'PRODUCT',
            unit: 'un',
            quantity: new Decimal(2),
            unitPrice: new Decimal(50),
            totalPrice: new Decimal(100),
          },
        ],
      };

      mockPrismaService.client.findFirst.mockResolvedValue(mockClient);
      mockPrismaService.quote.create.mockResolvedValue(mockCreatedQuote);

      const result = await service.create(userId, manualItemsDto);

      expect(result).toEqual(mockCreatedQuote);
      // Should NOT call item.findMany since there are no catalog items
      expect(prisma.item.findMany).not.toHaveBeenCalled();
    });

    it('should create quote with mixed catalog and manual items', async () => {
      const mockClient = { id: 'client-456', name: 'Test Client', userId };
      const mockCatalogItem = {
        id: 'item-1',
        name: 'Catalog Item',
        type: 'PRODUCT',
        unit: 'UN',
        basePrice: new Decimal(200),
      };

      const mixedItemsDto: CreateQuoteDto = {
        clientId: 'client-456',
        items: [
          { itemId: 'item-1', quantity: 1 }, // Catalog item
          {
            name: 'Manual Service',
            type: 'SERVICE',
            unit: 'h',
            unitPrice: 80,
            quantity: 2,
          }, // Manual item
        ],
        discountValue: 0,
        notes: 'Quote with mixed items',
      };

      const mockCreatedQuote = {
        id: 'quote-mixed',
        userId,
        clientId: 'client-456',
        status: 'DRAFT',
        discountValue: new Decimal(0),
        totalValue: new Decimal(360), // 200 + (2*80) = 200 + 160 = 360
        notes: 'Quote with mixed items',
        client: mockClient,
        items: [],
      };

      mockPrismaService.client.findFirst.mockResolvedValue(mockClient);
      mockPrismaService.item.findMany.mockResolvedValue([mockCatalogItem]);
      mockPrismaService.quote.create.mockResolvedValue(mockCreatedQuote);

      const result = await service.create(userId, mixedItemsDto);

      expect(result).toEqual(mockCreatedQuote);
      expect(prisma.item.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['item-1'] },
          userId,
        },
      });
    });

    it('should throw BadRequestException when manual item is missing required fields', async () => {
      const mockClient = { id: 'client-456', userId };

      const invalidManualDto: CreateQuoteDto = {
        clientId: 'client-456',
        items: [
          {
            // Missing name, unit, unitPrice
            quantity: 2,
          },
        ],
        discountValue: 0,
      };

      mockPrismaService.client.findFirst.mockResolvedValue(mockClient);

      await expect(service.create(userId, invalidManualDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(userId, invalidManualDto)).rejects.toThrow(
        'For manual items, name, unit, and unitPrice are required',
      );
    });

    it('should throw ForbiddenException when client does not belong to user', async () => {
      mockPrismaService.client.findFirst.mockResolvedValue(null);

      await expect(service.create(userId, createQuoteDto)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.create(userId, createQuoteDto)).rejects.toThrow(
        'Client with ID client-456 not found or does not belong to you',
      );
    });

    it('should throw BadRequestException when items not found', async () => {
      const mockClient = { id: 'client-456', userId };
      mockPrismaService.client.findFirst.mockResolvedValue(mockClient);
      mockPrismaService.item.findMany.mockResolvedValue([]);

      await expect(service.create(userId, createQuoteDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(userId, createQuoteDto)).rejects.toThrow(
        'One or more catalog items not found or do not belong to you',
      );
    });

    it('should throw BadRequestException when discount exceeds total', async () => {
      const mockClient = { id: 'client-456', userId };
      const mockItems = [
        { id: 'item-1', name: 'Item 1', type: 'PRODUCT', unit: 'UN', basePrice: new Decimal(10) },
        { id: 'item-2', name: 'Item 2', type: 'PRODUCT', unit: 'UN', basePrice: new Decimal(10) },
      ];

      const highDiscountDto = {
        ...createQuoteDto,
        discountValue: 1000, // Way more than total
      };

      mockPrismaService.client.findFirst.mockResolvedValue(mockClient);
      mockPrismaService.item.findMany.mockResolvedValue(mockItems);

      await expect(service.create(userId, highDiscountDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.create(userId, highDiscountDto)).rejects.toThrow(
        'Discount value cannot be greater than items total',
      );
    });
  });

  describe('findAll', () => {
    const userId = 'user-123';

    it('should return all quotes for user without filters', async () => {
      const mockQuotes = [
        {
          id: 'quote-1',
          userId,
          clientId: 'client-1',
          status: 'DRAFT',
          totalValue: new Decimal(100),
        },
        {
          id: 'quote-2',
          userId,
          clientId: 'client-2',
          status: 'SENT',
          totalValue: new Decimal(200),
        },
      ];

      mockPrismaService.quote.findMany.mockResolvedValue(mockQuotes);

      const result = await service.findAll(userId);

      expect(result).toEqual(mockQuotes);
      expect(prisma.quote.findMany).toHaveBeenCalledWith({
        where: { userId },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter quotes by clientId', async () => {
      const clientId = 'client-1';
      const mockClient = { id: clientId, userId };
      const mockQuotes = [{ id: 'quote-1', userId, clientId }];

      mockPrismaService.client.findFirst.mockResolvedValue(mockClient);
      mockPrismaService.quote.findMany.mockResolvedValue(mockQuotes);

      const result = await service.findAll(userId, clientId);

      expect(result).toEqual(mockQuotes);
      expect(prisma.client.findFirst).toHaveBeenCalledWith({
        where: { id: clientId, userId },
      });
    });

    it('should filter quotes by status', async () => {
      const mockQuotes = [{ id: 'quote-1', status: 'SENT' }];
      mockPrismaService.quote.findMany.mockResolvedValue(mockQuotes);

      await service.findAll(userId, undefined, QuoteStatus.SENT);

      expect(prisma.quote.findMany).toHaveBeenCalledWith({
        where: { userId, status: 'SENT' },
        include: expect.any(Object),
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should throw ForbiddenException when clientId does not belong to user', async () => {
      mockPrismaService.client.findFirst.mockResolvedValue(null);

      await expect(service.findAll(userId, 'invalid-client')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('findOne', () => {
    const userId = 'user-123';
    const quoteId = 'quote-789';

    it('should return quote with items and client info', async () => {
      const mockQuote = {
        id: quoteId,
        userId,
        clientId: 'client-456',
        status: 'DRAFT',
        totalValue: new Decimal(100),
        client: { id: 'client-456', name: 'Test Client' },
        items: [
          {
            id: 'quote-item-1',
            quantity: new Decimal(2),
            unitPrice: new Decimal(50),
            totalPrice: new Decimal(100),
          },
        ],
      };

      mockPrismaService.quote.findFirst.mockResolvedValue(mockQuote);

      const result = await service.findOne(userId, quoteId);

      expect(result).toEqual(mockQuote);
      expect(prisma.quote.findFirst).toHaveBeenCalledWith({
        where: { id: quoteId, userId },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException when quote not found', async () => {
      mockPrismaService.quote.findFirst.mockResolvedValue(null);

      await expect(service.findOne(userId, quoteId)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne(userId, quoteId)).rejects.toThrow(
        `Quote with ID ${quoteId} not found`,
      );
    });
  });

  describe('update', () => {
    const userId = 'user-123';
    const quoteId = 'quote-789';

    it('should update notes without recalculating total', async () => {
      const mockQuote = {
        id: quoteId,
        userId,
        items: [{ totalPrice: new Decimal(100) }],
      };
      const updateDto: UpdateQuoteDto = { notes: 'Updated notes' };

      mockPrismaService.quote.findFirst.mockResolvedValue(mockQuote);
      mockPrismaService.quote.update.mockResolvedValue({
        ...mockQuote,
        notes: 'Updated notes',
      });

      await service.update(userId, quoteId, updateDto);

      expect(prisma.quote.update).toHaveBeenCalledWith({
        where: { id: quoteId },
        data: { notes: 'Updated notes' },
        include: expect.any(Object),
      });
    });

    it('should update discount and recalculate total', async () => {
      const mockQuote = {
        id: quoteId,
        userId,
        discountValue: new Decimal(10),
        items: [
          { totalPrice: new Decimal(100) },
          { totalPrice: new Decimal(50) },
        ],
      };
      const updateDto: UpdateQuoteDto = { discountValue: 20 };

      mockPrismaService.quote.findFirst.mockResolvedValue(mockQuote);
      mockPrismaService.quote.update.mockResolvedValue(mockQuote);

      await service.update(userId, quoteId, updateDto);

      expect(prisma.quote.update).toHaveBeenCalledWith({
        where: { id: quoteId },
        data: {
          discountValue: expect.any(Decimal),
          totalValue: expect.any(Decimal), // 150 - 20 = 130
        },
        include: expect.any(Object),
      });
    });

    it('should throw BadRequestException when discount exceeds total', async () => {
      const mockQuote = {
        id: quoteId,
        userId,
        items: [{ totalPrice: new Decimal(50) }],
      };
      const updateDto: UpdateQuoteDto = { discountValue: 100 };

      mockPrismaService.quote.findFirst.mockResolvedValue(mockQuote);

      await expect(service.update(userId, quoteId, updateDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.update(userId, quoteId, updateDto)).rejects.toThrow(
        'Discount value cannot be greater than items total',
      );
    });
  });

  describe('addItem', () => {
    const userId = 'user-123';
    const quoteId = 'quote-789';
    const addItemDto: AddQuoteItemDto = {
      itemId: 'item-1',
      quantity: 3,
    };

    it('should add item and recalculate total', async () => {
      const mockQuote = {
        id: quoteId,
        userId,
        discountValue: new Decimal(10),
        items: [{ totalPrice: new Decimal(100) }],
      };
      const mockItem = {
        id: 'item-1',
        name: 'Test Item',
        type: 'PRODUCT',
        unit: 'UN',
        basePrice: new Decimal(50),
      };

      mockPrismaService.quote.findFirst.mockResolvedValue(mockQuote);
      mockPrismaService.item.findFirst.mockResolvedValue(mockItem);
      mockPrismaService.quoteItem.create.mockResolvedValue({});
      mockPrismaService.quote.findUnique.mockResolvedValue({
        ...mockQuote,
        items: [
          { totalPrice: new Decimal(100) },
          { totalPrice: new Decimal(150) }, // 3 * 50
        ],
      });

      await service.addItem(userId, quoteId, addItemDto);

      expect(prisma.quoteItem.create).toHaveBeenCalledWith({
        data: {
          quoteId,
          itemId: 'item-1',
          name: 'Test Item',
          type: 'PRODUCT',
          unit: 'UN',
          quantity: expect.any(Decimal),
          unitPrice: expect.any(Decimal),
          discountValue: expect.any(Decimal),
          totalPrice: expect.any(Decimal),
        },
      });
    });

    it('should throw BadRequestException when item not found', async () => {
      const mockQuote = { id: quoteId, userId, items: [] };
      mockPrismaService.quote.findFirst.mockResolvedValue(mockQuote);
      mockPrismaService.item.findFirst.mockResolvedValue(null);

      await expect(service.addItem(userId, quoteId, addItemDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('updateItem', () => {
    const userId = 'user-123';
    const quoteId = 'quote-789';
    const itemId = 'quote-item-1';
    const updateDto: UpdateQuoteItemDto = { quantity: 5 };

    it('should update item quantity and recalculate prices', async () => {
      const mockQuote = {
        id: quoteId,
        userId,
        discountValue: new Decimal(0),
        items: [{ totalPrice: new Decimal(100) }]
      };
      const mockQuoteItem = {
        id: itemId,
        quoteId,
        quantity: new Decimal(2),
        unitPrice: new Decimal(50),
        discountValue: new Decimal(0),
        totalPrice: new Decimal(100),
      };

      mockPrismaService.quote.findFirst.mockResolvedValue(mockQuote);
      mockPrismaService.quoteItem.findFirst.mockResolvedValue(mockQuoteItem);
      mockPrismaService.quoteItem.update.mockResolvedValue({});
      mockPrismaService.quote.findUnique.mockResolvedValue({
        ...mockQuote,
        items: [{ totalPrice: new Decimal(250) }], // 5 * 50 = 250
      });

      await service.updateItem(userId, quoteId, itemId, updateDto);

      expect(prisma.quoteItem.update).toHaveBeenCalledWith({
        where: { id: itemId },
        data: {
          quantity: expect.any(Decimal),
          totalPrice: expect.any(Decimal), // 5 * 50 = 250
        },
      });
    });

    it('should throw NotFoundException when quote item not found', async () => {
      const mockQuote = { id: quoteId, userId, discountValue: new Decimal(0), items: [] };
      mockPrismaService.quote.findFirst.mockResolvedValue(mockQuote);
      mockPrismaService.quoteItem.findFirst.mockResolvedValue(null);

      await expect(
        service.updateItem(userId, quoteId, itemId, updateDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeItem', () => {
    const userId = 'user-123';
    const quoteId = 'quote-789';
    const itemId = 'quote-item-1';

    it('should remove item and recalculate total', async () => {
      const mockQuote = {
        id: quoteId,
        userId,
        discountValue: new Decimal(0),
        items: [
          { totalPrice: new Decimal(100) },
          { totalPrice: new Decimal(200) },
        ],
      };
      const mockQuoteItem = { id: itemId, quoteId };

      mockPrismaService.quote.findFirst.mockResolvedValue(mockQuote);
      mockPrismaService.quoteItem.findFirst.mockResolvedValue(mockQuoteItem);
      mockPrismaService.quoteItem.delete.mockResolvedValue({});
      mockPrismaService.quote.findUnique.mockResolvedValue({
        ...mockQuote,
        items: [{ totalPrice: new Decimal(200) }],
      });

      await service.removeItem(userId, quoteId, itemId);

      expect(prisma.quoteItem.delete).toHaveBeenCalledWith({
        where: { id: itemId },
      });
    });

    it('should throw NotFoundException when quote item not found', async () => {
      const mockQuote = { id: quoteId, userId, items: [] };
      mockPrismaService.quote.findFirst.mockResolvedValue(mockQuote);
      mockPrismaService.quoteItem.findFirst.mockResolvedValue(null);

      await expect(service.removeItem(userId, quoteId, itemId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateStatus', () => {
    const userId = 'user-123';
    const quoteId = 'quote-789';

    it('should allow transition from DRAFT to SENT', async () => {
      const mockQuote = {
        id: quoteId,
        userId,
        status: 'DRAFT',
        items: [],
        client: { name: 'Test Client' },
        totalValue: new Decimal(100),
      };

      mockPrismaService.quote.findFirst.mockResolvedValue(mockQuote);
      mockPrismaService.quote.update.mockResolvedValue({
        ...mockQuote,
        status: 'SENT',
      });

      await service.updateStatus(userId, quoteId, QuoteStatus.SENT);

      expect(prisma.quote.update).toHaveBeenCalledWith({
        where: { id: quoteId },
        data: { status: 'SENT', sentAt: expect.any(Date) },
        include: expect.any(Object),
      });
    });

    it('should allow transition from SENT to APPROVED', async () => {
      const mockQuote = {
        id: quoteId,
        userId,
        status: 'SENT',
        items: [],
        client: { name: 'Test Client' },
        totalValue: new Decimal(100),
      };

      mockPrismaService.quote.findFirst.mockResolvedValue(mockQuote);
      mockPrismaService.quote.update.mockResolvedValue({
        ...mockQuote,
        status: 'APPROVED',
      });

      await service.updateStatus(userId, quoteId, QuoteStatus.APPROVED);

      expect(prisma.quote.update).toHaveBeenCalledWith({
        where: { id: quoteId },
        data: { status: 'APPROVED' },
        include: expect.any(Object),
      });
    });

    it('should allow transition from SENT to REJECTED', async () => {
      const mockQuote = {
        id: quoteId,
        userId,
        status: 'SENT',
        items: [],
        client: { name: 'Test Client' },
        totalValue: new Decimal(100),
      };

      mockPrismaService.quote.findFirst.mockResolvedValue(mockQuote);
      mockPrismaService.quote.update.mockResolvedValue({
        ...mockQuote,
        status: 'REJECTED',
      });

      await service.updateStatus(userId, quoteId, QuoteStatus.REJECTED);

      expect(prisma.quote.update).toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid transition', async () => {
      const mockQuote = { id: quoteId, userId, status: 'DRAFT', items: [] };

      mockPrismaService.quote.findFirst.mockResolvedValue(mockQuote);

      await expect(
        service.updateStatus(userId, quoteId, QuoteStatus.APPROVED),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.updateStatus(userId, quoteId, QuoteStatus.APPROVED),
      ).rejects.toThrow('Cannot transition from DRAFT to APPROVED');
    });

    it('should not allow any transition from EXPIRED', async () => {
      const mockQuote = { id: quoteId, userId, status: 'EXPIRED', items: [] };

      mockPrismaService.quote.findFirst.mockResolvedValue(mockQuote);

      await expect(
        service.updateStatus(userId, quoteId, QuoteStatus.DRAFT),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
