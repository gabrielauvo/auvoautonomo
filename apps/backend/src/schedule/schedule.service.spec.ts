import { Test, TestingModule } from '@nestjs/testing';
import { ScheduleService } from './schedule.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ScheduleService', () => {
  let service: ScheduleService;
  let prisma: PrismaService;

  const mockPrismaService = {
    workOrder: {
      findMany: jest.fn(),
    },
    quote: {
      findMany: jest.fn(),
    },
  };

  const userId = 'user-123';
  const testDate = '2025-12-11';

  const mockClient = {
    id: 'client-1',
    name: 'João Silva',
    phone: '(11) 99999-9999',
    address: 'Rua das Flores, 123',
    city: 'São Paulo',
    state: 'SP',
  };

  const mockWorkOrder = {
    id: 'wo-1',
    userId,
    title: 'Manutenção de ar condicionado',
    status: 'SCHEDULED',
    scheduledDate: new Date('2025-12-11T00:00:00.000Z'),
    scheduledStartTime: new Date('2025-12-11T09:00:00.000Z'),
    scheduledEndTime: new Date('2025-12-11T11:00:00.000Z'),
    address: 'Rua das Flores, 123',
    totalValue: 350.0,
    client: mockClient,
  };

  const mockQuoteVisit = {
    id: 'quote-1',
    userId,
    status: 'PENDING',
    visitScheduledAt: new Date('2025-12-11T14:00:00.000Z'),
    totalValue: 500.0,
    client: mockClient,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScheduleService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ScheduleService>(ScheduleService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getScheduleByDay', () => {
    it('should return schedule for a specific day with work orders and quote visits', async () => {
      mockPrismaService.workOrder.findMany.mockResolvedValue([mockWorkOrder]);
      mockPrismaService.quote.findMany.mockResolvedValue([mockQuoteVisit]);

      const result = await service.getScheduleByDay(userId, testDate);

      expect(result.date).toBe(testDate);
      expect(result.totalCount).toBe(2);
      expect(result.workOrdersCount).toBe(1);
      expect(result.quoteVisitsCount).toBe(1);
      expect(result.activities).toHaveLength(2);
    });

    it('should return empty schedule when no activities', async () => {
      mockPrismaService.workOrder.findMany.mockResolvedValue([]);
      mockPrismaService.quote.findMany.mockResolvedValue([]);

      const result = await service.getScheduleByDay(userId, testDate);

      expect(result.date).toBe(testDate);
      expect(result.totalCount).toBe(0);
      expect(result.workOrdersCount).toBe(0);
      expect(result.quoteVisitsCount).toBe(0);
      expect(result.activities).toHaveLength(0);
    });

    it('should properly transform work order to activity', async () => {
      mockPrismaService.workOrder.findMany.mockResolvedValue([mockWorkOrder]);
      mockPrismaService.quote.findMany.mockResolvedValue([]);

      const result = await service.getScheduleByDay(userId, testDate);

      const activity = result.activities[0];
      expect(activity.id).toBe('wo-1');
      expect(activity.type).toBe('WORK_ORDER');
      expect(activity.title).toBe('Manutenção de ar condicionado');
      expect(activity.status).toBe('SCHEDULED');
      expect(activity.client.name).toBe('João Silva');
      expect(activity.address).toBe('Rua das Flores, 123');
      expect(activity.totalValue).toBe(350.0);
      expect(activity.durationMinutes).toBe(120); // 2 hours
    });

    it('should properly transform quote visit to activity', async () => {
      mockPrismaService.workOrder.findMany.mockResolvedValue([]);
      mockPrismaService.quote.findMany.mockResolvedValue([mockQuoteVisit]);

      const result = await service.getScheduleByDay(userId, testDate);

      const activity = result.activities[0];
      expect(activity.id).toBe('quote-1');
      expect(activity.type).toBe('QUOTE_VISIT');
      expect(activity.title).toContain('Visita para orçamento');
      expect(activity.client.name).toBe('João Silva');
      expect(activity.totalValue).toBe(500.0);
      expect(activity.durationMinutes).toBe(60); // Default 1h for visits
    });

    it('should sort activities by scheduled start time', async () => {
      const laterWorkOrder = {
        ...mockWorkOrder,
        id: 'wo-2',
        scheduledStartTime: new Date('2025-12-11T16:00:00.000Z'),
      };

      mockPrismaService.workOrder.findMany.mockResolvedValue([
        laterWorkOrder,
        mockWorkOrder,
      ]);
      mockPrismaService.quote.findMany.mockResolvedValue([mockQuoteVisit]);

      const result = await service.getScheduleByDay(userId, testDate);

      // Should be sorted: 09:00 (wo-1), 14:00 (quote-1), 16:00 (wo-2)
      expect(result.activities[0].id).toBe('wo-1');
      expect(result.activities[1].id).toBe('quote-1');
      expect(result.activities[2].id).toBe('wo-2');
    });

    it('should query correct date range', async () => {
      mockPrismaService.workOrder.findMany.mockResolvedValue([]);
      mockPrismaService.quote.findMany.mockResolvedValue([]);

      await service.getScheduleByDay(userId, testDate);

      expect(prisma.workOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId,
            scheduledDate: {
              gte: new Date('2025-12-11T00:00:00.000Z'),
              lte: new Date('2025-12-11T23:59:59.999Z'),
            },
          },
        }),
      );

      expect(prisma.quote.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId,
            visitScheduledAt: {
              gte: new Date('2025-12-11T00:00:00.000Z'),
              lte: new Date('2025-12-11T23:59:59.999Z'),
            },
          },
        }),
      );
    });

    it('should handle work order without scheduled end time', async () => {
      const woWithoutEndTime = {
        ...mockWorkOrder,
        scheduledEndTime: null,
      };

      mockPrismaService.workOrder.findMany.mockResolvedValue([woWithoutEndTime]);
      mockPrismaService.quote.findMany.mockResolvedValue([]);

      const result = await service.getScheduleByDay(userId, testDate);

      expect(result.activities[0].scheduledEnd).toBeUndefined();
      expect(result.activities[0].durationMinutes).toBeUndefined();
    });

    it('should build address from client data for quote visits', async () => {
      mockPrismaService.workOrder.findMany.mockResolvedValue([]);
      mockPrismaService.quote.findMany.mockResolvedValue([mockQuoteVisit]);

      const result = await service.getScheduleByDay(userId, testDate);

      expect(result.activities[0].address).toBe(
        'Rua das Flores, 123, São Paulo, SP',
      );
    });

    it('should handle client without address parts', async () => {
      const quoteWithPartialAddress = {
        ...mockQuoteVisit,
        client: {
          ...mockClient,
          address: null,
          city: 'São Paulo',
          state: null,
        },
      };

      mockPrismaService.workOrder.findMany.mockResolvedValue([]);
      mockPrismaService.quote.findMany.mockResolvedValue([
        quoteWithPartialAddress,
      ]);

      const result = await service.getScheduleByDay(userId, testDate);

      expect(result.activities[0].address).toBe('São Paulo');
    });
  });

  describe('getScheduleByRange', () => {
    it('should return schedule grouped by days', async () => {
      const wo1 = {
        ...mockWorkOrder,
        scheduledDate: new Date('2025-12-11T00:00:00.000Z'),
      };
      const wo2 = {
        ...mockWorkOrder,
        id: 'wo-2',
        scheduledDate: new Date('2025-12-12T00:00:00.000Z'),
        scheduledStartTime: new Date('2025-12-12T10:00:00.000Z'),
      };

      mockPrismaService.workOrder.findMany.mockResolvedValue([wo1, wo2]);
      mockPrismaService.quote.findMany.mockResolvedValue([]);

      const result = await service.getScheduleByRange(
        userId,
        '2025-12-11',
        '2025-12-13',
      );

      expect(Object.keys(result)).toContain('2025-12-11');
      expect(Object.keys(result)).toContain('2025-12-12');
      expect(result['2025-12-11'].workOrdersCount).toBe(1);
      expect(result['2025-12-12'].workOrdersCount).toBe(1);
    });

    it('should return empty object when no activities in range', async () => {
      mockPrismaService.workOrder.findMany.mockResolvedValue([]);
      mockPrismaService.quote.findMany.mockResolvedValue([]);

      const result = await service.getScheduleByRange(
        userId,
        '2025-12-11',
        '2025-12-13',
      );

      expect(result).toEqual({});
    });

    it('should sort activities within each day', async () => {
      const earlyWo = {
        ...mockWorkOrder,
        id: 'wo-early',
        scheduledStartTime: new Date('2025-12-11T08:00:00.000Z'),
      };
      const lateWo = {
        ...mockWorkOrder,
        id: 'wo-late',
        scheduledStartTime: new Date('2025-12-11T17:00:00.000Z'),
      };

      mockPrismaService.workOrder.findMany.mockResolvedValue([lateWo, earlyWo]);
      mockPrismaService.quote.findMany.mockResolvedValue([mockQuoteVisit]);

      const result = await service.getScheduleByRange(
        userId,
        '2025-12-11',
        '2025-12-11',
      );

      const activities = result['2025-12-11'].activities;
      expect(activities[0].id).toBe('wo-early');
      expect(activities[1].id).toBe('quote-1');
      expect(activities[2].id).toBe('wo-late');
    });

    it('should count work orders and quote visits correctly', async () => {
      mockPrismaService.workOrder.findMany.mockResolvedValue([
        mockWorkOrder,
        { ...mockWorkOrder, id: 'wo-2' },
      ]);
      mockPrismaService.quote.findMany.mockResolvedValue([mockQuoteVisit]);

      const result = await service.getScheduleByRange(
        userId,
        '2025-12-11',
        '2025-12-11',
      );

      expect(result['2025-12-11'].totalCount).toBe(3);
      expect(result['2025-12-11'].workOrdersCount).toBe(2);
      expect(result['2025-12-11'].quoteVisitsCount).toBe(1);
    });
  });

  describe('calculateDuration', () => {
    it('should calculate duration correctly', async () => {
      mockPrismaService.workOrder.findMany.mockResolvedValue([mockWorkOrder]);
      mockPrismaService.quote.findMany.mockResolvedValue([]);

      const result = await service.getScheduleByDay(userId, testDate);

      // 09:00 to 11:00 = 120 minutes
      expect(result.activities[0].durationMinutes).toBe(120);
    });

    it('should return undefined when start is null', async () => {
      const woWithoutStart = {
        ...mockWorkOrder,
        scheduledStartTime: null,
      };

      mockPrismaService.workOrder.findMany.mockResolvedValue([woWithoutStart]);
      mockPrismaService.quote.findMany.mockResolvedValue([]);

      const result = await service.getScheduleByDay(userId, testDate);

      expect(result.activities[0].durationMinutes).toBeUndefined();
    });

    it('should return undefined when end is null', async () => {
      const woWithoutEnd = {
        ...mockWorkOrder,
        scheduledEndTime: null,
      };

      mockPrismaService.workOrder.findMany.mockResolvedValue([woWithoutEnd]);
      mockPrismaService.quote.findMany.mockResolvedValue([]);

      const result = await service.getScheduleByDay(userId, testDate);

      expect(result.activities[0].durationMinutes).toBeUndefined();
    });
  });
});
