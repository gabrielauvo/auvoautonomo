import { Test, TestingModule } from '@nestjs/testing';
import { ToolRegistryService } from '../services/tool-registry.service';
import { AiAuditService } from '../services/ai-audit.service';
import { ITool, ToolMetadata, ToolContext, ToolResult } from '../interfaces/tool.interface';

// Mock enum values since Prisma types may not be available in test
const AiActionType = {
  READ: 'READ',
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  PAYMENT_CREATE: 'PAYMENT_CREATE',
} as const;

const AiAuditCategory = {
  TOOL_CALL: 'TOOL_CALL',
  SECURITY_BLOCK: 'SECURITY_BLOCK',
  RATE_LIMIT: 'RATE_LIMIT',
  PLAN_CREATED: 'PLAN_CREATED',
  PLAN_CONFIRMED: 'PLAN_CONFIRMED',
  PLAN_REJECTED: 'PLAN_REJECTED',
  PLAN_EXECUTED: 'PLAN_EXECUTED',
  ACTION_SUCCESS: 'ACTION_SUCCESS',
  ACTION_FAILED: 'ACTION_FAILED',
} as const;

describe('ToolRegistryService', () => {
  let service: ToolRegistryService;
  let auditService: AiAuditService;

  const mockAuditService = {
    log: jest.fn(),
  };

  // Mock tool for testing
  const createMockTool = (
    name: string,
    actionType: AiActionType = AiActionType.READ,
    options: {
      checkPermission?: boolean;
      validate?: boolean | string;
      executeResult?: ToolResult;
    } = {},
  ): ITool => ({
    metadata: {
      name,
      description: `Mock tool: ${name}`,
      actionType,
      parametersSchema: {},
    },
    checkPermission: jest.fn().mockResolvedValue(options.checkPermission ?? true),
    validate: jest.fn().mockResolvedValue(options.validate ?? true),
    execute: jest.fn().mockResolvedValue(
      options.executeResult ?? {
        success: true,
        data: { result: 'test' },
      },
    ),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ToolRegistryService,
        { provide: AiAuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<ToolRegistryService>(ToolRegistryService);
    auditService = module.get<AiAuditService>(AiAuditService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('registerTool', () => {
    it('should register a tool', () => {
      const tool = createMockTool('test.tool');

      service.registerTool(tool);

      expect(service.getTool('test.tool')).toBe(tool);
    });

    it('should overwrite existing tool with same name', () => {
      const tool1 = createMockTool('test.tool');
      const tool2 = createMockTool('test.tool');

      service.registerTool(tool1);
      service.registerTool(tool2);

      expect(service.getTool('test.tool')).toBe(tool2);
    });
  });

  describe('getTool', () => {
    it('should return registered tool', () => {
      const tool = createMockTool('clients.list');
      service.registerTool(tool);

      expect(service.getTool('clients.list')).toBe(tool);
    });

    it('should return undefined for non-existent tool', () => {
      expect(service.getTool('nonexistent')).toBeUndefined();
    });
  });

  describe('getAllToolMetadata', () => {
    it('should return metadata for all registered tools', () => {
      const tool1 = createMockTool('tool1');
      const tool2 = createMockTool('tool2');

      service.registerTool(tool1);
      service.registerTool(tool2);

      const metadata = service.getAllToolMetadata();

      expect(metadata).toHaveLength(2);
      expect(metadata.map((m) => m.name)).toContain('tool1');
      expect(metadata.map((m) => m.name)).toContain('tool2');
    });
  });

  describe('getAvailableTools', () => {
    it('should return only tools user has permission for', async () => {
      const tool1 = createMockTool('allowed', AiActionType.READ, { checkPermission: true });
      const tool2 = createMockTool('denied', AiActionType.READ, { checkPermission: false });

      service.registerTool(tool1);
      service.registerTool(tool2);

      const context: ToolContext = { userId: 'user-123', conversationId: 'conv-123' };
      const available = await service.getAvailableTools(context);

      expect(available).toHaveLength(1);
      expect(available[0].name).toBe('allowed');
    });
  });

  describe('executeTool', () => {
    it('should execute tool successfully', async () => {
      const tool = createMockTool('test.execute', AiActionType.READ, {
        executeResult: { success: true, data: { id: '123' } },
      });
      service.registerTool(tool);

      const context: ToolContext = { userId: 'user-123', conversationId: 'conv-123' };
      const result = await service.executeTool('test.execute', { param: 'value' }, context);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: '123' });
      expect(tool.execute).toHaveBeenCalledWith({ param: 'value' }, context);
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          category: AiAuditCategory.ACTION_SUCCESS,
          tool: 'test.execute',
          success: true,
        }),
      );
    });

    it('should return error for non-existent tool', async () => {
      const context: ToolContext = { userId: 'user-123', conversationId: 'conv-123' };
      const result = await service.executeTool('nonexistent', {}, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          category: AiAuditCategory.SECURITY_BLOCK,
          action: 'tool_not_found',
        }),
      );
    });

    it('should block execution if permission denied', async () => {
      const tool = createMockTool('secure.tool', AiActionType.CREATE, {
        checkPermission: false,
      });
      service.registerTool(tool);

      const context: ToolContext = { userId: 'user-123', conversationId: 'conv-123' };
      const result = await service.executeTool('secure.tool', {}, context);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Permission denied');
      expect(tool.execute).not.toHaveBeenCalled();
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          category: AiAuditCategory.SECURITY_BLOCK,
          action: 'permission_denied',
        }),
      );
    });

    it('should block execution if validation fails', async () => {
      const tool = createMockTool('validate.tool', AiActionType.CREATE, {
        validate: 'Invalid parameter: name is required',
      });
      service.registerTool(tool);

      const context: ToolContext = { userId: 'user-123', conversationId: 'conv-123' };
      const result = await service.executeTool('validate.tool', {}, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid parameter: name is required');
      expect(tool.execute).not.toHaveBeenCalled();
    });

    it('should handle execution errors gracefully', async () => {
      const tool = createMockTool('error.tool');
      (tool.execute as jest.Mock).mockRejectedValue(new Error('Database connection failed'));
      service.registerTool(tool);

      const context: ToolContext = { userId: 'user-123', conversationId: 'conv-123' };
      const result = await service.executeTool('error.tool', {}, context);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
      expect(mockAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          category: AiAuditCategory.ACTION_FAILED,
          action: 'execute_error',
        }),
      );
    });
  });

  describe('requiresConfirmation', () => {
    it('should return true for write operations', () => {
      const createTool = createMockTool('create.tool', AiActionType.CREATE);
      const updateTool = createMockTool('update.tool', AiActionType.UPDATE);
      const deleteTool = createMockTool('delete.tool', AiActionType.DELETE);
      const paymentTool = createMockTool('payment.tool', AiActionType.PAYMENT_CREATE);

      service.registerTool(createTool);
      service.registerTool(updateTool);
      service.registerTool(deleteTool);
      service.registerTool(paymentTool);

      expect(service.requiresConfirmation('create.tool')).toBe(true);
      expect(service.requiresConfirmation('update.tool')).toBe(true);
      expect(service.requiresConfirmation('delete.tool')).toBe(true);
      expect(service.requiresConfirmation('payment.tool')).toBe(true);
    });

    it('should return false for read operations', () => {
      const readTool = createMockTool('read.tool', AiActionType.READ);
      service.registerTool(readTool);

      expect(service.requiresConfirmation('read.tool')).toBe(false);
    });

    it('should return true for unknown tools (safety default)', () => {
      expect(service.requiresConfirmation('unknown.tool')).toBe(true);
    });
  });

  describe('requiresPaymentPreview', () => {
    it('should return true for tools with requiresPaymentPreview', () => {
      const tool: ITool = {
        metadata: {
          name: 'payments.create',
          description: 'Create payment',
          actionType: AiActionType.PAYMENT_CREATE,
          parametersSchema: {},
          requiresPaymentPreview: true,
        },
        checkPermission: jest.fn().mockResolvedValue(true),
        validate: jest.fn().mockResolvedValue(true),
        execute: jest.fn().mockResolvedValue({ success: true }),
      };
      service.registerTool(tool);

      expect(service.requiresPaymentPreview('payments.create')).toBe(true);
    });

    it('should return false for tools without requiresPaymentPreview', () => {
      const tool = createMockTool('clients.create', AiActionType.CREATE);
      service.registerTool(tool);

      expect(service.requiresPaymentPreview('clients.create')).toBe(false);
    });
  });
});
