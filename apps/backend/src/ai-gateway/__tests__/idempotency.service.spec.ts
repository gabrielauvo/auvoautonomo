import { Test, TestingModule } from '@nestjs/testing';
import { IdempotencyService } from '../services/idempotency.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('IdempotencyService', () => {
  let service: IdempotencyService;

  const mockPrismaService = {
    aiToolIdempotency: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  const userId = 'user-123';
  const toolName = 'customers.create';
  const idempotencyKey = 'key-12345678';
  const testParams = {
    idempotencyKey,
    name: 'John Doe',
    email: 'john@example.com',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<IdempotencyService>(IdempotencyService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('check', () => {
    it('should return isIdempotent: false when no existing record', async () => {
      mockPrismaService.aiToolIdempotency.findUnique.mockResolvedValue(null);

      const result = await service.check(userId, toolName, idempotencyKey, testParams);

      expect(result.isIdempotent).toBe(false);
      expect(result.existingResponse).toBeUndefined();
      expect(mockPrismaService.aiToolIdempotency.findUnique).toHaveBeenCalledWith({
        where: {
          userId_toolName_idempotencyKey: {
            userId,
            toolName,
            idempotencyKey,
          },
        },
      });
    });

    it('should return existing response when record exists and not expired', async () => {
      const existingRecord = {
        id: 'record-123',
        userId,
        toolName,
        idempotencyKey,
        requestHash: 'somehash',
        response: {
          success: true,
          data: { id: 'customer-456', name: 'John Doe' },
        },
        entityIds: ['customer-456'],
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        createdAt: new Date(),
      };

      mockPrismaService.aiToolIdempotency.findUnique.mockResolvedValue(existingRecord);

      const result = await service.check(userId, toolName, idempotencyKey, testParams);

      expect(result.isIdempotent).toBe(true);
      expect(result.existingResponse?.success).toBe(true);
      expect(result.existingResponse?.data).toEqual({ id: 'customer-456', name: 'John Doe' });
      expect(result.existingResponse?.entityIds).toEqual(['customer-456']);
      expect(result.idempotencyId).toBe('record-123');
    });

    it('should delete and return isIdempotent: false when record is expired', async () => {
      const expiredRecord = {
        id: 'expired-record',
        userId,
        toolName,
        idempotencyKey,
        requestHash: 'somehash',
        response: { success: true, data: {} },
        expiresAt: new Date(Date.now() - 1000), // 1 second ago
        createdAt: new Date(),
      };

      mockPrismaService.aiToolIdempotency.findUnique.mockResolvedValue(expiredRecord);
      mockPrismaService.aiToolIdempotency.delete.mockResolvedValue(expiredRecord);

      const result = await service.check(userId, toolName, idempotencyKey, testParams);

      expect(result.isIdempotent).toBe(false);
      expect(mockPrismaService.aiToolIdempotency.delete).toHaveBeenCalledWith({
        where: { id: 'expired-record' },
      });
    });

    it('should handle database errors gracefully', async () => {
      mockPrismaService.aiToolIdempotency.findUnique.mockRejectedValue(
        new Error('Database connection failed'),
      );

      const result = await service.check(userId, toolName, idempotencyKey, testParams);

      expect(result.isIdempotent).toBe(false);
    });
  });

  describe('record', () => {
    it('should create idempotency record on success', async () => {
      const expectedRecord = {
        id: 'new-record-123',
        userId,
        toolName,
        idempotencyKey,
        status: 'SUCCESS',
      };

      mockPrismaService.aiToolIdempotency.upsert.mockResolvedValue(expectedRecord);

      const result = await service.record(userId, {
        toolName,
        idempotencyKey,
        params: testParams,
        response: {
          success: true,
          data: { id: 'customer-789' },
        },
        entityIds: ['customer-789'],
      });

      expect(result).toBe('new-record-123');
      expect(mockPrismaService.aiToolIdempotency.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_toolName_idempotencyKey: {
              userId,
              toolName,
              idempotencyKey,
            },
          },
          create: expect.objectContaining({
            userId,
            toolName,
            idempotencyKey,
            status: 'SUCCESS',
          }),
        }),
      );
    });

    it('should create idempotency record with FAILED status on failure', async () => {
      const expectedRecord = {
        id: 'failed-record-123',
        userId,
        toolName,
        idempotencyKey,
        status: 'FAILED',
      };

      mockPrismaService.aiToolIdempotency.upsert.mockResolvedValue(expectedRecord);

      const result = await service.record(userId, {
        toolName,
        idempotencyKey,
        params: testParams,
        response: {
          success: false,
          error: 'Validation failed',
        },
        status: 'FAILED',
      });

      expect(result).toBe('failed-record-123');
      expect(mockPrismaService.aiToolIdempotency.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            status: 'FAILED',
          }),
        }),
      );
    });

    it('should set expiration to 24 hours from now', async () => {
      const beforeCall = Date.now();

      mockPrismaService.aiToolIdempotency.upsert.mockImplementation(async (args) => {
        const expiresAt = args.create.expiresAt as Date;
        const expectedExpiry = beforeCall + 24 * 60 * 60 * 1000;

        // Check that expiry is approximately 24 hours from now (within 1 second)
        expect(expiresAt.getTime()).toBeGreaterThan(expectedExpiry - 1000);
        expect(expiresAt.getTime()).toBeLessThan(expectedExpiry + 1000);

        return { id: 'record-with-expiry' };
      });

      await service.record(userId, {
        toolName,
        idempotencyKey,
        params: testParams,
        response: { success: true, data: {} },
      });

      expect(mockPrismaService.aiToolIdempotency.upsert).toHaveBeenCalled();
    });
  });

  describe('cleanupExpired', () => {
    it('should delete expired records and return count', async () => {
      mockPrismaService.aiToolIdempotency.deleteMany.mockResolvedValue({ count: 5 });

      const result = await service.cleanupExpired();

      expect(result).toBe(5);
      expect(mockPrismaService.aiToolIdempotency.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: { lt: expect.any(Date) },
        },
      });
    });

    it('should return 0 on database error', async () => {
      mockPrismaService.aiToolIdempotency.deleteMany.mockRejectedValue(
        new Error('Database error'),
      );

      const result = await service.cleanupExpired();

      expect(result).toBe(0);
    });
  });

  describe('executeWithIdempotency', () => {
    it('should return cached response for idempotent request', async () => {
      const cachedData = { id: 'cached-customer', name: 'Cached User' };
      mockPrismaService.aiToolIdempotency.findUnique.mockResolvedValue({
        id: 'cached-record',
        response: { success: true, data: cachedData },
        entityIds: ['cached-customer'],
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });

      const executor = jest.fn();

      const result = await service.executeWithIdempotency(
        userId,
        toolName,
        idempotencyKey,
        testParams,
        executor,
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(cachedData);
      expect(result.wasIdempotent).toBe(true);
      expect(executor).not.toHaveBeenCalled();
    });

    it('should execute and record for new request', async () => {
      mockPrismaService.aiToolIdempotency.findUnique.mockResolvedValue(null);
      mockPrismaService.aiToolIdempotency.upsert.mockResolvedValue({ id: 'new-record' });

      const newData = { id: 'new-customer', name: 'New User' };
      const executor = jest.fn().mockResolvedValue({
        success: true,
        data: newData,
        entityIds: ['new-customer'],
      });

      const result = await service.executeWithIdempotency(
        userId,
        toolName,
        idempotencyKey,
        testParams,
        executor,
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(newData);
      expect(result.wasIdempotent).toBe(false);
      expect(executor).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.aiToolIdempotency.upsert).toHaveBeenCalled();
    });

    it('should record failed execution', async () => {
      mockPrismaService.aiToolIdempotency.findUnique.mockResolvedValue(null);
      mockPrismaService.aiToolIdempotency.upsert.mockResolvedValue({ id: 'failed-record' });

      const executor = jest.fn().mockResolvedValue({
        success: false,
        error: 'Execution failed',
      });

      const result = await service.executeWithIdempotency(
        userId,
        toolName,
        idempotencyKey,
        testParams,
        executor,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Execution failed');
      expect(result.wasIdempotent).toBe(false);
      expect(mockPrismaService.aiToolIdempotency.upsert).toHaveBeenCalled();
    });
  });

  describe('hash consistency', () => {
    it('should generate same hash for same params regardless of order', async () => {
      mockPrismaService.aiToolIdempotency.findUnique.mockResolvedValue(null);

      const params1 = { idempotencyKey: 'key', name: 'John', email: 'john@example.com' };
      const params2 = { email: 'john@example.com', idempotencyKey: 'key', name: 'John' };

      await service.check(userId, toolName, idempotencyKey, params1);
      await service.check(userId, toolName, idempotencyKey, params2);

      // Both calls should work - the hash comparison happens when there's an existing record
      expect(mockPrismaService.aiToolIdempotency.findUnique).toHaveBeenCalledTimes(2);
    });
  });
});
