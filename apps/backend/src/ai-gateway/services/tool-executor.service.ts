/**
 * Tool Executor Service
 * Executes tools by calling existing business services
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { KbSearchService } from '../../kb/services/kb-search.service';
import {
  ToolContext,
  ToolResult,
  ToolErrorCode,
  ToolPermission,
  // Customers
  CustomersSearchDto,
  CustomersSearchResult,
  CustomersGetDto,
  CustomerDetail,
  CustomersCreateDto,
  CustomerCreateResult,
  // Work Orders
  WorkOrdersSearchDto,
  WorkOrdersSearchResult,
  WorkOrdersGetDto,
  WorkOrderDetail,
  WorkOrdersCreateDto,
  WorkOrderCreateResult,
  // Quotes
  QuotesSearchDto,
  QuotesSearchResult,
  QuotesGetDto,
  QuoteDetail,
  QuotesCreateDto,
  QuoteCreateResult,
  // Billing
  BillingGetChargeDto,
  ChargeDetail,
  BillingSearchChargesDto,
  ChargesSearchResult,
  BillingPreviewChargeDto,
  ChargePreviewResult,
  BillingCreateChargeDto,
  ChargeCreateResult,
  // KB
  KbSearchDto,
  KbSearchResponse,
} from '../dto/tool-params';
import { planHasPermission, SubscriptionPlan } from '../guards/tool-permission.guard';

/**
 * Tool metadata for registration
 */
interface ToolMetadata {
  name: string;
  permission: ToolPermission;
  sideEffects: 'none' | 'write';
  idempotent: boolean;
}

/**
 * All available tools with their metadata
 */
export const TOOLS_METADATA: Record<string, ToolMetadata> = {
  'customers.search': {
    name: 'customers.search',
    permission: ToolPermission.CUSTOMERS_READ,
    sideEffects: 'none',
    idempotent: true,
  },
  'customers.get': {
    name: 'customers.get',
    permission: ToolPermission.CUSTOMERS_READ,
    sideEffects: 'none',
    idempotent: true,
  },
  'customers.create': {
    name: 'customers.create',
    permission: ToolPermission.CUSTOMERS_WRITE,
    sideEffects: 'write',
    idempotent: true,
  },
  'workOrders.search': {
    name: 'workOrders.search',
    permission: ToolPermission.WORK_ORDERS_READ,
    sideEffects: 'none',
    idempotent: true,
  },
  'workOrders.get': {
    name: 'workOrders.get',
    permission: ToolPermission.WORK_ORDERS_READ,
    sideEffects: 'none',
    idempotent: true,
  },
  'workOrders.create': {
    name: 'workOrders.create',
    permission: ToolPermission.WORK_ORDERS_WRITE,
    sideEffects: 'write',
    idempotent: true,
  },
  'quotes.search': {
    name: 'quotes.search',
    permission: ToolPermission.QUOTES_READ,
    sideEffects: 'none',
    idempotent: true,
  },
  'quotes.get': {
    name: 'quotes.get',
    permission: ToolPermission.QUOTES_READ,
    sideEffects: 'none',
    idempotent: true,
  },
  'quotes.create': {
    name: 'quotes.create',
    permission: ToolPermission.QUOTES_WRITE,
    sideEffects: 'write',
    idempotent: true,
  },
  'billing.getCharge': {
    name: 'billing.getCharge',
    permission: ToolPermission.BILLING_READ,
    sideEffects: 'none',
    idempotent: true,
  },
  'billing.searchCharges': {
    name: 'billing.searchCharges',
    permission: ToolPermission.BILLING_READ,
    sideEffects: 'none',
    idempotent: true,
  },
  'billing.previewCharge': {
    name: 'billing.previewCharge',
    permission: ToolPermission.BILLING_READ,
    sideEffects: 'none',
    idempotent: true,
  },
  'billing.createCharge': {
    name: 'billing.createCharge',
    permission: ToolPermission.BILLING_WRITE,
    sideEffects: 'write',
    idempotent: true,
  },
  'kb.search': {
    name: 'kb.search',
    permission: ToolPermission.KB_READ,
    sideEffects: 'none',
    idempotent: true,
  },
};

@Injectable()
export class ToolExecutorService {
  private readonly logger = new Logger(ToolExecutorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kbSearchService: KbSearchService,
  ) {}

