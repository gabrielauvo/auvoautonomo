import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { PlansService } from './plans.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PlansService', () => {
  let service: PlansService;
  let prisma: PrismaService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
    },
    client: {
      count: jest.fn(),
    },
    quote: {
      count: jest.fn(),
    },
    workOrder: {
      count: jest.fn(),
    },
    invoice: {
      count: jest.fn(),
    },
    plan: {
      findMany: jest.fn(),
    },
  };

  const mockFreePlan = {
    id: 'plan-id',
    type: 'FREE',
    name: 'Free',
    price: 0,
    maxClients: 5,
    maxQuotes: 10,
    maxWorkOrders: 5,
    maxInvoices: 5,
  };

  const mockTeamPlan = {
    id: 'team-plan-id',
    type: 'TEAM',
    name: 'Team',
    price: 99.9,
    maxClients: -1, // unlimited
    maxQuotes: -1,
    maxWorkOrders: -1,
    maxInvoices: -1,
  };

  const mockUserWithPlan = {
    id: 'user-id',
    email: 'test@example.com',
    planId: 'plan-id',
    plan: mockFreePlan,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlansService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<PlansService>(PlansService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getUserPlan', () => {
    it('should return user plan', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUserWithPlan);

      const result = await service.getUserPlan('user-id');

      expect(result).toEqual(mockFreePlan);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-id' },
        include: { plan: true },
      });
    });

    it('should throw ForbiddenException if user has no plan', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        plan: null,
      });

      await expect(service.getUserPlan('user-id')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('checkClientLimit', () => {
    it('should pass if limit not reached', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUserWithPlan);
      mockPrismaService.client.count.mockResolvedValue(3); // < 5

      await expect(
        service.checkClientLimit('user-id'),
      ).resolves.not.toThrow();
    });

    it('should throw ForbiddenException when limit reached', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUserWithPlan);
      mockPrismaService.client.count.mockResolvedValue(5); // >= 5

      await expect(service.checkClientLimit('user-id')).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.checkClientLimit('user-id')).rejects.toThrow(
        'Client limit reached',
      );
    });

    it('should pass if plan has unlimited clients', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUserWithPlan,
        plan: mockTeamPlan,
      });
      mockPrismaService.client.count.mockResolvedValue(100);

      await expect(
        service.checkClientLimit('user-id'),
      ).resolves.not.toThrow();
    });
  });

  describe('checkQuoteLimit', () => {
    it('should pass if limit not reached', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUserWithPlan);
      mockPrismaService.quote.count.mockResolvedValue(8); // < 10

      await expect(service.checkQuoteLimit('user-id')).resolves.not.toThrow();
    });

    it('should throw ForbiddenException when limit reached', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUserWithPlan);
      mockPrismaService.quote.count.mockResolvedValue(10); // >= 10

      await expect(service.checkQuoteLimit('user-id')).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.checkQuoteLimit('user-id')).rejects.toThrow(
        'Quote limit reached',
      );
    });

    it('should pass if plan has unlimited quotes', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUserWithPlan,
        plan: mockTeamPlan,
      });
      mockPrismaService.quote.count.mockResolvedValue(200);

      await expect(service.checkQuoteLimit('user-id')).resolves.not.toThrow();
    });
  });

  describe('checkWorkOrderLimit', () => {
    it('should pass if limit not reached', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUserWithPlan);
      mockPrismaService.workOrder.count.mockResolvedValue(3); // < 5

      await expect(
        service.checkWorkOrderLimit('user-id'),
      ).resolves.not.toThrow();
    });

    it('should throw ForbiddenException when limit reached', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUserWithPlan);
      mockPrismaService.workOrder.count.mockResolvedValue(5); // >= 5

      await expect(service.checkWorkOrderLimit('user-id')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('checkInvoiceLimit', () => {
    it('should pass if limit not reached', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUserWithPlan);
      mockPrismaService.invoice.count.mockResolvedValue(2); // < 5

      await expect(
        service.checkInvoiceLimit('user-id'),
      ).resolves.not.toThrow();
    });

    it('should throw ForbiddenException when limit reached', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUserWithPlan);
      mockPrismaService.invoice.count.mockResolvedValue(5); // >= 5

      await expect(service.checkInvoiceLimit('user-id')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('getCurrentUsage', () => {
    it('should return current usage for all resources', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(mockUserWithPlan);
      mockPrismaService.client.count.mockResolvedValue(3);
      mockPrismaService.quote.count.mockResolvedValue(7);
      mockPrismaService.workOrder.count.mockResolvedValue(2);
      mockPrismaService.invoice.count.mockResolvedValue(1);

      const result = await service.getCurrentUsage('user-id');

      expect(result).toEqual({
        clients: { current: 3, limit: 5, unlimited: false },
        quotes: { current: 7, limit: 10, unlimited: false },
        workOrders: { current: 2, limit: 5, unlimited: false },
        invoices: { current: 1, limit: 5, unlimited: false },
      });
    });

    it('should indicate unlimited for team plan', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        ...mockUserWithPlan,
        plan: mockTeamPlan,
      });
      mockPrismaService.client.count.mockResolvedValue(50);
      mockPrismaService.quote.count.mockResolvedValue(100);
      mockPrismaService.workOrder.count.mockResolvedValue(75);
      mockPrismaService.invoice.count.mockResolvedValue(60);

      const result = await service.getCurrentUsage('user-id');

      expect(result.clients.unlimited).toBe(true);
      expect(result.quotes.unlimited).toBe(true);
      expect(result.workOrders.unlimited).toBe(true);
      expect(result.invoices.unlimited).toBe(true);
    });
  });

  describe('getAllPlans', () => {
    it('should return all plans ordered by price', async () => {
      const mockPlans = [mockFreePlan, mockTeamPlan];
      mockPrismaService.plan.findMany.mockResolvedValue(mockPlans);

      const result = await service.getAllPlans();

      expect(result).toEqual(mockPlans);
      expect(prisma.plan.findMany).toHaveBeenCalledWith({
        orderBy: { price: 'asc' },
      });
    });
  });
});
