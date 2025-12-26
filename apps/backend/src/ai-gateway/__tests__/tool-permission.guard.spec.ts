import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ToolPermissionGuard,
  SubscriptionPlan,
  planHasPermission,
  getPermissionsForPlan,
} from '../guards/tool-permission.guard';
import { ToolPermission } from '../dto/tool-params';
import { TOOL_PERMISSION_KEY } from '../decorators/tool-permission.decorator';

describe('ToolPermissionGuard', () => {
  let guard: ToolPermissionGuard;
  let reflector: Reflector;

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  const createMockExecutionContext = (user?: any): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as unknown as ExecutionContext;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ToolPermissionGuard,
        { provide: Reflector, useValue: mockReflector },
      ],
    }).compile();

    guard = module.get<ToolPermissionGuard>(ToolPermissionGuard);
    reflector = module.get<Reflector>(Reflector);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should allow access when no permission is required', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(undefined);
      const context = createMockExecutionContext({ id: 'user-123' });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should throw ForbiddenException when no user in request', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(ToolPermission.CUSTOMERS_READ);
      const context = createMockExecutionContext(undefined);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('should allow FREE user to access customers:read', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(ToolPermission.CUSTOMERS_READ);
      const context = createMockExecutionContext({
        id: 'user-123',
        subscription: { plan: SubscriptionPlan.FREE },
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should deny FREE user access to billing:read', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(ToolPermission.BILLING_READ);
      const context = createMockExecutionContext({
        id: 'user-123',
        subscription: { plan: SubscriptionPlan.FREE },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('should allow PROFESSIONAL user to access billing:write', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(ToolPermission.BILLING_WRITE);
      const context = createMockExecutionContext({
        id: 'user-123',
        subscription: { plan: SubscriptionPlan.PROFESSIONAL },
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should allow STARTER user to access workOrders:read', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(ToolPermission.WORK_ORDERS_READ);
      const context = createMockExecutionContext({
        id: 'user-123',
        subscription: { plan: SubscriptionPlan.STARTER },
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should deny STARTER user access to billing:read', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(ToolPermission.BILLING_READ);
      const context = createMockExecutionContext({
        id: 'user-123',
        subscription: { plan: SubscriptionPlan.STARTER },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('should default to FREE plan when no subscription', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(ToolPermission.CUSTOMERS_READ);
      const context = createMockExecutionContext({
        id: 'user-123',
        // No subscription
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should deny FREE user (no subscription) access to workOrders', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(ToolPermission.WORK_ORDERS_READ);
      const context = createMockExecutionContext({
        id: 'user-123',
        // No subscription defaults to FREE
      });

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });
  });
});

describe('planHasPermission', () => {
  describe('FREE plan', () => {
    it('should have customers:read', () => {
      expect(planHasPermission(SubscriptionPlan.FREE, ToolPermission.CUSTOMERS_READ)).toBe(true);
    });

    it('should have customers:write', () => {
      expect(planHasPermission(SubscriptionPlan.FREE, ToolPermission.CUSTOMERS_WRITE)).toBe(true);
    });

    it('should have kb:read', () => {
      expect(planHasPermission(SubscriptionPlan.FREE, ToolPermission.KB_READ)).toBe(true);
    });

    it('should NOT have workOrders:read', () => {
      expect(planHasPermission(SubscriptionPlan.FREE, ToolPermission.WORK_ORDERS_READ)).toBe(false);
    });

    it('should NOT have billing:read', () => {
      expect(planHasPermission(SubscriptionPlan.FREE, ToolPermission.BILLING_READ)).toBe(false);
    });
  });

  describe('STARTER plan', () => {
    it('should have customers:read', () => {
      expect(planHasPermission(SubscriptionPlan.STARTER, ToolPermission.CUSTOMERS_READ)).toBe(true);
    });

    it('should have workOrders:read', () => {
      expect(planHasPermission(SubscriptionPlan.STARTER, ToolPermission.WORK_ORDERS_READ)).toBe(true);
    });

    it('should have quotes:write', () => {
      expect(planHasPermission(SubscriptionPlan.STARTER, ToolPermission.QUOTES_WRITE)).toBe(true);
    });

    it('should NOT have billing:read', () => {
      expect(planHasPermission(SubscriptionPlan.STARTER, ToolPermission.BILLING_READ)).toBe(false);
    });
  });

  describe('PROFESSIONAL plan', () => {
    it('should have all permissions', () => {
      expect(planHasPermission(SubscriptionPlan.PROFESSIONAL, ToolPermission.CUSTOMERS_READ)).toBe(true);
      expect(planHasPermission(SubscriptionPlan.PROFESSIONAL, ToolPermission.WORK_ORDERS_WRITE)).toBe(true);
      expect(planHasPermission(SubscriptionPlan.PROFESSIONAL, ToolPermission.BILLING_READ)).toBe(true);
      expect(planHasPermission(SubscriptionPlan.PROFESSIONAL, ToolPermission.BILLING_WRITE)).toBe(true);
    });
  });

  describe('ENTERPRISE plan', () => {
    it('should have all permissions', () => {
      expect(planHasPermission(SubscriptionPlan.ENTERPRISE, ToolPermission.BILLING_WRITE)).toBe(true);
    });
  });
});

describe('getPermissionsForPlan', () => {
  it('should return correct permissions for FREE plan', () => {
    const permissions = getPermissionsForPlan(SubscriptionPlan.FREE);

    expect(permissions).toContain(ToolPermission.CUSTOMERS_READ);
    expect(permissions).toContain(ToolPermission.CUSTOMERS_WRITE);
    expect(permissions).toContain(ToolPermission.KB_READ);
    expect(permissions).not.toContain(ToolPermission.WORK_ORDERS_READ);
    expect(permissions).not.toContain(ToolPermission.BILLING_READ);
  });

  it('should return correct permissions for STARTER plan', () => {
    const permissions = getPermissionsForPlan(SubscriptionPlan.STARTER);

    expect(permissions).toContain(ToolPermission.CUSTOMERS_READ);
    expect(permissions).toContain(ToolPermission.WORK_ORDERS_READ);
    expect(permissions).toContain(ToolPermission.QUOTES_WRITE);
    expect(permissions).not.toContain(ToolPermission.BILLING_READ);
  });

  it('should return all permissions for PROFESSIONAL plan', () => {
    const permissions = getPermissionsForPlan(SubscriptionPlan.PROFESSIONAL);

    expect(permissions).toContain(ToolPermission.CUSTOMERS_READ);
    expect(permissions).toContain(ToolPermission.WORK_ORDERS_READ);
    expect(permissions).toContain(ToolPermission.BILLING_READ);
    expect(permissions).toContain(ToolPermission.BILLING_WRITE);
  });

  it('should return all permissions for ENTERPRISE plan', () => {
    const permissions = getPermissionsForPlan(SubscriptionPlan.ENTERPRISE);

    // Enterprise should have all permissions
    expect(permissions.length).toBeGreaterThanOrEqual(
      getPermissionsForPlan(SubscriptionPlan.PROFESSIONAL).length,
    );
  });
});
