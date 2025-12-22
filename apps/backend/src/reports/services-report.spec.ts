import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService, ServicesReportData } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';
import { GroupByPeriod } from './dto/report-query.dto';

describe('ReportsService - Services Report', () => {
  let service: ReportsService;
  let prisma: PrismaService;

  const mockUserId = 'user-123';

  const mockWorkOrderType1 = {
    id: 'type-1',
    name: 'Instalação',
    color: '#3B82F6',
  };

  const mockWorkOrderType2 = {
    id: 'type-2',
    name: 'Manutenção',
    color: '#10B981',
  };

  const mockClient1 = {
    id: 'client-1',
    name: 'Cliente A',
  };

  const mockClient2 = {
    id: 'client-2',
    name: 'Cliente B',
  };

  const mockWorkOrders = [
    {
      id: 'wo-1',
      userId: mockUserId,
      clientId: mockClient1.id,
      workOrderTypeId: mockWorkOrderType1.id,
      title: 'Instalação 1',
      status: 'DONE',
      totalValue: 1000,
      isActive: true,
      createdAt: new Date('2025-01-15'),
      client: mockClient1,
      workOrderType: mockWorkOrderType1,
    },
    {
      id: 'wo-2',
      userId: mockUserId,
      clientId: mockClient1.id,
      workOrderTypeId: mockWorkOrderType1.id,
      title: 'Instalação 2',
      status: 'IN_PROGRESS',
      totalValue: 1500,
      isActive: true,
      createdAt: new Date('2025-01-20'),
      client: mockClient1,
      workOrderType: mockWorkOrderType1,
    },
    {
      id: 'wo-3',
      userId: mockUserId,
      clientId: mockClient2.id,
      workOrderTypeId: mockWorkOrderType2.id,
      title: 'Manutenção 1',
      status: 'DONE',
      totalValue: 500,
      isActive: true,
      createdAt: new Date('2025-01-25'),
      client: mockClient2,
      workOrderType: mockWorkOrderType2,
    },
    {
      id: 'wo-4',
      userId: mockUserId,
      clientId: mockClient2.id,
      workOrderTypeId: null,
      title: 'Sem tipo',
      status: 'SCHEDULED',
      totalValue: 200,
      isActive: true,
      createdAt: new Date('2025-01-10'),
      client: mockClient2,
      workOrderType: null,
    },
  ];

  const mockPrismaService = {
    workOrder: {
      findMany: jest.fn(),
    },
    workOrderType: {
      findMany: jest.fn(),
    },
    clientPayment: {
      findMany: jest.fn(),
    },
    client: {
      findMany: jest.fn(),
    },
    quote: {
      findMany: jest.fn(),
    },
    expense: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getServicesReport', () => {
    it('should return services report with correct summary', async () => {
      mockPrismaService.workOrder.findMany.mockResolvedValue(mockWorkOrders);
      mockPrismaService.workOrderType.findMany.mockResolvedValue([
        mockWorkOrderType1,
        mockWorkOrderType2,
      ]);

      const result = await service.getServicesReport(mockUserId, {
        period: 'thisMonth',
        groupBy: GroupByPeriod.MONTH,
      });

      expect(result.summary.totalWorkOrders).toBe(4);
      expect(result.summary.completedWorkOrders).toBe(2); // wo-1 and wo-3 are DONE
      expect(result.summary.typesUsed).toBe(2); // type-1 and type-2 (null não conta)
    });

    it('should group work orders by type correctly', async () => {
      mockPrismaService.workOrder.findMany.mockResolvedValue(mockWorkOrders);
      mockPrismaService.workOrderType.findMany.mockResolvedValue([
        mockWorkOrderType1,
        mockWorkOrderType2,
      ]);

      const result = await service.getServicesReport(mockUserId, {
        period: 'thisMonth',
      });

      // Should have 3 types: Instalação, Manutenção, Sem tipo
      expect(result.workOrdersByType.length).toBe(3);

      // Instalação should have 2 work orders
      const instalacaoType = result.workOrdersByType.find(
        (t) => t.typeName === 'Instalação',
      );
      expect(instalacaoType).toBeDefined();
      expect(instalacaoType?.count).toBe(2);
      expect(instalacaoType?.completedCount).toBe(1);
      expect(instalacaoType?.completionRate).toBe(50);
      expect(instalacaoType?.totalValue).toBe(2500);

      // Manutenção should have 1 work order
      const manutencaoType = result.workOrdersByType.find(
        (t) => t.typeName === 'Manutenção',
      );
      expect(manutencaoType).toBeDefined();
      expect(manutencaoType?.count).toBe(1);
      expect(manutencaoType?.completedCount).toBe(1);
      expect(manutencaoType?.completionRate).toBe(100);

      // Sem tipo should have 1 work order
      const semTipo = result.workOrdersByType.find(
        (t) => t.typeName === 'Sem tipo definido',
      );
      expect(semTipo).toBeDefined();
      expect(semTipo?.count).toBe(1);
      expect(semTipo?.completedCount).toBe(0);
    });

    it('should sort work orders by type by count descending', async () => {
      mockPrismaService.workOrder.findMany.mockResolvedValue(mockWorkOrders);
      mockPrismaService.workOrderType.findMany.mockResolvedValue([
        mockWorkOrderType1,
        mockWorkOrderType2,
      ]);

      const result = await service.getServicesReport(mockUserId, {
        period: 'thisMonth',
      });

      // First should be Instalação (2 WOs), then Manutenção (1), then Sem tipo (1)
      expect(result.workOrdersByType[0].typeName).toBe('Instalação');
      expect(result.workOrdersByType[0].count).toBe(2);
    });

    it('should track top clients by type', async () => {
      mockPrismaService.workOrder.findMany.mockResolvedValue(mockWorkOrders);
      mockPrismaService.workOrderType.findMany.mockResolvedValue([
        mockWorkOrderType1,
        mockWorkOrderType2,
      ]);

      const result = await service.getServicesReport(mockUserId, {
        period: 'thisMonth',
      });

      // Instalação type should have Cliente A with 2 work orders
      const instalacaoClients = result.topClientsByType.find(
        (t) => t.typeName === 'Instalação',
      );
      expect(instalacaoClients).toBeDefined();
      expect(instalacaoClients?.clients.length).toBe(1);
      expect(instalacaoClients?.clients[0].clientName).toBe('Cliente A');
      expect(instalacaoClients?.clients[0].count).toBe(2);
      expect(instalacaoClients?.clients[0].totalValue).toBe(2500);

      // Manutenção type should have Cliente B
      const manutencaoClients = result.topClientsByType.find(
        (t) => t.typeName === 'Manutenção',
      );
      expect(manutencaoClients).toBeDefined();
      expect(manutencaoClients?.clients[0].clientName).toBe('Cliente B');
    });

    it('should return empty arrays when no work orders', async () => {
      mockPrismaService.workOrder.findMany.mockResolvedValue([]);
      mockPrismaService.workOrderType.findMany.mockResolvedValue([
        mockWorkOrderType1,
        mockWorkOrderType2,
      ]);

      const result = await service.getServicesReport(mockUserId, {
        period: 'thisMonth',
      });

      expect(result.summary.totalWorkOrders).toBe(0);
      expect(result.summary.completedWorkOrders).toBe(0);
      expect(result.summary.typesUsed).toBe(0);
      expect(result.workOrdersByType).toEqual([]);
      expect(result.topClientsByType).toEqual([]);
    });

    it('should handle work orders with deleted types', async () => {
      const workOrderWithDeletedType = {
        id: 'wo-5',
        userId: mockUserId,
        clientId: mockClient1.id,
        workOrderTypeId: 'deleted-type-id',
        title: 'WO with deleted type',
        status: 'DONE',
        totalValue: 300,
        isActive: true,
        createdAt: new Date('2025-01-15'),
        client: mockClient1,
        workOrderType: { id: 'deleted-type-id', name: 'Tipo Removido', color: '#9ca3af' },
      };

      mockPrismaService.workOrder.findMany.mockResolvedValue([workOrderWithDeletedType]);
      mockPrismaService.workOrderType.findMany.mockResolvedValue([]); // No active types

      const result = await service.getServicesReport(mockUserId, {
        period: 'thisMonth',
      });

      expect(result.workOrdersByType.length).toBe(1);
      expect(result.workOrdersByType[0].typeName).toBe('Tipo Removido');
    });

    it('should calculate completion rate correctly', async () => {
      const workOrdersWithMixedStatus = [
        { ...mockWorkOrders[0], status: 'DONE' },
        { ...mockWorkOrders[1], status: 'DONE' },
        { ...mockWorkOrders[2], status: 'IN_PROGRESS' },
        { ...mockWorkOrders[3], status: 'SCHEDULED' },
      ];

      mockPrismaService.workOrder.findMany.mockResolvedValue(workOrdersWithMixedStatus);
      mockPrismaService.workOrderType.findMany.mockResolvedValue([
        mockWorkOrderType1,
        mockWorkOrderType2,
      ]);

      const result = await service.getServicesReport(mockUserId, {
        period: 'thisMonth',
      });

      // Instalação: 2 total, 2 completed = 100%
      const instalacao = result.workOrdersByType.find((t) => t.typeName === 'Instalação');
      expect(instalacao?.completionRate).toBe(100);

      // Manutenção: 1 total, 0 completed = 0%
      const manutencao = result.workOrdersByType.find((t) => t.typeName === 'Manutenção');
      expect(manutencao?.completionRate).toBe(0);
    });

    it('should limit top clients to 5 per type', async () => {
      // Create 7 clients for one type
      const manyClientsWorkOrders = Array.from({ length: 7 }, (_, i) => ({
        id: `wo-${i}`,
        userId: mockUserId,
        clientId: `client-${i}`,
        workOrderTypeId: mockWorkOrderType1.id,
        title: `WO ${i}`,
        status: 'DONE',
        totalValue: 100 * (7 - i), // Different values to test sorting
        isActive: true,
        createdAt: new Date('2025-01-15'),
        client: { id: `client-${i}`, name: `Cliente ${i}` },
        workOrderType: mockWorkOrderType1,
      }));

      mockPrismaService.workOrder.findMany.mockResolvedValue(manyClientsWorkOrders);
      mockPrismaService.workOrderType.findMany.mockResolvedValue([mockWorkOrderType1]);

      const result = await service.getServicesReport(mockUserId, {
        period: 'thisMonth',
      });

      const instalacaoClients = result.topClientsByType.find(
        (t) => t.typeName === 'Instalação',
      );
      expect(instalacaoClients?.clients.length).toBe(5);
    });

    it('should include type colors in response', async () => {
      mockPrismaService.workOrder.findMany.mockResolvedValue(mockWorkOrders);
      mockPrismaService.workOrderType.findMany.mockResolvedValue([
        mockWorkOrderType1,
        mockWorkOrderType2,
      ]);

      const result = await service.getServicesReport(mockUserId, {
        period: 'thisMonth',
      });

      const instalacao = result.workOrdersByType.find((t) => t.typeName === 'Instalação');
      expect(instalacao?.typeColor).toBe('#3B82F6');

      const manutencao = result.workOrdersByType.find((t) => t.typeName === 'Manutenção');
      expect(manutencao?.typeColor).toBe('#10B981');

      const semTipo = result.workOrdersByType.find(
        (t) => t.typeName === 'Sem tipo definido',
      );
      expect(semTipo?.typeColor).toBe('#6b7280');
    });
  });
});