  /**
   * Get metadata for a tool
   */
  getToolMetadata(toolName: string): ToolMetadata | undefined {
    return TOOLS_METADATA[toolName];
  }

  /**
   * Get all available tools for a user based on their subscription plan
   */
  getAvailableTools(plan: SubscriptionPlan): ToolMetadata[] {
    return Object.values(TOOLS_METADATA).filter((tool) =>
      planHasPermission(plan, tool.permission),
    );
  }

  /**
   * Check if user has permission to execute a tool
   */
  checkToolPermission(toolName: string, plan: SubscriptionPlan): boolean {
    const metadata = this.getToolMetadata(toolName);
    if (!metadata) return false;
    return planHasPermission(plan, metadata.permission);
  }

  // ==========================================================================
  // CUSTOMERS
  // ==========================================================================

  async customersSearch(
    params: CustomersSearchDto,
    context: ToolContext,
  ): Promise<ToolResult<CustomersSearchResult>> {
    try {
      const { query, hasOverduePayments, limit = 20, offset = 0 } = params;

      const where = {
        userId: context.userId,
        OR: [
          { name: { contains: query, mode: 'insensitive' as const } },
          { email: { contains: query, mode: 'insensitive' as const } },
          { phone: { contains: query } },
        ],
        ...(hasOverduePayments !== undefined && { isDelinquent: hasOverduePayments }),
      };

      const [customers, total] = await Promise.all([
        this.prisma.client.findMany({
          where,
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            city: true,
            isDelinquent: true,
            createdAt: true,
          },
          orderBy: { name: 'asc' },
          take: limit,
          skip: offset,
        }),
        this.prisma.client.count({ where }),
      ]);

      return {
        success: true,
        data: {
          customers,
          items: customers,
          total,
          hasMore: offset + customers.length < total,
          limit,
          offset,
        },
        affectedEntities: customers.map((c) => ({
          type: 'customer' as const,
          id: c.id,
          action: 'read' as const,
        })),
      };
    } catch (error) {
      this.logger.error(`customers.search failed: ${error}`);
      return this.errorResult(ToolErrorCode.INTERNAL_ERROR, 'Failed to search customers');
    }
  }

  async customersGet(
    params: CustomersGetDto,
    context: ToolContext,
  ): Promise<ToolResult<CustomerDetail>> {
    try {
      const customer = await this.prisma.client.findFirst({
        where: {
          id: params.id,
          userId: context.userId,
        },
        include: {
          ...(params.includePayments && {
            payments: {
              select: {
                id: true,
                value: true,
                status: true,
                dueDate: true,
              },
              take: 10,
              orderBy: { dueDate: 'desc' },
            },
          }),
          ...(params.includeWorkOrders && {
            workOrders: {
              select: {
                id: true,
                title: true,
                status: true,
                scheduledDate: true,
              },
              take: 10,
              orderBy: { createdAt: 'desc' },
            },
          }),
          ...(params.includeQuotes && {
            quotes: {
              select: {
                id: true,
                status: true,
                totalValue: true,
              },
              take: 10,
              orderBy: { createdAt: 'desc' },
            },
          }),
        },
      });

      if (!customer) {
        return this.errorResult(ToolErrorCode.ENTITY_NOT_FOUND, 'Customer not found');
      }

      return {
        success: true,
        data: customer as unknown as CustomerDetail,
        affectedEntities: [{ type: 'customer', id: customer.id, action: 'read' }],
      };
    } catch (error) {
      this.logger.error(`customers.get failed: ${error}`);
      return this.errorResult(ToolErrorCode.INTERNAL_ERROR, 'Failed to get customer');
    }
  }

  async customersCreate(
    params: CustomersCreateDto,
    context: ToolContext,
  ): Promise<ToolResult<CustomerCreateResult>> {
    try {
      // Check plan limits
      const canCreate = await this.checkEntityLimit(context.userId, 'clients');
      if (!canCreate) {
        return this.errorResult(
          ToolErrorCode.PLAN_LIMIT_EXCEEDED,
          'You have reached the maximum number of customers for your plan',
        );
      }

      const customer = await this.prisma.client.create({
        data: {
          userId: context.userId,
          name: params.name,
          email: params.email,
          phone: params.phone,
          taxId: params.taxId,
          address: params.address,
          city: params.city,
          state: params.state,
          zipCode: params.zipCode,
          notes: params.notes,
        },
      });

      return {
        success: true,
        data: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          createdAt: customer.createdAt,
        },
        affectedEntities: [{ type: 'customer', id: customer.id, action: 'created' }],
      };
    } catch (error) {
      this.logger.error(`customers.create failed: ${error}`);
      return this.errorResult(ToolErrorCode.INTERNAL_ERROR, 'Failed to create customer');
    }
  }

  // ==========================================================================
  // WORK ORDERS
  // ==========================================================================

  async workOrdersSearch(
    params: WorkOrdersSearchDto,
    context: ToolContext,
  ): Promise<ToolResult<WorkOrdersSearchResult>> {
    try {
      const { customerId, status, scheduledDateFrom, scheduledDateTo, query, limit = 20, offset = 0 } = params;

      const where: any = {
        userId: context.userId,
        ...(customerId && { clientId: customerId }),
        ...(status && { status }),
        ...(scheduledDateFrom || scheduledDateTo
          ? {
              scheduledDate: {
                ...(scheduledDateFrom && { gte: new Date(scheduledDateFrom) }),
                ...(scheduledDateTo && { lte: new Date(scheduledDateTo) }),
              },
            }
          : {}),
        ...(query && {
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
          ],
        }),
      };

      const [workOrders, total] = await Promise.all([
        this.prisma.workOrder.findMany({
          where,
          select: {
            id: true,
            title: true,
            status: true,
            scheduledDate: true,
            totalValue: true,
            client: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        this.prisma.workOrder.count({ where }),
      ]);

      const items = workOrders.map((wo) => ({
        ...wo,
        status: wo.status as any, // Cast to avoid enum mismatch
        totalValue: Number(wo.totalValue),
        customerName: wo.client.name,
      }));

      return {
        success: true,
        data: {
          workOrders: items as any,
          items: items as any,
          total,
          hasMore: offset + workOrders.length < total,
          limit,
          offset,
        },
        affectedEntities: workOrders.map((wo) => ({
          type: 'workOrder' as const,
          id: wo.id,
          action: 'read' as const,
        })),
      };
    } catch (error) {
      this.logger.error(`workOrders.search failed: ${error}`);
      return this.errorResult(ToolErrorCode.INTERNAL_ERROR, 'Failed to search work orders');
    }
  }

  async workOrdersGet(
    params: WorkOrdersGetDto,
    context: ToolContext,
  ): Promise<ToolResult<WorkOrderDetail>> {
    try {
      const workOrder = await this.prisma.workOrder.findFirst({
        where: {
          id: params.id,
          userId: context.userId,
        },
        include: {
          client: { select: { id: true, name: true } },
          items: true,
        },
      });

      if (!workOrder) {
        return this.errorResult(ToolErrorCode.ENTITY_NOT_FOUND, 'Work order not found');
      }

      return {
        success: true,
        data: {
          ...workOrder,
          totalValue: Number(workOrder.totalValue),
          customer: workOrder.client,
          items: workOrder.items.map((item) => ({
            ...item,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            total: Number(item.quantity) * Number(item.unitPrice),
          })),
        } as unknown as WorkOrderDetail,
        affectedEntities: [{ type: 'workOrder', id: workOrder.id, action: 'read' }],
      };
    } catch (error) {
      this.logger.error(`workOrders.get failed: ${error}`);
      return this.errorResult(ToolErrorCode.INTERNAL_ERROR, 'Failed to get work order');
    }
  }

  async workOrdersCreate(
    params: WorkOrdersCreateDto,
    context: ToolContext,
  ): Promise<ToolResult<WorkOrderCreateResult>> {
    try {
      // Verify customer ownership
      const customer = await this.prisma.client.findFirst({
        where: {
          id: params.customerId,
          userId: context.userId,
        },
      });

      if (!customer) {
        return this.errorResult(ToolErrorCode.ENTITY_NOT_FOUND, 'Customer not found');
      }

      // Check plan limits
      const canCreate = await this.checkEntityLimit(context.userId, 'workOrders');
      if (!canCreate) {
        return this.errorResult(
          ToolErrorCode.PLAN_LIMIT_EXCEEDED,
          'You have reached the maximum number of work orders for your plan',
        );
      }

      // Calculate total
      const totalValue = params.items.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0,
      );

      const workOrder = await this.prisma.workOrder.create({
        data: {
          userId: context.userId,
          clientId: params.customerId,
          title: params.title,
          description: params.description,
          scheduledDate: params.scheduledDate ? new Date(params.scheduledDate) : null,
          totalValue,
          status: 'SCHEDULED',
          items: {
            create: params.items.map((item) => ({
              name: item.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.quantity * item.unitPrice,
              itemType: item.type || 'SERVICE',
            })),
          },
        },
        include: { client: { select: { name: true } } },
      });

      return {
        success: true,
        data: {
          id: workOrder.id,
          title: workOrder.title,
          status: workOrder.status as any,
          totalValue: Number(workOrder.totalValue),
          customerName: workOrder.client.name,
          createdAt: workOrder.createdAt,
        },
        affectedEntities: [{ type: 'workOrder', id: workOrder.id, action: 'created' }],
      };
    } catch (error) {
      this.logger.error(`workOrders.create failed: ${error}`);
      return this.errorResult(ToolErrorCode.INTERNAL_ERROR, 'Failed to create work order');
    }
  }

  // ==========================================================================
  // QUOTES
  // ==========================================================================

  async quotesSearch(
    params: QuotesSearchDto,
    context: ToolContext,
  ): Promise<ToolResult<QuotesSearchResult>> {
    try {
      const { customerId, status, query, createdFrom, createdTo, limit = 20, offset = 0 } = params;

      const where: any = {
        userId: context.userId,
        ...(customerId && { clientId: customerId }),
        ...(status && { status }),
        ...(createdFrom || createdTo
          ? {
              createdAt: {
                ...(createdFrom && { gte: new Date(createdFrom) }),
                ...(createdTo && { lte: new Date(createdTo) }),
              },
            }
          : {}),
        ...(query && {
          notes: { contains: query, mode: 'insensitive' },
        }),
      };

      const [quotes, total] = await Promise.all([
        this.prisma.quote.findMany({
          where,
          select: {
            id: true,
            status: true,
            totalValue: true,
            createdAt: true,
            client: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        this.prisma.quote.count({ where }),
      ]);

      const items = quotes.map((q) => ({
        id: q.id,
        title: `Orçamento #${q.id.slice(0, 8)}`,
        status: q.status,
        totalValue: Number(q.totalValue),
        createdAt: q.createdAt,
        customerName: q.client.name,
      }));

      return {
        success: true,
        data: {
          quotes: items as any,
          items: items as any,
          total,
          hasMore: offset + quotes.length < total,
          limit,
          offset,
        },
        affectedEntities: quotes.map((q) => ({
          type: 'quote' as const,
          id: q.id,
          action: 'read' as const,
        })),
      };
    } catch (error) {
      this.logger.error(`quotes.search failed: ${error}`);
      return this.errorResult(ToolErrorCode.INTERNAL_ERROR, 'Failed to search quotes');
    }
  }

  async quotesGet(
    params: QuotesGetDto,
    context: ToolContext,
  ): Promise<ToolResult<QuoteDetail>> {
    try {
      const quote = await this.prisma.quote.findFirst({
        where: {
          id: params.id,
          userId: context.userId,
        },
        include: {
          client: { select: { id: true, name: true } },
          items: true,
        },
      });

      if (!quote) {
        return this.errorResult(ToolErrorCode.ENTITY_NOT_FOUND, 'Quote not found');
      }

      return {
        success: true,
        data: {
          id: quote.id,
          title: `Orçamento #${quote.id.slice(0, 8)}`,
          status: quote.status,
          totalValue: Number(quote.totalValue),
          notes: quote.notes,
          validUntil: quote.validUntil,
          createdAt: quote.createdAt,
          customer: quote.client,
          items: quote.items.map((item) => ({
            id: item.id,
            name: item.name,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            total: Number(item.quantity) * Number(item.unitPrice),
          })),
        } as unknown as QuoteDetail,
        affectedEntities: [{ type: 'quote', id: quote.id, action: 'read' }],
      };
    } catch (error) {
      this.logger.error(`quotes.get failed: ${error}`);
      return this.errorResult(ToolErrorCode.INTERNAL_ERROR, 'Failed to get quote');
    }
  }

  async quotesCreate(
    params: QuotesCreateDto,
    context: ToolContext,
  ): Promise<ToolResult<QuoteCreateResult>> {
    try {
      // Verify customer ownership
      const customer = await this.prisma.client.findFirst({
        where: {
          id: params.customerId,
          userId: context.userId,
        },
      });

      if (!customer) {
        return this.errorResult(ToolErrorCode.ENTITY_NOT_FOUND, 'Customer not found');
      }

      // Check plan limits
      const canCreate = await this.checkEntityLimit(context.userId, 'quotes');
      if (!canCreate) {
        return this.errorResult(
          ToolErrorCode.PLAN_LIMIT_EXCEEDED,
          'You have reached the maximum number of quotes for your plan',
        );
      }

      // Calculate total
      const totalValue = params.items.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0,
      );

      const quote = await this.prisma.quote.create({
        data: {
          userId: context.userId,
          clientId: params.customerId,
          notes: params.description,
          validUntil: params.validUntil ? new Date(params.validUntil) : null,
          totalValue,
          status: 'DRAFT',
          items: {
            create: params.items.map((item) => ({
              name: item.name,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.quantity * item.unitPrice,
              itemType: item.type || 'SERVICE',
            })),
          },
        },
        include: { client: { select: { name: true } } },
      });

      return {
        success: true,
        data: {
          id: quote.id,
          title: `Orçamento #${quote.id.slice(0, 8)}`,
          status: quote.status as any,
          totalValue: Number(quote.totalValue),
          customerName: quote.client.name,
          validUntil: quote.validUntil,
          createdAt: quote.createdAt,
        },
        affectedEntities: [{ type: 'quote', id: quote.id, action: 'created' }],
      };
    } catch (error) {
      this.logger.error(`quotes.create failed: ${error}`);
      return this.errorResult(ToolErrorCode.INTERNAL_ERROR, 'Failed to create quote');
    }
  }

  // ==========================================================================
  // BILLING
  // ==========================================================================

  async billingGetCharge(
    params: BillingGetChargeDto,
    context: ToolContext,
  ): Promise<ToolResult<ChargeDetail>> {
    try {
      const payment = await this.prisma.clientPayment.findFirst({
        where: {
          id: params.id,
          userId: context.userId,
        },
        include: {
          client: { select: { id: true, name: true } },
        },
      });

      if (!payment) {
        return this.errorResult(ToolErrorCode.ENTITY_NOT_FOUND, 'Charge not found');
      }

      return {
        success: true,
        data: {
          id: payment.id,
          externalId: payment.asaasPaymentId,
          status: payment.status as any,
          billingType: payment.billingType as any,
          value: Number(payment.value),
          netValue: null,
          dueDate: payment.dueDate,
          paymentDate: payment.paidAt,
          description: payment.description,
          invoiceUrl: payment.asaasInvoiceUrl,
          pixQrCode: payment.asaasPixCode,
          boletoBarCode: null, // Asaas doesn't store boleto barcode separately
          customer: payment.client,
          createdAt: payment.createdAt,
        },
        affectedEntities: [{ type: 'charge', id: payment.id, action: 'read' }],
      };
    } catch (error) {
      this.logger.error(`billing.getCharge failed: ${error}`);
      return this.errorResult(ToolErrorCode.INTERNAL_ERROR, 'Failed to get charge');
    }
  }

  async billingSearchCharges(
    params: BillingSearchChargesDto,
    context: ToolContext,
  ): Promise<ToolResult<ChargesSearchResult>> {
    try {
      const {
        customerId,
        status,
        billingType,
        dueDateFrom,
        dueDateTo,
        overdueOnly,
        limit = 20,
        offset = 0,
      } = params;

      const now = new Date();
      const where: any = {
        userId: context.userId,
        ...(customerId && { clientId: customerId }),
        ...(status && { status }),
        ...(billingType && { billingType }),
        ...(dueDateFrom || dueDateTo
          ? {
              dueDate: {
                ...(dueDateFrom && { gte: new Date(dueDateFrom) }),
                ...(dueDateTo && { lte: new Date(dueDateTo) }),
              },
            }
          : {}),
        ...(overdueOnly && {
          dueDate: { lt: now },
          status: { in: ['PENDING', 'OVERDUE'] },
        }),
      };

      const [payments, total, aggregate] = await Promise.all([
        this.prisma.clientPayment.findMany({
          where,
          select: {
            id: true,
            status: true,
            billingType: true,
            value: true,
            dueDate: true,
            client: { select: { name: true } },
          },
          orderBy: { dueDate: 'desc' },
          take: limit,
          skip: offset,
        }),
        this.prisma.clientPayment.count({ where }),
        this.prisma.clientPayment.aggregate({
          where,
          _sum: { value: true },
        }),
      ]);

      const items = payments.map((p) => ({
        id: p.id,
        status: p.status as any,
        billingType: p.billingType as any,
        value: Number(p.value),
        dueDate: p.dueDate,
        customerName: p.client.name,
        isOverdue: p.dueDate < now && ['PENDING', 'OVERDUE'].includes(p.status),
      }));

      return {
        success: true,
        data: {
          charges: items,
          items,
          total,
          totalValue: Number(aggregate._sum.value || 0),
          hasMore: offset + payments.length < total,
          limit,
          offset,
        },
        affectedEntities: payments.map((p) => ({
          type: 'charge' as const,
          id: p.id,
          action: 'read' as const,
        })),
      };
    } catch (error) {
      this.logger.error(`billing.searchCharges failed: ${error}`);
      return this.errorResult(ToolErrorCode.INTERNAL_ERROR, 'Failed to search charges');
    }
  }

  async billingPreviewCharge(
    params: BillingPreviewChargeDto,
    context: ToolContext,
  ): Promise<ToolResult<ChargePreviewResult>> {
    try {
      const { customerId, value, billingType, dueDate, description } = params;
      const warnings: string[] = [];
      const errors: string[] = [];

      // Verify customer ownership
      const customer = await this.prisma.client.findFirst({
        where: {
          id: customerId,
          userId: context.userId,
        },
        select: {
          id: true,
          name: true,
          email: true,
          taxId: true,
          asaasCustomerId: true,
        },
      });

      if (!customer) {
        return this.errorResult(ToolErrorCode.ENTITY_NOT_FOUND, 'Customer not found');
      }

      // Check Asaas integration
      const asaasIntegration = await this.prisma.asaasIntegration.findUnique({
        where: { userId: context.userId },
        select: { isActive: true },
      });

      if (!asaasIntegration?.isActive) {
        errors.push('Asaas integration is not active');
      }

      // Validate due date
      const parsedDueDate = new Date(dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (parsedDueDate < today) {
        warnings.push('Due date is in the past');
      }

      if (billingType === 'BOLETO') {
        const minDate = new Date(today);
        minDate.setDate(minDate.getDate() + 1);
        if (parsedDueDate < minDate) {
          warnings.push('Boleto requires at least 1 business day');
        }
      }

      if (billingType === 'CREDIT_CARD' && !customer.email) {
        warnings.push('Credit card charges require customer email');
      }

      // Check if customer has Asaas ID
      const customerHasPaymentProfile = !!customer.asaasCustomerId;
      if (!customerHasPaymentProfile) {
        warnings.push('Customer will be automatically registered in Asaas');
        if (!customer.taxId) {
          warnings.push('Customer CPF/CNPJ is recommended for Asaas registration');
        }
      }

      // Value validations
      if (value < 5) {
        errors.push('Minimum value for Asaas is R$ 5.00');
      }

      if (value > 50000) {
        warnings.push('Values above R$ 50,000 may require additional validation');
      }

      // Create preview record
      const preview = await this.prisma.aiPaymentPreview.create({
        data: {
          planId: context.planId || 'standalone',
          clientId: customerId,
          clientName: customer.name,
          billingType,
          value,
          dueDate: parsedDueDate,
          description: description || null,
          valid: errors.length === 0,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
        },
      });

      return {
        success: true,
        data: {
          previewId: preview.id,
          valid: errors.length === 0,
          preview: {
            customerId: customer.id,
            customerName: customer.name,
            billingType: billingType as any,
            value,
            dueDate: parsedDueDate,
            description: description || null,
          },
          warnings,
          errors,
          customerHasPaymentProfile,
          expiresAt: preview.expiresAt!,
        },
      };
    } catch (error) {
      this.logger.error(`billing.previewCharge failed: ${error}`);
      return this.errorResult(ToolErrorCode.INTERNAL_ERROR, 'Failed to create charge preview');
    }
  }

  async billingCreateCharge(
    params: BillingCreateChargeDto,
    context: ToolContext,
  ): Promise<ToolResult<ChargeCreateResult>> {
    try {
      // Get preview
      const preview = await this.prisma.aiPaymentPreview.findUnique({
        where: { id: params.previewId },
        include: {
          client: {
            select: { id: true, name: true, userId: true },
          },
        },
      });

      if (!preview) {
        return this.errorResult(ToolErrorCode.PREVIEW_REQUIRED, 'Preview not found');
      }

      // Verify ownership
      if (preview.client.userId !== context.userId) {
        return this.errorResult(ToolErrorCode.ENTITY_NOT_OWNED, 'Preview does not belong to you');
      }

      // Check expiration
      if (preview.expiresAt && preview.expiresAt < new Date()) {
        return this.errorResult(ToolErrorCode.PREVIEW_EXPIRED, 'Preview has expired');
      }

      // Check if already used
      if (preview.usedAt) {
        return this.errorResult(ToolErrorCode.IDEMPOTENCY_CONFLICT, 'Preview has already been used');
      }

      if (!preview.valid) {
        return this.errorResult(ToolErrorCode.VALIDATION_ERROR, 'Preview is not valid');
      }

      // TODO: Actually call Asaas API to create the charge
      // For now, we'll create a placeholder payment record
      const payment = await this.prisma.$transaction(async (tx) => {
        // Mark preview as used
        await tx.aiPaymentPreview.update({
          where: { id: params.previewId },
          data: { usedAt: new Date() },
        });

        // Create payment record
        return tx.clientPayment.create({
          data: {
            userId: context.userId,
            clientId: preview.clientId,
            value: preview.value,
            billingType: preview.billingType as any,
            dueDate: preview.dueDate,
            description: preview.description,
            status: 'PENDING',
            // TODO: Fill these from Asaas response
            asaasPaymentId: `asaas_placeholder_${Date.now()}`,
            asaasInvoiceUrl: 'https://sandbox.asaas.com/invoice/placeholder',
          },
        });
      });

      return {
        success: true,
        data: {
          id: payment.id,
          externalId: payment.asaasPaymentId || '',
          status: payment.status as any,
          billingType: payment.billingType as any,
          value: Number(payment.value),
          dueDate: payment.dueDate,
          invoiceUrl: payment.asaasInvoiceUrl || '',
          pixQrCode: payment.asaasPixCode,
          boletoBarCode: null,
          createdAt: payment.createdAt,
        },
        affectedEntities: [
          { type: 'charge', id: payment.id, action: 'created' },
        ],
      };
    } catch (error) {
      this.logger.error(`billing.createCharge failed: ${error}`);
      return this.errorResult(ToolErrorCode.INTERNAL_ERROR, 'Failed to create charge');
    }
  }

  // ==========================================================================
  // KNOWLEDGE BASE
  // ==========================================================================

  async kbSearch(
    params: KbSearchDto,
    context: ToolContext,
  ): Promise<ToolResult<KbSearchResponse>> {
    try {
      this.logger.log(`kb.search: query="${params.query}", category=${params.category}`);

      // Use the real KbSearchService
      const searchResponse = await this.kbSearchService.search(params.query, {
        topK: params.limit || 5,
        minScore: 0.5,
        includeMetadata: true,
      });

      // Transform results to match the expected DTO format
      const results = searchResponse.results.map((result) => ({
        content: result.content,
        source: result.sourceRef || result.source,
        relevanceScore: result.score,
        category: (params.category || 'general') as any,
      }));

      return {
        success: true,
        data: {
          results,
          totalResults: searchResponse.totalResults,
        },
      };
    } catch (error) {
      this.logger.error(`kb.search failed: ${error}`);
      return this.errorResult(ToolErrorCode.INTERNAL_ERROR, 'Failed to search knowledge base');
    }
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  private errorResult(errorCode: ToolErrorCode, message: string): ToolResult<never> {
    return {
      success: false,
      error: message,
      errorCode,
    };
  }

  private async checkEntityLimit(userId: string, entity: string): Promise<boolean> {
    // TODO: Implement actual plan limit checking
    // For now, always allow
    return true;
  }
}
